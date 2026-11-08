import Database from 'better-sqlite3';
const db = new Database('ehub.db');
const row = db.prepare("INSERT INTO projects (title, description, author_id, is_private, permitted_users) VALUES ('Secret Project', 'This is highly secret', 1, 1, '[]') RETURNING id").get();
console.log(row);
