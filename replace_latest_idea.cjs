const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// replace projects.latest_idea_id with latest_idea_id in line 653 and other places that don't have projects. as alias
code = code.replace(/stage, projects.latest_idea_id/g, 'stage, latest_idea_id');
code = code.replace(/strftime\('%Y-%m-%dT%H:%M:%SZ', projects.latest_idea_at\) as latest_idea_at/g, "strftime('%Y-%m-%dT%H:%M:%SZ', latest_idea_at) as latest_idea_at");

// wait, if I remove `projects.`, then `projects.latest_idea_id` becomes `latest_idea_id`.
// But for typical `SELECT projects.id... projects.latest_idea_id`, removing `projects.` might be fine if there's no ambiguity, but better not to break other things...
// wait! `projects` is used as table alias in many places `FROM projects`.
// In line 1461: `SELECT DISTINCT p.id... projects.latest_idea_id...` -> `p.latest_idea_id`
code = code.replace(/p.author_id, projects.latest_idea_id, strftime\('%Y-%m-%dT%H:%M:%SZ', projects.latest_idea_at\)/g, "p.author_id, p.latest_idea_id, strftime('%Y-%m-%dT%H:%M:%SZ', p.latest_idea_at)");

fs.writeFileSync('server.ts', code, 'utf8');
console.log('replaced');
