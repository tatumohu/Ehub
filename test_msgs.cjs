const db = require('better-sqlite3')('ehub.db');
const msgs = db.prepare('SELECT id, idea_id, project_id, type, content FROM messages LIMIT 10').all();
console.log(msgs);
