const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace ideas select
content = content.replace(
  /SELECT ideas\.id, ideas\.title, ideas\.description, ideas\.image, ideas\.author_id, ideas\.quoted_item_id, ideas\.quoted_item_type/g, 
  'SELECT ideas.id, ideas.title, ideas.description, ideas.image, ideas.author_id, ideas.quoted_item_id, ideas.quoted_item_type, ideas.stage'
);

// Replace projects select
content = content.replace(
  /SELECT projects\.id, projects\.title, projects\.description, projects\.image, projects\.author_id, projects\.status, projects\.quoted_item_id, projects\.quoted_item_type/g,
  'SELECT projects.id, projects.title, projects.description, projects.image, projects.author_id, projects.status, projects.quoted_item_id, projects.quoted_item_type, projects.stage'
);

content = content.replace(
  /SELECT projects\.id, projects\.title, projects\.description, projects\.image, projects\.author_id, projects\.status,\n/g,
  'SELECT projects.id, projects.title, projects.description, projects.image, projects.author_id, projects.status, projects.stage,\n'
);

fs.writeFileSync('server.ts', content);

console.log("Updated server.ts successfully");
