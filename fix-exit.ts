import fs from 'fs';

function processFile(path) {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');
  let original = content;

  // Remove `exit={...}` props
  content = content.replace(/exit=\{[^}]*\}/g, '');
  // Because it could be multiline: exit={{ opacity: 0 }}
  content = content.replace(/exit=\{\{[^}]*\}\}/g, '');

  if (content !== original) {
    fs.writeFileSync(path, content);
    console.log(`Updated ${path}`);
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
  'src/pages/Home.tsx'
];

files.forEach(f => processFile(f));
