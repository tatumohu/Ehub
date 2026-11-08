const Database = require('better-sqlite3');
const db = new Database('ehub.db');
const rows = db.prepare("SELECT permitted_users FROM ideas WHERE is_private = 1").all();
console.log(rows);
const rows2 = db.prepare("SELECT permitted_users FROM projects WHERE is_private = 1").all();
console.log(rows2);
