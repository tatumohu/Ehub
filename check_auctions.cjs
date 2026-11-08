const db = require('better-sqlite3')('ehub.db');
console.log(db.prepare("SELECT id, status, buyout_type, start_date, end_date FROM buyouts").all());
