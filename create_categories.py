from app import app
from models import db, Category

with app.app_context():
    categories = [
        '製造・メーカー',
        '製薬・バイオテクノロジー',
        '農業・林業・水産業',
        '小売・卸売・商社',
        '観光・旅行・宿泊',
        '芸術・娯楽・レクリエーション',
        '飲食',
        '生活関連サービス',
        '不動産',
        '運輸・交通・物流',
        'インフラ・鉱業',
        '建設・修理サービス・メンテナンスサービス',
        '組織マネジメント・シンクタンク',
        '人事・人材サービス',
        '法律',
        '医療・病院',
        '航空宇宙・防衛',
        '金融',
        '保険',
        '広告・メディア・マスコミ',
        '通信・インターネット',
        '情報技術',
        '教育・学校',
        '官公庁・行政・警察',
        '福祉・独立行政法人・NGO・NPO'
    ]
    for name in categories:
        existing_category = Category.query.filter_by(name=name).first()
        if not existing_category:
            category = Category(name=name)
            db.session.add(category)
            print(f"Added category: {name}")
        else:
            print(f"Category already exists: {name}")
    db.session.commit()
