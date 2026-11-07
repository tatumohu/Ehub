import fs from 'fs';

function cleanCorruptedKeys(file) {
    if(!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    
    // The broken keys look like: -${item.id}-${i}`} or }'  or }  
    // We can just use a regex to replace stray template literal tails inside JSX
    content = content.replace(/\s*-\$\{[^}]*\}\-\$\{[^}]*\}\`\}\n/g, '\n');
    content = content.replace(/\s*-\$\{[^}]*\}\`\}\n/g, '\n');
    content = content.replace(/\s*\`\}\n/g, '\n');
    content = content.replace(/\s*\}\n/g, '\n');

    fs.writeFileSync(file, content);
}

const files = [
  'src/pages/Home.tsx',
  'src/pages/Search.tsx',
  'src/pages/ProjectChat.tsx',
  'src/pages/Notifications.tsx',
  'src/pages/CompletedProjects.tsx',
  'src/pages/IdeaDetail.tsx',
  'src/pages/ProjectDetail.tsx',
  'src/pages/CreateIdea.tsx',
  'src/pages/Profile.tsx',
  'src/components/ShareModal.tsx',
  'src/components/AddMembersModal.tsx'
];

files.forEach(cleanCorruptedKeys);
