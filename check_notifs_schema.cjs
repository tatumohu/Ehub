const db = require('better-sqlite3')('ehub.db');
console.log(db.prepare("PRAGMA table_info(notifications)").all());
