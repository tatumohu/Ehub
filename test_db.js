const Database = require('better-sqlite3');
const db = new Database('sqlite.db');

const query = `
  SELECT projects.id, projects.title,
    COALESCE(
      (SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), 
      (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), 
      projects.stage
    ) as stage
  FROM projects
`;
const rows = db.prepare(query).all();
console.log(rows);
