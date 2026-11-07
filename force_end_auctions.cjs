const db = require('better-sqlite3')('ehub.db');
db.prepare("UPDATE buyouts SET end_date = ? WHERE status = 'active' AND buyout_type = 'auction'").run(new Date(Date.now() - 10000).toISOString());
console.log("Forced active auctions to end");
