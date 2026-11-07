const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// For projects/:id
content = content.replace(
  `(SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count,`,
  `(SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 1) as follows_count,\n           (SELECT COUNT(*) FROM idea_follows WHERE project_id = projects.id AND is_mutual = 0 AND status = 'pending') as pending_approvals_count,`
);

// For ideas/:id
content = content.replace(
  `(SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count,`,
  `(SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 1) as follows_count,\n           (SELECT COUNT(*) FROM idea_follows WHERE idea_id = ideas.id AND is_mutual = 0 AND status = 'pending') as pending_approvals_count,`
);

fs.writeFileSync('server.ts', content);
