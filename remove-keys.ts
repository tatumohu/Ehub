import fs from 'fs';
import path from 'path';

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules') scanDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('motion.') && content.includes('key=')) {
        console.log(`Found possible key in motion in ${fullPath}`);
        // Remove key="..."
        let newContent = content.replace(/<motion\.div[^>]*key=[\{"]?[^>]*>/g, match => {
          console.log('Match:', match);
          return match.replace(/key=(?:(?:'[^']*')|(?:"[^"]*")|(?:\{[^}]*\}))/, '');
        });
        if (content !== newContent) {
           fs.writeFileSync(fullPath, newContent);
           console.log(`Updated ${fullPath}`);
        }
      }
    }
  });
}

scanDir('src');
