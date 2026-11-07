const db = require('better-sqlite3')('ehub.db'); 
try { console.log(db.prepare("SELECT is_recruitment FROM ideas LIMIT 1").all()) } catch(e) { console.error('IDEAS:', e.message) }
try { console.log(db.prepare("SELECT is_recruitment FROM projects LIMIT 1").all()) } catch(e) { console.error('PROJECTS:', e.message) }
