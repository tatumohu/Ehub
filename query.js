const db = require('better-sqlite3')('ehub.db');
console.log('Ideas:');
console.log(db.prepare('SELECT id, title, is_buyout FROM ideas').all());
console.log('Projects:');
console.log(db.prepare('SELECT id, title, is_buyout, status FROM projects').all());
