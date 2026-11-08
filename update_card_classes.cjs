const fs = require('fs');
let content = fs.readFileSync('src/pages/NetworkView.tsx', 'utf8');

content = content.replace(
  'className="flex-shrink-0 snap-center transition-transform hover:-translate-y-2"',
  'className="transition-transform hover:-translate-x-2"'
);

fs.writeFileSync('src/pages/NetworkView.tsx', content);
