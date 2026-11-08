const Database = require('better-sqlite3');
const db = new Database('ehub.db');
console.log(db.prepare('SELECT id, username FROM users').all());
