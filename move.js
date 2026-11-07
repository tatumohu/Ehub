const fs = require('fs');

if (fs.existsSync('ehub.db')) {
  fs.renameSync('ehub.db', 'ehub.db.corrupt2');
  console.log("Moved ehub.db to ehub.db.corrupt2");
}
