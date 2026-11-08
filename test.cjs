const Database = require('better-sqlite3');
const db = new Database('ehub.db');
const res = db.prepare(`SELECT projects.id, COALESCE(
  (SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id),
  (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'),
  projects.stage
) as stage FROM projects LIMIT 5`).all();
console.log(res);
