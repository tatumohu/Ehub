import fs from 'fs';

const files = [
  'src/pages/CompletedDetail.tsx',
  'src/pages/IdeaDetail.tsx',
  'src/pages/ProjectDetail.tsx'
];

for (const file of files) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf-8');
    
    // Remove the status check block from handleBackProject
    content = content.replace(
      /\/\/ Check if user has connected Stripe\s*try {\s*const statusRes = await fetch\(`\/api\/stripe\/status\?user_id=\$\{user\.id\}`\);[\s\S]*?console\.error\('Failed to check stripe status', e\);\s*}\n/g,
      ''
    );
    
    // Remove the status check block from buyout onClick
    content = content.replace(
      /\/\/ Check if user has connected Stripe\s*try {\s*const statusRes = await fetch\(`\/api\/stripe\/status\?user_id=\$\{user\?\.id\}`\);[\s\S]*?console\.error\('Failed to check stripe status', e\);\s*}\n/g,
      ''
    );
    
    fs.writeFileSync(file, content);
  }
}
