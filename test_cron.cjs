const db = require('better-sqlite3')('ehub.db');
const activeAuctions = db.prepare("SELECT * FROM buyouts WHERE status = 'completed' AND buyout_type = 'auction'").all();
console.log(activeAuctions);
for (const buyout of activeAuctions) {
  try {
    const highestBid = db.prepare('SELECT user_id, amount FROM auction_bids WHERE buyout_id = ? ORDER BY amount DESC LIMIT 1').get(buyout.id);
    
    const winner_id = highestBid ? highestBid.user_id : null;
    const winning_price = highestBid ? highestBid.amount : null;
    console.log("highestBid:", highestBid);
  } catch (e) {
    console.log(e);
  }
}
