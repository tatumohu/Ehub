const Database = require('better-sqlite3');
const db = new Database('ehub.db');

const q = 'テスト';
const query = `%${q}%`;

const projects = db.prepare(`
    SELECT projects.id, projects.title, projects.status, projects.quoted_item_id, projects.quoted_item_type, 'project' as item_type
    FROM projects
    WHERE (projects.title LIKE ? OR projects.description LIKE ? OR projects.completed_title LIKE ? OR projects.completed_description LIKE ?)
  `).all(query, query, query, query);

console.log('projects:', projects);

// Let's run the exact loop:

for (const item of projects) {
    if (item.quoted_item_id) {
      let currentId = item.quoted_item_id;
      let currentType = item.quoted_item_type;

      while (currentId) {
        const table = currentType === 'idea' ? 'ideas' : 'projects';
        const parent = db.prepare(`SELECT quoted_item_id, quoted_item_type FROM ${table} WHERE id = ?`).get(currentId);
        if (parent && parent.quoted_item_id) {
          currentId = parent.quoted_item_id;
          currentType = parent.quoted_item_type;
        } else {
          break;
        }
      }
      
      if (currentType === 'project' && currentId) {
        const rootProject = db.prepare('SELECT status FROM projects WHERE id = ?').get(currentId);
        if (rootProject) {
          item.status = rootProject.status;
        }
      } else {
        item.status = 'active';
      }
    } else {
        // has no quoted_item_id
    }
}

console.log('projects after:', projects);
