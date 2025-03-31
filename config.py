import os

basedir = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # ここに共通の設定（メールサーバー設定など）があれば追加

class DevelopmentConfig(Config):
    DEBUG = True
    # 開発環境では、テスト用のデータベース（例：SQLite の app.db）
    SQLALCHEMY_DATABASE_URI = os.environ.get('DEV_DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'app.db')

class ProductionConfig(Config):
    DEBUG = False
    # 本番環境では、本番用のデータベース（例：SQLite の prod.db、または PostgreSQL/MySQL）
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(basedir, 'prod.db')
