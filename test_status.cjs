const db = require('better-sqlite3')('ehub.db');
const ideas = db.prepare('SELECT id, title, status FROM ideas ORDER BY created_at DESC LIMIT 5').all();
console.log(ideas);
