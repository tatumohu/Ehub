const db = require('better-sqlite3')('ehub.db');
console.log(db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='buyouts'").get().sql);
