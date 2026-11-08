import fs from 'fs';
import path from 'path';

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8');
  content = content.replace(/from\s+['"]framer-motion['"]/g, "from 'motion/react'");
  fs.writeFileSync(filePath, content, 'utf-8');
}

const files = [
  'src/pages/Profile.tsx',
  'src/pages/Search.tsx',
  'src/pages/ProjectChat.tsx',
  'src/pages/Notifications.tsx',
  'src/pages/ProjectDetail.tsx',
  'src/pages/CreateIdea.tsx',
  'src/pages/Home.tsx',
  'src/pages/CompletedProjects.tsx',
  'src/pages/IdeaDetail.tsx',
  'src/components/ShareModal.tsx',
  'src/components/AddMembersModal.tsx'
];

files.forEach(f => replaceInFile(path.join(process.cwd(), f)));
console.log("Done replacing framer-motion with motion/react");
