from flask_wtf import FlaskForm
from wtforms import StringField, PasswordField, TextAreaField, SelectMultipleField, SubmitField, DateField, FileField
from wtforms.validators import DataRequired, EqualTo, Email
from wtforms.widgets import ListWidget, CheckboxInput
from models import User, Category

class RegistrationForm(FlaskForm):
    username = StringField('ユーザー名', validators=[DataRequired()])
    birthdate = DateField('生年月日', format='%Y-%m-%d', validators=[])
    email = StringField('メールアドレス', validators=[Email()])
    password = PasswordField('パスワード', validators=[DataRequired()])
    password2 = PasswordField('パスワード(再入力)', validators=[
        DataRequired(), EqualTo('password', message='パスワードが一致しません。')
    ])
    submit = SubmitField('登録')

class LoginForm(FlaskForm):
    username = StringField('ユーザー名', validators=[DataRequired()])
    password = PasswordField('パスワード', validators=[DataRequired()])
    submit = SubmitField('ログイン')

class IdeaForm(FlaskForm):
    title = StringField('アイデアのタイトル', validators=[DataRequired()])
    description = TextAreaField('アイデアの概要', validators=[DataRequired()])
    categories = SelectMultipleField(
        '分野',
        coerce=int,
        option_widget=CheckboxInput(),
        widget=ListWidget(prefix_label=False)
    )
    submit = SubmitField('投稿')

class CommentForm(FlaskForm):
    content = TextAreaField('コメント', validators=[DataRequired()])
    submit = SubmitField('送信')

class FollowRequestForm(FlaskForm):
    message = TextAreaField('最初のコメント（意見）', validators=[DataRequired()])
    submit = SubmitField('フォローを申請')

class FollowResponseForm(FlaskForm):
    accept = SubmitField('はい')
    reject = SubmitField('いいえ')

class SearchForm(FlaskForm):
    keyword = StringField('キーワード')
    categories = SelectMultipleField(
        '分野',
        coerce=int,
        option_widget=CheckboxInput(),
        widget=ListWidget(prefix_label=False)
    )
    submit = SubmitField('検索')

# ユーザー情報編集用フォーム (UserProfileForm)
class UserProfileForm(FlaskForm):
    name = StringField('名前', validators=[DataRequired()])
    birthdate = DateField('生年月日', format='%Y-%m-%d', validators=[DataRequired()])
    email = StringField('メールアドレス', validators=[DataRequired()])
    topphoto = FileField('Topphoto')  # 写真アップロード用
    # 興味のある分野（チェックボックス）
    # interestsはCategoryのID一覧を受け取る想定
    interests = SelectMultipleField(
        '興味のある分野',
        coerce=int,
        option_widget=CheckboxInput(),
        widget=ListWidget(prefix_label=False)
    )
    submit = SubmitField('更新')
    
class GroupSelectForm(FlaskForm):
    pass  # あるいは selected_users = Field(...), etc.

class NotificationForm(FlaskForm):
    pass  # 必要ならフィールドを追加