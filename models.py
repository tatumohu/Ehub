from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

db = SQLAlchemy()

# 各中間テーブルの定義
idea_categories = db.Table(
    'idea_categories',
    db.Column('idea_id', db.Integer, db.ForeignKey('idea.id')),
    db.Column('category_id', db.Integer, db.ForeignKey('category.id'))
)

# User と Category の中間テーブル（User の興味ある分野）
user_interests = db.Table(
    'user_interests',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('category_id', db.Integer, db.ForeignKey('category.id'))
)

idea_flowers = db.Table(
    'idea_flowers',
    db.Column('idea_id', db.Integer, db.ForeignKey('idea.id')),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'))
)

# コメント用の花（いいね）記録用中間テーブル
comment_flowers = db.Table(
    'comment_flowers',
    db.Column('comment_id', db.Integer, db.ForeignKey('comment.id')),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'))
)

# ユーザー間フォロー関係（自己結合の中間テーブル）
user_follows = db.Table(
    'user_follows',
    db.Column('follower_id', db.Integer, db.ForeignKey('user.id')),
    db.Column('followed_id', db.Integer, db.ForeignKey('user.id'))
)

class User(UserMixin, db.Model):
    __tablename__ = 'user'  # 明示的にテーブル名を指定
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), nullable=False, unique=True)
    password_hash = db.Column(db.String(128), nullable=False)
    name = db.Column(db.String(100))
    birthdate = db.Column(db.Date)
    email = db.Column(db.String(120))
    topphoto = db.Column(db.String(255))  # 例: "user_1_topphoto.png"

    # User と Category の多対多（興味ある分野）を user_interests テーブルで管理
    interests = db.relationship(
        'Category',
        secondary=user_interests,
        backref='users',
        lazy='dynamic'
    )

    ideas = db.relationship('Idea', backref='author', lazy='dynamic')

    notifications = db.relationship(
        'Notification',
        foreign_keys='Notification.user_id',
        backref='recipient',
        lazy='dynamic'
    )

    # ★ ユーザー間フォロー関係
    #   followers: 「このユーザー（self）をフォローしているユーザー」の集合
    #   following: 「このユーザー（self）がフォローしているユーザー」の集合（backref で定義）
    followers = db.relationship(
        'User',
        secondary=user_follows,
        primaryjoin=(user_follows.c.followed_id == id),
        secondaryjoin=(user_follows.c.follower_id == id),
        backref=db.backref('following', lazy='dynamic'),
        lazy='dynamic'
    )

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    # ==============================
    #  フォロー機能関連メソッド
    # ==============================

    def is_following(self, user):
        """
        引数の user を自分 (self) がフォローしているか判定する。
        => self.following に user が含まれているかどうか。
        """
        if not user:
            return False
        return self.following.filter(user_follows.c.followed_id == user.id).count() > 0

    def follow(self, user):
        """
        引数の user をフォローする（すでにフォローしていなければ追加）。
        """
        if user and not self.is_following(user):
            self.following.append(user)

    def unfollow(self, user):
        """
        引数の user とのフォロー関係を解除する。
        """
        if user and self.is_following(user):
            self.following.remove(user)

    def is_followed_by(self, user):
        """
        引数の user が自分 (self) をフォローしているか判定。
        => self.followers に user が含まれているかどうか。
        """
        if not user:
            return False
        return self.followers.filter(user_follows.c.follower_id == user.id).count() > 0

    def get_mutual_followers_with(self, other_user):
        """
        自分 (self) と other_user が互いにフォローしているユーザーをリストで返す。
        （「相互フォロー状態にあるユーザー一覧」を想定）
        
        ここでは簡単に「self.following と other_user.following の共通部分」を取る。
        lazy='dynamic' なので all() でリストを取得し、in 演算で比較。
        """
        if not other_user:
            return []
        self_following_list = self.following.all()
        other_following_list = other_user.following.all()
        mutual = [u for u in self_following_list if u in other_following_list]
        return mutual

class Idea(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(128), nullable=False)
    description = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)

    categories = db.relationship(
        'Category',
        secondary=idea_categories,
        backref='ideas',
        lazy='dynamic'
    )

    comments = db.relationship('Comment', backref='idea', lazy='dynamic')

    followers = db.relationship(
        'User',
        secondary='idea_followers',
        backref='followed_ideas'
    )

    flowers = db.relationship(
        'User',
        secondary=idea_flowers,
        backref='flowered_ideas'
    )

class IdeaFollower(db.Model):
    __tablename__ = 'idea_followers'
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), primary_key=True)

class Category(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), nullable=False, unique=True)

class Comment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    user = db.relationship('User')
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=True)

    # コメント用の花リレーションシップ
    flowers = db.relationship(
        'User',
        secondary=comment_flowers,
        backref='flowered_comments',
        lazy='dynamic'
    )

    parent_id = db.Column(db.Integer, db.ForeignKey('comment.id', name='fk_comment_parent_id'), nullable=True)
    replies = db.relationship(
        'Comment',
        backref=db.backref('parent', remote_side=[id]),
        lazy='dynamic'
    )

class FollowRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    message = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(10), nullable=False, default='pending')  # 'pending', 'accepted', 'rejected'

    idea = db.relationship('Idea')
    user = db.relationship('User')

class Notification(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.String(256))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    is_read = db.Column(db.Boolean, default=False)
    
    # すでにあるフィールド
    actor_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    actor = db.relationship('User', foreign_keys=[actor_id])
    
    # 追加するフィールド
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'), nullable=True)
    idea = db.relationship('Idea', foreign_keys=[idea_id])  # これを追加
    comment_id = db.Column(db.Integer, db.ForeignKey('comment.id'), nullable=True)
    notification_type = db.Column(db.String(32), nullable=True)

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='messages')
    idea = db.relationship('Idea', backref='messages')

class UserIdeaUnread(db.Model):
    """
    ‘アイデア × ユーザー’ ごとの未読数を保持するサンプルモデル。
    """
    __tablename__ = 'user_idea_unread'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    idea_id = db.Column(db.Integer, db.ForeignKey('idea.id'))
    unread_count = db.Column(db.Integer, default=0)

    user = db.relationship('User')
    idea = db.relationship('Idea')
