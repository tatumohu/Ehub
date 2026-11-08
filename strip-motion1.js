import fs from 'fs';

const files = [
  'src/pages/IdeaDetail.tsx',
  'src/pages/ProjectDetail.tsx',
  'src/pages/CreateIdea.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf-8');
  
  // replace <motion.div with <div
  content = content.replace(/<motion\.div/g, '<div');
  // replace </motion.div> with </div>
  content = content.replace(/<\/motion\.div>/g, '</div>');
  
  // remove initial={...} animate={...} transition={...} exit={...} Custom={} variants={}
  // To safely do this, since they can span multiple lines, let's just 
  // It's safer to do this manually or via simpler regex
  
  fs.writeFileSync(file, content, 'utf-8');
});
console.log('done');
