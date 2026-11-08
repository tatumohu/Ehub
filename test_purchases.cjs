const Database = require('better-sqlite3');
const db = new Database('ehub.db');
const userId = 1; // test user
const buyouts = db.prepare(`
      SELECT b.id as buyout_id, b.item_id, b.item_type, b.winning_price as amount, b.created_at, b.status,
             'Buyout' as tier_description,
             'buyout_' || b.id as stripe_session_id
      FROM buyouts b
      WHERE b.winner_id = ? AND b.status = 'paid'
      ORDER BY b.created_at DESC
`).all(userId);
console.log(buyouts);
