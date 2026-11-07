const fs = require('fs');

function patchFile(file) {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(
    /new Date\(([\w\.\?]+latest_idea_at)\)/g,
    "new Date(($1 || '') + (!($1 || '').includes('Z') ? 'Z' : ''))"
  );
  // safeFormatDistance uses dateStr argument
  code = code.replace(
    /const date = new Date\(dateStr\);/g,
    "const date = new Date((dateStr || '') + (!(dateStr || '').includes('Z') ? 'Z' : ''));"
  );
  fs.writeFileSync(file, code);
}

const files = [
  'src/pages/Home.tsx',
  'src/pages/IdeaDetail.tsx',
  'src/pages/CompletedDetail.tsx',
  'src/pages/ProjectDetail.tsx',
  'src/pages/Search.tsx',
  'src/pages/ListView.tsx',
  'src/pages/CompletedProjects.tsx',
  'src/pages/Notifications.tsx',
  'src/pages/PurchaseHistory.tsx',
  'src/pages/ChatList.tsx',
  'src/pages/ProjectChat.tsx',
  'src/components/IdeaQuotesModal.tsx',
  'src/components/IdeaQuotesList.tsx'
];

files.forEach(patchFile);
