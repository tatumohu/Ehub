const db = require('better-sqlite3')('ehub.db');
console.log(db.prepare("SELECT * FROM notifications ORDER BY id DESC LIMIT 5").all());
