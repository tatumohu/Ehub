import fs from 'fs';

let server = fs.readFileSync('server.ts', 'utf8');

server = server.replace(/ideas\.stage,/g, 'ideas.stage, ideas.is_private, ideas.permitted_users,');
server = server.replace(/projects\.stage, latest_idea_id/g, 'projects.stage, projects.is_private, projects.permitted_users, latest_idea_id');

fs.writeFileSync('server.ts', server);
console.log('Updated SELECT statements');
