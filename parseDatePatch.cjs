const fs = require('fs');

function patchFile(file) {
  if (!fs.existsSync(file)) return;
  let code = fs.readFileSync(file, 'utf8');
  // Only patch if we can safely do it. 
  // Let's replace `new Date(X.created_at)` with `new Date((X.created_at || '') + (!(X.created_at || '').includes('Z') ? 'Z' : ''))`
  code = code.replace(
    /new Date\(([\w\.\?]+created_at)\)/g,
    "new Date(($1 || '') + (!($1 || '').includes('Z') ? 'Z' : ''))"
  );
  code = code.replace(
    /new Date\(([\w\.\?]+created_at)\s*\|\|\s*['"]['"]\)/g,
    "new Date(($1 || '') + (!($1 || '').includes('Z') ? 'Z' : ''))"
  );
  code = code.replace(
    /new Date\(([\w\.\?]+created_at)\s*\|\|\s*0\)/g,
    "new Date(($1 || '') + (!($1 || '').includes('Z') ? 'Z' : ''))"
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
  'src/components/IdeaQuotesList.tsx',
  'src/components/BuyoutPostModal.tsx'
];

files.forEach(patchFile);
