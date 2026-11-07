const db = require('better-sqlite3')('ehub.db');
console.log(db.prepare("SELECT id, status, end_date FROM buyouts").all());
