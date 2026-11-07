import Database from 'better-sqlite3';
const db = new Database('ehub.db');
const buyouts = db.prepare('SELECT id, buyout_type FROM buyouts').all();
console.log(buyouts);
