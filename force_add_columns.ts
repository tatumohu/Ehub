import Database from 'better-sqlite3';
const db = new Database('ehub.db');
try {
  db.exec("ALTER TABLE projects ADD COLUMN latest_idea_id INTEGER");
  db.exec("ALTER TABLE projects ADD COLUMN latest_idea_at DATETIME");
  console.log('Columns added successfully');
} catch (e) {
  console.log('Error or already exist:', e);
}
