const db = require('better-sqlite3')('ehub.db');
const ideas = db.prepare(`
      SELECT ideas.id, ideas.title, ideas.status
      FROM ideas
      WHERE ideas.status = 'active' AND NOT EXISTS (
        WITH RECURSIVE lineage AS (
          SELECT id, quoted_item_id, quoted_item_type FROM ideas AS i2 WHERE i2.id = ideas.id
          UNION ALL
          SELECT l.id, i3.quoted_item_id, i3.quoted_item_type FROM ideas i3 JOIN lineage l ON i3.id = l.quoted_item_id AND l.quoted_item_type = 'idea'
        )
        SELECT 1 FROM lineage l JOIN projects p ON l.quoted_item_id = p.id AND l.quoted_item_type = 'project' WHERE p.status = 'completed'
      )
      ORDER BY ideas.created_at DESC
`).all();
console.log(ideas);
