const fs = require('fs');
const content = fs.readFileSync('src/pages/ProjectChat.tsx', 'utf8');
const regex = /msg\.type === 'edit_proposal' \? \([\s\S]*?msg\.type === 'contact'/;
console.log(regex.test(content));
