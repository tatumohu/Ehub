const db = require('better-sqlite3')('app.db');
const columns = db.pragma('table_info(ideas)');
console.log(columns.map(c => c.name).join(', '));
