const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const projectStageSelect = "COALESCE((SELECT COALESCE(ROUND(AVG(se.stage)), i.stage) FROM ideas i LEFT JOIN stage_evaluations se ON se.item_id = i.id AND se.item_type = 'idea' WHERE i.id = projects.latest_idea_id GROUP BY i.id), (SELECT COALESCE(ROUND(AVG(se.stage)), projects.stage) FROM stage_evaluations se WHERE se.item_id = projects.id AND se.item_type = 'project'), projects.stage) as stage";
const ideaStageSelect = "COALESCE((SELECT ROUND(AVG(se.stage)) FROM stage_evaluations se WHERE se.item_id = ideas.id AND se.item_type = 'idea'), ideas.stage) as stage";

code = code.replace(/projects\.quoted_item_type,\s*stage,\s*projects\.is_recruitment/g, `projects.quoted_item_type, ${projectStageSelect}, projects.is_recruitment`);
code = code.replace(/ideas\.quoted_item_type,\s*stage,\s*ideas\.is_recruitment/g, `ideas.quoted_item_type, ${ideaStageSelect}, ideas.is_recruitment`);
code = code.replace(/ideas\.quoted_item_type,\s*ideas\.stage,\s*ideas\.is_recruitment/g, `ideas.quoted_item_type, ${ideaStageSelect}, ideas.is_recruitment`);

fs.writeFileSync('server.ts', code);
