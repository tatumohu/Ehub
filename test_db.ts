import Database from 'better-sqlite3';
const db = new Database('ehub.db');
const apps = db.prepare('SELECT * FROM buyout_applications').all();
console.log('apps:', apps);
const bids = db.prepare('SELECT * FROM auction_bids').all();
console.log('bids:', bids);
