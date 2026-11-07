const Database = require('better-sqlite3');
const db = new Database('database.sqlite');
console.log(db.prepare('SELECT id, idea_id, project_id, user_id, recipient_id, content, type FROM messages').all());
