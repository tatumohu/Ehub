import Database from 'better-sqlite3';
const db = new Database('ehub.db');
const query = '%テスト%';
const ideas = db.prepare(`SELECT ideas.id, ideas.title, ideas.quoted_item_id, ideas.quoted_item_type, 'idea' as item_type FROM ideas WHERE (ideas.title LIKE ?)`).all(query);

console.log('ideas:', ideas);
