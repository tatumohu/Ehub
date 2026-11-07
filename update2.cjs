const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf-8');

// Replace duplicate stages
content = content.replace(/ ideas\.stage, ideas\.stage, ideas\.stage,/g, ' ideas.stage,');
content = content.replace(/ ideas\.stage, ideas\.stage,/g, ' ideas.stage,');

content = content.replace(/ projects\.stage, projects\.stage, projects\.stage,/g, ' projects.stage,');
content = content.replace(/ projects\.stage, projects\.stage,/g, ' projects.stage,');

// Check other missing ones like /api/ideas/recommended generic queries
// Let's replace 'idea' as type
content = content.replace(/ quoted_item_type, 'idea' as type/g, " quoted_item_type, stage, 'idea' as type");
content = content.replace(/ quoted_item_type, 'project' as type/g, " quoted_item_type, stage, 'project' as type");
content = content.replace(/ quoted_item_type, type,/g, " quoted_item_type, stage, type,");

// dedupe stage, stage,
content = content.replace(/ stage, stage, stage,/g, " stage,");
content = content.replace(/ stage, stage,/g, " stage,");

fs.writeFileSync('server.ts', content);

console.log("Cleaned server.ts successfully");
