from flask import Flask, render_template, redirect, url_for, request, flash, jsonify
from flask_wtf.csrf import CSRFProtect
from config import Config, DevelopmentConfig, ProductionConfig
from forms import RegistrationForm, LoginForm, IdeaForm, CommentForm, FollowRequestForm, FollowResponseForm, SearchForm, UserProfileForm, GroupSelectForm, NotificationForm
from models import db, User, Idea, Category, Comment, FollowRequest, Notification, IdeaFollower, UserIdeaUnread
from flask_migrate import Migrate
from flask_login import LoginManager, login_user, logout_user, current_user, login_required
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from flask_socketio import SocketIO, join_room, leave_room, emit
from models import db, Idea, User, Message
from notifications import create_notification  # 通知作成処理も各自実装
import re 
import base64
import os

app = Flask(__name__)
# FLASK_ENV により適切な設定クラスを読み込む
if os.environ.get('FLASK_ENV') == 'production':
    app.config.from_object(ProductionConfig)
    async_mode = 'eventlet'
else:
    app.config.from_object(DevelopmentConfig)
    async_mode = 'threading'

db.init_app(app)
migrate = Migrate(app, db)
login_manager = LoginManager(app)
login_manager.login_view = 'login'

last_read_map = {}  # 例: { (user_id, idea_id): datetime, ... }

# CSRF 保護を有効化
csrf = CSRFProtect(app)

# SocketIO の初期化（本番では eventlet、開発では threading）
socketio = SocketIO(app, async_mode=async_mode)

CATEGORY_NAMES = [
    '製造・メーカー', '製薬・バイオテクノロジー', '農業・林業・水産業', '小売・卸売・商社', '観光・旅行・宿泊', '芸術・娯楽・レクリエーション',
    '飲食', '生活関連サービス', '不動産', '運輸・交通・物流', 'インフラ・鉱業', '建設・修理サービス・メンテナンスサービス', '組織マネジメント・シンクタンク',
    '人事・人材サービス', '法律', '医療・病院', '航空宇宙・防衛', '金融', '保険', '広告・メディア・マスコミ', '通信・インターネット', '情報技術',
    '教育・学校', '官公庁・行政・警察', '福祉・独立行政法人・NGO・NPO'
]

with app.app_context():
    db.create_all()
    if Category.query.count() == 0:
        for name in CATEGORY_NAMES:
            c = Category(name=name)
            db.session.add(c)
        db.session.commit()

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = RegistrationForm()
    if form.validate_on_submit():
        existing_user = User.query.filter_by(username=form.username.data).first()
        if existing_user:
            flash('そのユーザー名は既に使われています。別の名前をお試しください。')
            return redirect(url_for('register'))

        user = User(
            username=form.username.data,
            birthdate=form.birthdate.data,
            email=form.email.data
        )
        user.set_password(form.password.data)  # パスワードハッシュ化
        db.session.add(user)
        db.session.commit()
        flash('新規登録が完了しました。ログインしました。')
        login_user(user)  # 登録後に自動ログイン
        return redirect(url_for('index'))
    return render_template('register.html', form=form)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            return redirect(url_for('index'))
        else:
            flash('ユーザー名またはパスワードが間違っています。')
    return render_template('login.html', form=form)

@app.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('index'))

@app.route('/')
@login_required
def index():
    """
    ホーム画面:
    相互フォロー状態にあるユーザーが投稿したEMAを、投稿日時の新しい順に表示する。
    """
    # 現在のユーザーがフォローしているユーザーのリスト
    following = set(current_user.following.all())
    # 現在のユーザーをフォローしているユーザーのリスト
    followers = set(current_user.followers.all())
    # 相互フォローしているユーザーの交差集合
    mutual_followers = list(following.intersection(followers))
    mutual_follower_ids = [u.id for u in mutual_followers]

    ideas = []
    if mutual_follower_ids:
        ideas = Idea.query.filter(Idea.author_id.in_(mutual_follower_ids)) \
                          .order_by(Idea.created_at.desc()) \
                          .all()
    return render_template('index.html', ideas=ideas)

@app.route('/recent_page')
@login_required
def recent_page():
    from forms import CommentForm  # 必要に応じて import
    form = CommentForm()  # フォームオブジェクトを作成
    ideas = Idea.query.all()
    categories = Category.query.all()

    """
    ホーム画面:
      - recent: 直近1週間以内に投稿されたIdeaを新しい順に取得
      - 既存のfollow_requests, follow_backsは不要なら省略。 
        ここでは残してもOK。
    """
    # 1) 直近1週間の閾値を計算
    one_week_ago = datetime.utcnow() - timedelta(days=7)

    # 2) Ideaテーブルから created_at が一週間以内のものを新しい順に取得
    recent_ideas = Idea.query.filter(Idea.created_at >= one_week_ago)\
                             .order_by(Idea.created_at.desc()).all()

    # 既存処理: follow_requests/follow_backsなど
    follow_requests = []
    follow_backs = []
    if current_user.is_authenticated:
        user_notifications = current_user.notifications.filter_by(is_read=False).all()
        for n in user_notifications:
            if 'フォローリクエストがあります' in n.content:
                follow_requests.append(n)
            if 'フォローリクエストを承認しました' in n.content:
                follow_backs.append(n)
                
    return render_template(
        'recent_page.html',
        ideas=ideas,
        categories=categories,
        recent_ideas=recent_ideas,
        follow_requests=follow_requests,
        follow_backs=follow_backs,
        form=form
    )

@app.route('/recent_comment/<int:idea_id>', methods=['POST'])
@login_required
def recent_comment(idea_id):
    """
    recentリスト上のアイデアにコメントを送信する
    """
    idea = Idea.query.get_or_404(idea_id)
    content = request.form.get('content')
    if content:
        new_comment = Comment(
            content=content,
            idea=idea,
            user=current_user if current_user.is_authenticated else None,
            created_at=datetime.utcnow()
        )
        db.session.add(new_comment)
        db.session.commit()
        flash("コメントを投稿しました。")
    return redirect(url_for('index'))

@app.route('/post', methods=['GET', 'POST'])
@login_required
def post():
    form = IdeaForm()
    form.categories.choices = [(c.id, c.name) for c in Category.query.all()]
    if form.validate_on_submit():
        # 入力された概要テキストを整形する
        content = form.description.data
        if content:
            # 全角スペースとノーブレークスペースを削除し、先頭の空白も削除する
            content = content.replace('\u3000', '').replace('\u00a0', '').lstrip()
        idea = Idea(
            title=form.title.data,
            description=content,
            author=current_user
        )
        idea.categories = Category.query.filter(Category.id.in_(form.categories.data)).all()
        db.session.add(idea)
        idea.followers.append(current_user)  # 自分をフォロワーに追加
        db.session.commit()
        return redirect(url_for('index'))
    return render_template('post.html', form=form)

def full_lstrip(value):
    """先頭のすべての空白文字（全角、半角、ノーブレークスペースなど）を削除する"""
    if value is None:
        return ''
    return re.sub(r'^[\s\u3000\u00a0]+', '', value, flags=re.UNICODE)

app.jinja_env.filters['full_lstrip'] = full_lstrip

def lstrip_filter(value):
    if value is None:
        return ''
    return value.lstrip()

app.jinja_env.filters['lstrip'] = lstrip_filter

def nl2br(value):
    """改行文字を <br> タグに変換するカスタムフィルター"""
    if value is None:
        return ''
    # Windows (\r\n) および Unix (\n) 改行を <br> に置換
    return value.replace('\r\n', '<br>').replace('\n', '<br>')

app.jinja_env.filters['nl2br'] = nl2br

@app.route('/idea/<int:idea_id>/comment/<int:comment_id>', methods=['GET', 'POST'])
def view_parent_comment(idea_id, comment_id):
    idea = Idea.query.get_or_404(idea_id)
    parent_comment = Comment.query.get_or_404(comment_id)
    form = CommentForm()
    if form.validate_on_submit():
        new_reply = Comment(
            content=form.content.data,
            idea=idea,
            user=current_user,
            parent_id=parent_comment.id,
            created_at=datetime.utcnow()
        )
        db.session.add(new_reply)
        
        # 返信の場合、親コメントの投稿者が自分でなければ通知を生成
        if parent_comment.user_id != current_user.id:
            notif = Notification(
                user_id=parent_comment.user_id,  # recipient_id から user_id に変更
                actor_id=current_user.id,
                idea_id=idea.id,
                comment_id=parent_comment.id,  # 返信対象の親コメントID
                notification_type='comment_reply',
                content=new_reply.content[:200]
            )
            db.session.add(notif)
        
        db.session.commit()
        flash("返信が投稿されました。", "success")
        return redirect(url_for('view_parent_comment', idea_id=idea.id, comment_id=parent_comment.id))
    
    replies = parent_comment.replies.order_by(Comment.created_at.asc()).all()
    return render_template('parent_comment_view.html',
                           idea=idea,
                           parent_comment=parent_comment,
                           replies=replies,
                           form=form)

@app.route('/search', methods=['GET', 'POST'])
def search():
    form = SearchForm()
    form.categories.choices = [(c.id, c.name) for c in Category.query.all()]
    ideas = []
    if form.validate_on_submit():
        keyword = form.keyword.data
        selected_categories = form.categories.data

        query = Idea.query
        if keyword:
            query = query.filter(
                (Idea.title.contains(keyword)) | (Idea.description.contains(keyword))
            )
        if selected_categories:
            query = query.join(Idea.categories).filter(Category.id.in_(selected_categories))
        ideas = query.distinct().all()

        return render_template('search_results.html', ideas=ideas, form=form)

    return render_template('search.html', form=form)

@app.route('/idea/<int:idea_id>', methods=['GET', 'POST'])
def idea_detail(idea_id):
    """ 誰でも自由にコメント可能（フォローリクエスト不要） """
    idea = Idea.query.get_or_404(idea_id)
    form = CommentForm()
    if form.validate_on_submit():
        new_comment = Comment(
            content=form.content.data,
            idea=idea,
            user=current_user if current_user.is_authenticated else None,
            created_at=datetime.utcnow()
        )

        # 返信ではなく、かつ投稿者とコメント投稿者が異なる場合に通知生成
        if new_comment.parent_id is None and idea.author_id != current_user.id:
            notif = Notification(
                user_id=idea.author_id,  # recipient_id ではなく user_id を使用
                actor_id=current_user.id,
                idea_id=idea.id,
                notification_type='comment_on_post',
                content=new_comment.content[:200]
            )
            db.session.add(notif)
            
        db.session.add(new_comment)
        db.session.commit()
        return redirect(url_for('idea_detail', idea_id=idea_id))

    # コメントのソート時に created_at が None の場合を補完する
    comments = sorted(idea.comments.all(), key=lambda c: c.created_at or datetime.min)
    return render_template('idea.html', idea=idea, form=form, comments=comments)
    # ※ new_comment は新たに追加された Comment オブジェクト、idea は対象のポスト（EMA）オブジェクト、current_user は投稿者

    # ① 自身が投稿したアイデアに対するコメントの場合（親コメントがない場合）
    if form.validate_on_submit():
        new_reply = Comment(
            content=form.content.data,
            idea=idea,
            user=current_user,
            parent_id=parent_comment.id,
            created_at=datetime.utcnow()
        )
        db.session.add(new_reply)
        
        # 返信の場合、親コメントの投稿者が自分でなければ通知を生成
        if parent_comment.user_id != current_user.id:
            notif = Notification(
                user_id=parent_comment.user_id,   # recipient_id ではなく user_id に統一
                actor_id=current_user.id,
                idea_id=idea.id,
                comment_id=parent_comment.id,  # 返信対象の親コメントID
                notification_type='comment_reply',
                content=new_reply.content[:200]
            )
            db.session.add(notif)
        
        db.session.commit()
        flash("返信が投稿されました。", "success")
        return redirect(url_for('view_parent_comment', idea_id=idea.id, comment_id=parent_comment.id))

@app.route('/toggle_flower/<int:idea_id>', methods=['POST'])
@login_required
def toggle_flower(idea_id):
    idea = Idea.query.get_or_404(idea_id)
    if idea.author_id == current_user.id:
        return jsonify({'success': False, 'message': '自分のポストにはハートを送れません。'})
    if current_user in idea.flowers:
        idea.flowers.remove(current_user)
        action = 'removed'
    else:
        idea.flowers.append(current_user)
        action = 'added'
        notif = Notification(
            content=f"{current_user.username} からハートが渡されました。",
            user_id=idea.author_id,
            actor_id=current_user.id, # 通知を起こした人(ハートを押した人)
            idea_id=idea.id,
            notification_type='heart_on_post'
        )
        db.session.add(notif)
    db.session.commit()
    count = len(idea.flowers)
    return jsonify({'success': True, 'action': action, 'flower_count': count})


@app.route('/toggle_comment_flower/<int:comment_id>', methods=['POST'])
@login_required
def toggle_comment_flower(comment_id):
    comment = Comment.query.get_or_404(comment_id)
    if comment.user_id == current_user.id:
        return jsonify({'success': False, 'message': '自分のコメントにはハートを送れません。'})
    if current_user in comment.flowers:
        comment.flowers.remove(current_user)
        action = 'removed'
    else:
        comment.flowers.append(current_user)
        action = 'added'
        notif = Notification(
            content=f"{current_user.username} からハートが渡されました。",
            user_id=comment.user_id,
            actor_id=current_user.id, # 通知を起こした人(ハートを押した人)
            idea_id=comment.idea_id,
            notification_type='heart_on_comment'
        )
        db.session.add(notif)
    db.session.commit()
    count = comment.flowers.count()
    return jsonify({'success': True, 'action': action, 'flower_count': count})

@app.route('/toggle_reply_flower/<int:reply_id>', methods=['POST'])
@login_required
def toggle_reply_flower(reply_id):
    # ここで対象の返信を取得し、ハートの状態をトグルします。
    # 例えば:
    reply = Comment.query.get_or_404(reply_id)
    # 現在のユーザーがすでにハートを付けているかチェック
    if current_user in reply.flowers:
        # ハートを削除
        reply.flowers.remove(current_user)
        action = 'removed'
    else:
        # ハートを追加
        reply.flowers.append(current_user)
        action = 'added'
        notif = Notification(
            content=f"{current_user.username} からハートが渡されました。",
            user_id=reply.user_id,
            actor_id=current_user.id, # 通知を起こした人(ハートを押した人)
            idea_id=comment.idea_id,
            notification_type='heart_on_comment'
        )
        db.session.add(notif)
    db.session.commit()
    flower_count = reply.flowers.count()
    return jsonify(success=True, action=action, flower_count=flower_count)

@app.route('/group')
@login_required
def group():
    # 1) 自分がホストのIdea
    host_ideas = Idea.query.filter_by(author_id=current_user.id).all()
    for idea in host_ideas:
        idea.is_host = True
    
    # 2) 自分が参加しているIdea
    participated_ideas = (
        db.session.query(Idea)
        .join(IdeaFollower, Idea.id == IdeaFollower.idea_id)
        .filter(IdeaFollower.user_id == current_user.id)
        .filter(Idea.author_id != current_user.id)
        .all()
    )
    for idea in participated_ideas:
        idea.is_host = False

    # 3) unify
    unified_ideas = host_ideas + participated_ideas

    # 4) 最後のメッセージ、未読数などを仕込む
    for idea in unified_ideas:
        # 最終メッセージ
        last_msg = (Message.query
                    .filter_by(idea_id=idea.id)
                    .order_by(Message.created_at.desc())
                    .first())
        idea.last_message = last_msg
    
        # unread_count (UserIdeaUnread)
        read_state = UserIdeaUnread.query.filter_by(
            user_id=current_user.id,
            idea_id=idea.id
        ).first()
        idea.unread_count = read_state.unread_count if read_state else 0
    
    for idea in unified_ideas:
        if idea.last_message:
            idea.last_msg_time = idea.last_message.created_at
        else:
            idea.last_msg_time = idea.created_at

    unified_ideas_sorted = sorted(
        unified_ideas,
        key=lambda i: i.last_msg_time,
        reverse=True
    )

    return render_template('group.html', unified_ideas=unified_ideas_sorted)

@app.route('/group_plus')
@login_required
def group_plus():
    """
    プラスマークを押した際に表示: 未グループ化の EMA を一覧表示
    （二分割をやめ、単独ページで表示）
    """
    ungrouped_ideas = Idea.query.filter_by(author_id=current_user.id)\
                                .order_by(Idea.id.desc()).all()
    return render_template('group_plus.html',
                           ungrouped_ideas=ungrouped_ideas)

@app.route('/group_select_users/<int:idea_id>', methods=['GET','POST'])
@login_required
def group_select_users(idea_id):
    """
    選択した Idea に対し、コメントしたユーザーおよび相互フォロー中のユーザーを一覧表示し、
    複数選択して Start Group ボタンで招待を送信する。
    """
    idea = Idea.query.get_or_404(idea_id)
    # コメントしたユーザーのIDを取得
    cusers = db.session.query(Comment.user_id).filter_by(idea_id=idea.id).distinct().all()
    comment_user_ids = {cu.user_id for cu in cusers if cu.user_id}

    # 相互フォロー中のユーザー（current_user と相互フォローしているユーザー）
    mutual_followers = current_user.get_mutual_followers_with(current_user)
    mutual_user_ids = {u.id for u in mutual_followers}

    # 両方のユーザーを union する（自身は除外）
    all_user_ids = comment_user_ids.union(mutual_user_ids)
    if current_user.id in all_user_ids:
        all_user_ids.remove(current_user.id)
    
    users = User.query.filter(User.id.in_(all_user_ids)).all()
    
    form = GroupSelectForm()
    
    if request.method == 'POST':
        selected_user_ids = request.form.getlist('selected_users')
        for uid in selected_user_ids:
            # 招待用のフォローリクエストの作成
            fr = FollowRequest(
                idea=idea,
                user_id=uid,
                message=f"【{idea.title}】から招待が届きました。",
                status='pending'
            )
            db.session.add(fr)
            # 通知の作成
            invited_user = User.query.get(uid)
            notif_content = ""
            if invited_user.topphoto:
                notif_content += f"{invited_user.username}\n"  # ここにトップ画像はテンプレート側で表示する前提
            else:
                notif_content += f"{invited_user.username}\n"
            notif_content += f"【{idea.title}】から招待が届きました。"
            notif = Notification(
                content=notif_content,
                user_id=uid,
                actor_id=current_user.id, # 通知を起こした人(ハートを押した人)
                notification_type="group_invite",
                actor=current_user,
                idea_id=idea.id
            )
            db.session.add(notif)
        db.session.commit()
        flash('グループ招待（フォローリクエスト）を送りました。')
        return redirect(url_for('group'))
    
    return render_template('group_select_users.html', idea=idea, users=users, form=form)

@app.route('/e_notification', methods=['GET','POST'])
@login_required
def e_notification():
    # ★ FlaskFormインスタンスを作る
    form = NotificationForm()

    # 通知一覧 (例: 未読通知のみ)
    notifications = Notification.query.filter_by(
        user_id=current_user.id, is_read=False
    ).order_by(Notification.id.desc()).all()

    # フォローリクエスト一覧
    # どの条件で取得するかは設計次第:
    #   - 自分が承認すべき(= idea.author_id == current_user.id) か
    #   - or 自分宛て(= user_id == current_user.id) か
    #   - ここでは例として "status=pending の全件" としておく
    pending_requests = FollowRequest.query.filter_by(status='pending').all()

    # ★ フォームのバリデーションを使う (CSRFチェックなど)
    if form.validate_on_submit():
        # request_id, actionを取得
        request_id = request.form.get('request_id')
        action = request.form.get('action')

        follow_request = FollowRequest.query.get(int(request_id))
        if not follow_request:
            flash('リクエストが存在しません。')
            return redirect(url_for('e_notification'))

        if action == 'accept':
            # 重複チェック
            if follow_request.user not in follow_request.idea.followers:
                follow_request.idea.followers.append(follow_request.user)
                follow_request.status = 'accepted'
                # 通知 (承認されたユーザーに送る)
                notif = Notification(
                    content=f"{current_user.username} があなたのフォローリクエストを承認しました (EMA: {follow_request.idea.title})",
                    user_id=follow_request.user_id
                )
                db.session.add(notif)
                flash('フォローリクエストを承認しました。')
            else:
                # 既にフォロー済みならステータスだけ 'accepted' にする
                follow_request.status = 'accepted'
                flash('既にフォロワーでした。ステータスを承認状態に変更しました。')

        elif action == 'reject':
            follow_request.status = 'rejected'
            flash('フォローリクエストを拒否しました。')

        db.session.commit()
        return redirect(url_for('e_notification'))

    return render_template(
        'e_notification.html',
        form=form,  # ★ テンプレートにformを渡す
        notifications=notifications,
        pending_requests=pending_requests
    )

@app.route('/notifications/read/<int:notification_id>')
@login_required
def read_notification(notification_id):
    notification = Notification.query.get_or_404(notification_id)
    if notification.user_id != current_user.id:
        flash('この操作を行う権限がありません。')
        return redirect(url_for('index'))
    notification.is_read = True
    db.session.commit()
    return redirect(url_for('e_notification'))

@app.route('/group_invite_response/<int:notif_id>', methods=['POST'])
@login_required
def group_invite_response(notif_id):
    notif = Notification.query.get_or_404(notif_id)
    action = request.args.get('action')

    if action == 'approve':
        # 1) もしアイデア(EMA)が存在しない場合はエラー処理
        if not notif.idea:
            return jsonify(success=False, message="この招待にはアイデアが紐づいていません。")

        # 2) current_user を notif.idea のフォロワー(メンバー)に追加
        #    例: IdeaFollower テーブルを使っているなら:
        existing = IdeaFollower.query.filter_by(idea_id=notif.idea.id, user_id=current_user.id).first()
        if not existing:
            follower = IdeaFollower(idea_id=notif.idea.id, user_id=current_user.id)
            db.session.add(follower)
        
        # 3) 通知を既読にする or 削除などの処理
        notif.is_read = True
        db.session.commit()
        return jsonify(success=True)

    elif action == 'reject':
        # 拒否：通知を既読にするか、statusを"rejected"にするなど
        notif.is_read = True  # あるいは notif.status = 'rejected'
        db.session.commit()
        return jsonify(success=True)
    else:
        return jsonify(success=False, message="不明なアクションです。")

@app.route('/my_user_info')
@login_required
def my_user_info():
    user = current_user
    # ユーザーが投稿したIdeaの数
    ema_count = current_user.ideas.count()

    # Solution はまだ未実装なので、とりあえず 0
    solution_count = 0
    user_interests = user.interests.all()
    user_emas = user.ideas.order_by(Idea.created_at.desc()).all()

    return render_template(
        'my_user_info.html',
        user=user,
        ema_count=ema_count,
        solution_count=solution_count,
        user_interests=user_interests,
        user_emas=user_emas
    )

@app.route('/user_info/<int:user_id>')
@login_required
def user_info(user_id):
    user = User.query.get_or_404(user_id)
    # ---------------------------
    # フォロー状態を再計算する
    # ---------------------------
    if current_user.id == user.id:
        follow_state = "follower"  # 自分自身の場合
    else:
        if current_user.is_following(user):
            # 自分が相手をフォローしている
            if user.is_following(current_user):
                # 相手も自分をフォローしている → "followed"
                follow_state = "followed"
            else:
                # 相手はフォローしていない → "following"
                follow_state = "following"
        else:
            # 自分が相手をフォローしていない → "follow+"
            follow_state = "follow+"

    # 例: ユーザーの投稿数など
    ema_count = user.ideas.count()
    solution_count = 0  # 任意: ソリューション数など
    user_interests = user.interests.all()
    user_emas = user.ideas.order_by(Idea.created_at.desc()).all()

    return render_template(
        'user_info.html',
        user=user,
        follow_state=follow_state,
        ema_count=ema_count,
        solution_count=solution_count,
        user_interests=user_interests,
        user_emas=user_emas
    )

@app.route('/user_settings')
@login_required
def user_settings():
    return render_template('user_settings.html')

@app.route('/user_profile', methods=['GET', 'POST'])
@login_required
def user_profile():
    form = UserProfileForm(obj=current_user)
    all_categories = Category.query.order_by(Category.id).all()
    # dynamic リレーションシップの場合、.all() でリスト化
    user_interests = current_user.interests.all()

    if request.method == 'POST':
        if form.validate_on_submit():
            # ---------- 1) トップ画像の処理 ----------
            cropped_data = request.form.get('cropped_image_data', '').strip()
            if cropped_data:
                try:
                    # "data:image/jpeg;base64,...." の形式から Base64 部分だけ取得
                    header, encoded = cropped_data.split(',', 1)
                    img_bytes = base64.b64decode(encoded)
                    filename = f"user_{current_user.id}_topphoto.png"

                    # 保存先ディレクトリのパスを生成
                    upload_folder = os.path.join(app.root_path, 'static', 'uploads')
                    # ディレクトリが存在しなければ作成
                    if not os.path.exists(upload_folder):
                        os.makedirs(upload_folder)

                    save_path = os.path.join(upload_folder, filename)
                    with open(save_path, 'wb') as f:
                        f.write(img_bytes)
                    current_user.topphoto = filename
                    print("DEBUG: topphoto updated to", filename)
                except Exception as e:
                    flash("画像の保存に失敗しました。", "error")
                    print("ERROR:", e)
            else:
                # 新たな画像が送信されなかった場合は、既存の current_user.topphoto をそのまま保持
                print("DEBUG: cropped_image_data is empty; topphoto remains unchanged")

            # ---------- 2) 興味ある分野の更新 ----------
            raw_interests = request.form.get('selected_interests', '').strip()
            if raw_interests:
                selected_names = raw_interests.split(',')
                cat_objs = Category.query.filter(Category.name.in_(selected_names)).all()
                current_user.interests = cat_objs
            # もし raw_interests が空なら、既存の興味ある分野はそのまま保持

            # ---------- 3) その他フォーム項目の更新 ----------
            if form.name.data and form.name.data.strip() != "":
                current_user.name = form.name.data
            if form.birthdate.data:
                current_user.birthdate = form.birthdate.data
            if form.email.data and form.email.data.strip() != "":
                current_user.email = form.email.data

            db.session.commit()
            flash("プロフィールを更新しました。", "success")
            return redirect(url_for('user_profile'))
        else:
            flash("フォームの入力に誤りがあります。", "error")

    return render_template(
        'user_profile.html',
        form=form,
        all_categories=all_categories,
        user_interests=user_interests
    )

@app.route('/user_past')
@login_required
def user_past():
    past_ideas = current_user.ideas.all()
    past_comments = Comment.query.filter_by(user_id=current_user.id).all()
    return render_template('user_past.html', past_ideas=past_ideas, past_comments=past_comments)

@app.route('/toggle_follow/<int:user_id>', methods=['POST'])
@login_required
def toggle_follow(user_id):
    if current_user.id == user_id:
        return jsonify(success=False, message="自分自身はフォローできません。")

    target = User.query.get_or_404(user_id)
    try:
        if current_user.is_following(target):
            # 既にフォロー中の場合 → フォロー解除
            current_user.unfollow(target)
            db.session.commit()
            state = 'follow+'
        else:
            # フォローしていない場合 → フォローする
            current_user.follow(target)
            db.session.commit()
            # 通知作成（フォローリクエスト）
            content = f"{current_user.username}からフォローリクエストがあります"
            create_notification(target, content, notification_type='follow_request', actor=current_user)

            # 相手がすでに自分をフォローしていれば → "followed"
            if target.is_following(current_user):
                state = 'followed'
            else:
                state = 'following'

        # 相互フォロー数を算出
        mutual_list = current_user.get_mutual_followers_with(target)
        mutual_count = len(mutual_list)

        return jsonify(success=True, state=state, mutual_count=mutual_count)

    except Exception as e:
        db.session.rollback()
        return jsonify(success=False, message=str(e))

@app.route('/get_mutual_followers/<int:user_id>', methods=['GET'])
@login_required
def get_mutual_followers(user_id):
    target = User.query.get_or_404(user_id)
    try:
        # 例：対象ユーザーと current_user の相互フォロー中のユーザー一覧を取得
        mutual_list = target.get_mutual_followers_with(current_user)
        result = []
        for user in mutual_list:
            topphoto_url = url_for('static', filename='images/default_user.png')
            if user.topphoto:
                topphoto_url = url_for('static', filename='uploads/' + user.topphoto)
            result.append({
                'username': user.username,
                'topphoto_url': topphoto_url
            })
        return jsonify(success=True, mutual_followers=result)
    except Exception as e:
        return jsonify(success=False, message=str(e))

@app.route('/group_chat/<int:idea_id>')
@login_required
def group_chat(idea_id):
    """ポップアップ用のグループチャット画面を表示し、過去のやり取りを残す"""
    idea = Idea.query.get_or_404(idea_id)
    # 参加権限チェック
    if current_user not in idea.followers and idea.author_id != current_user.id:
        flash('このグループトークに参加する権限がありません。')
        return redirect(url_for('group'))
    
    # DBから過去メッセージ
    messages = (Message.query
                .filter_by(idea_id=idea.id)
                .order_by(Message.id.asc())
                .all())

    return render_template('group_chat.html', idea=idea, messages=messages,
                           room_name=f"idea_{idea.id}")


#############################
# 追加: SocketIOイベント
#############################
@socketio.on('join_room')
def on_join_room(data):
    """
    data = {'room': 'idea_###'}
    """
    room = data['room']
    join_room(room)
    emit('system_message',
         {'msg': f"{current_user.username}が参加しました。"},
         to=room)

@socketio.on('leave_room')
def on_leave_room(data):
    room = data['room']
    leave_room(room)
    emit('system_message',
         {'msg': f"{current_user.username}が退出しました。"},
         to=room)

@socketio.on('send_message')
def on_send_message(data):
    """
    data = {
      'room': 'idea_###',
      'idea_id': ###,
      'content': 'メッセージ本文'
    }
    """
    room = data['room']
    idea_id = data['idea_id']
    content = data['content']

    # DBにMessage追加
    new_msg = Message(idea_id=idea_id,
                      user_id=current_user.id,
                      content=content)
    db.session.add(new_msg)
    db.session.commit()

    # 送信者以外のフォロワーに対して unread_count を +1
    idea = Idea.query.get(idea_id)
    # idea.followers: 参加ユーザー
    for u in idea.followers:
        if u.id != current_user.id:
            # unreadレコードを探す
            rec = UserIdeaUnread.query.filter_by(user_id=u.id, idea_id=idea_id).first()
            if not rec:
                rec = UserIdeaUnread(user_id=u.id, idea_id=idea_id, unread_count=0)
                db.session.add(rec)
            rec.unread_count += 1
    db.session.commit()

    # メッセージ送信をroomにBroadcast
    iso_utc = new_msg.created_at.isoformat() + "Z"
    emit('receive_message', {
        'user_id': current_user.id,
        'username': current_user.username,
        'content': content,
        'created_at': iso_utc
    }, to=room)

    # E-group更新用 (プレビュー等)
    preview = content[:20] + "..." if len(content) > 20 else content
    emit('update_preview', {
        'idea_id': idea_id,
        'preview': preview,
        'sender_id': current_user.id
    }, broadcast=True, namespace='/')  # 全体に送る or もう一つ “egroup_main”部屋とか

@socketio.on('read_messages')
def on_read_messages(data):
    """
    data = {
      'idea_id': ###,
    }
    => ユーザーが group_chat(idea_id) を開いた時に '未読を0にする' など
    """
    idea_id = data['idea_id']
    rec = UserIdeaUnread.query.filter_by(
        user_id=current_user.id,
        idea_id=idea_id
    ).first()
    if rec and rec.unread_count > 0:
        rec.unread_count = 0
        db.session.commit()
        # 既読化したことを E-group にも通知(バッジを0にする)
        emit('update_unread_count', {
            'idea_id': idea_id,
            'user_id': current_user.id,
            'unread_count': 0
        }, broadcast=True)

#############################
# メイン起動部
#############################
if __name__ == '__main__':
    import os
    env = os.environ.get("FLASK_ENV", "development")
    if env == "development":
        # 開発環境ならデバッグモードで起動
        socketio.run(app, debug=True, port=5001)
    else:
        # 本番環境の場合、__main__ ブロックは通常使われませんが、
        # ローカルで本番設定をテストする場合のために allow_unsafe_werkzeug を指定
        socketio.run(app, debug=False, port=5001, allow_unsafe_werkzeug=True)


