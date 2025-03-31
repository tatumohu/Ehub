from models import db, Notification
from flask import current_app, url_for
from flask_socketio import SocketIO

def get_socketio():
    return current_app.extensions.get('socketio')

def create_notification(target_user, content, notification_type, actor, idea_id=None, comment_id=None):
    """
    通知情報をDBに保存し、Socket.IO でリアルタイムにE-notificationへ更新を送信する処理。
    """
    try:
        notification = Notification(
            content=content,
            user_id=target_user.id,
            notification_type=notification_type,
            actor_id=actor.id,
            idea_id=idea_id,
            comment_id=comment_id
        )
        db.session.add(notification)
        db.session.commit()
        socketio = get_socketio()
        if socketio:
            socketio.emit('new_notification', {
                'notification_id': notification.id,
                'content': notification.content,
                'actor_username': actor.username,
                'notification_type': notification_type,
                'idea_id': idea_id,
                'comment_id': comment_id
            }, room=str(target_user.id))
        else:
            current_app.logger.warning("Socket.IOインスタンスが見つかりません。")
    except Exception as e:
        db.session.rollback()
        current_app.logger.error("通知作成エラー: " + str(e))
