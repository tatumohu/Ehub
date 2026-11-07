const fs = require('fs');
console.log(fs.readFileSync('src/pages/IdeaDetail.tsx', 'utf8').includes('historical'));
