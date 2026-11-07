import Database from 'better-sqlite3';
const db = new Database('ehub.db');
const id = 2; // Assuming buyout_id 2 or 3 or 4
const buyout = db.prepare('SELECT buyout_type FROM buyouts WHERE id = ?').get(id) as any;
console.log('buyout:', buyout);

const applications = db.prepare(`
  SELECT 
    MAX(ab.id) as id,
    ab.buyout_id,
    ab.user_id,
    MAX(ab.amount) as price,
    '' as message,
    'pending' as status,
    MAX(ab.created_at) as created_at,
    users.username,
    users.avatar,
    users.account_type
  FROM auction_bids ab
  JOIN users ON ab.user_id = users.id
  WHERE ab.buyout_id = ?
  GROUP BY ab.user_id
  ORDER BY price DESC
`).all(id);
console.log('apps:', applications);

