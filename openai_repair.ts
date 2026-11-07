import fs from 'fs';
import { generateText } from './lib/openai';

async function fixFiles() {
  
  const files = [
    'src/components/AddMembersModal.tsx',
    'src/components/ShareModal.tsx',
    'src/pages/CompletedProjects.tsx',
    'src/pages/CreateIdea.tsx',
    'src/pages/Home.tsx',
    'src/pages/IdeaDetail.tsx',
    'src/pages/Notifications.tsx',
    'src/pages/Profile.tsx',
    'src/pages/ProjectChat.tsx',
    'src/pages/ProjectDetail.tsx',
    'src/pages/Search.tsx'
  ];

  for (const file of files) {
    if (!fs.existsSync(file)) continue;
    
    // Some files might be too mangled or have too many insertions from my auto_repair script.
    // Wait, the auto_repair script corrupted them further. Is there a way to undo? No.
    // I can just pass the current content and ask OpenAI to fix the syntax.
    
    let content = fs.readFileSync(file, 'utf8');
    
    console.log(`Sending ${file} to OpenAI to fix syntax...`);
    
    try {
      const response = { text: await generateText( `You are an expert TypeScript React developer. \nA regex search-and-replace accidentally removed closing braces '}' mostly on their own lines, broke JSX components (like <motion.div>), and caused hundreds of syntax errors. I tried to use an automated script to insert '}' but it made it worse with stray characters. \n\nPlease fix all syntax errors, unbalanced braces, broken tags, and return ONLY the completely fixed raw code. Do NOT wrap in markdown \`\`\`tsx ... \`\`\`. Start immediately with the code. Do not apologize or explain. This must compile cleanly via tsc.\n\nCode of ${file}:\n\n${content}`
      ) };
      
      let fixed = response.text;
      if (fixed.startsWith('\`\`\`tsx')) {
        fixed = fixed.replace(/^\`\`\`tsx\n/, '').replace(/\n\`\`\`$/, '');
      } else if (fixed.startsWith('\`\`\`')) {
        fixed = fixed.replace(/^\`\`\`\n/, '').replace(/\n\`\`\`$/, '');
      }
      
      fs.writeFileSync(file, fixed.trim() + '\n');
      console.log(`Successfully repaired ${file}`);
    } catch (e) {
       console.error(`Failed on ${file}`, e.message);
    }
  }
}

fixFiles();
