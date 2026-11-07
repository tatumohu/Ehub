const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

code = code.replace(
  /\(SELECT COUNT\(\*\) FROM comments WHERE idea_id = ideas\.id\) as comments_count,/g,
  "(SELECT COUNT(*) FROM comments WHERE idea_id = ideas.id) as comments_count,\n             (SELECT COUNT(*) FROM archives WHERE item_id = ideas.id AND item_type = 'idea') as archives_count,"
);

code = code.replace(
  /\(SELECT COUNT\(\*\) FROM comments WHERE project_id = projects\.id\) as comments_count,/g,
  "(SELECT COUNT(*) FROM comments WHERE project_id = projects.id) as comments_count,\n             (SELECT COUNT(*) FROM archives WHERE item_id = projects.id AND item_type = 'project') as archives_count,"
);

fs.writeFileSync('server.ts', code);
console.log('Update successful!');
