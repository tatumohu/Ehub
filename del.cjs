const Database = require('better-sqlite3');
const db = new Database('ehub.db');
db.prepare("DELETE FROM notifications WHERE type = 'buyout_join'").run();
console.log("Deleted");
