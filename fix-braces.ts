import fs from 'fs';
import path from 'path';

function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Find dangling '}' that were left behind by broken `exit={{...}}` removal
  // A pattern like:
  // initial={{ opacity: 0 }}
  // animate={{ opacity: 1 }}
  // }
  // className="..."
  
  // We can just look for lines that contain only optional spaces followed by '}' and inside `<motion.div` contexts.
  // Actually, replacing `\n\s*\}\n\s*className=` with `\n          className=` 
  content = content.replace(/\n\s*\}\n/g, '\n');
  content = content.replace(/\n\s*\}\s*className=/g, '\nclassName=');
  content = content.replace(/\n\s*\}\s*onClick=/g, '\nonClick=');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${filePath}`);
  }
}

const files = [
  'src/pages/Profile.tsx',
  'src/pages/ProjectChat.tsx',
  'src/pages/ProjectDetail.tsx',
  'src/pages/CreateIdea.tsx',
  'src/pages/IdeaDetail.tsx',
  'src/components/ShareModal.tsx',
  'src/components/AddMembersModal.tsx',
  'src/pages/Home.tsx',
  'src/pages/Search.tsx',
  'src/pages/Notifications.tsx',
  'src/pages/CompletedProjects.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) fixFile(f);
});
