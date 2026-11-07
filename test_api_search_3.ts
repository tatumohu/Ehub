import Database from 'better-sqlite3';
const db = new Database('ehub.db');

const emas = db.prepare(`SELECT id, title, description, quoted_item_id, status FROM projects WHERE quoted_item_id IS NOT NULL`).all();
console.log('emas:', emas);

const ideas = db.prepare(`SELECT id, title, description, quoted_item_id FROM ideas WHERE quoted_item_id IS NOT NULL`).all();
console.log('ideas:', ideas);
