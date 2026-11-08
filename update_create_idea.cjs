const fs = require('fs');
let content = fs.readFileSync('src/pages/CreateIdea.tsx', 'utf8');

content = content.replace(
  `const quoteType = searchParams.get('quoteType');`,
  `const quoteType = searchParams.get('quoteType');\n  const editMode = searchParams.get('editMode') === 'true';`
);

content = content.replace(
  `          setQuotedItem(data);
          if (data && data.is_private === 1) {`,
  `          setQuotedItem(data);
          if (editMode && data) {
            setTitle(data.title || '');
            setDescription(data.description || '');
            setImage(data.image || '');
            if (data.tags) {
              try {
                const parsedTags = JSON.parse(data.tags);
                setTags(Array.isArray(parsedTags) && parsedTags.length > 0 ? '#' + parsedTags.join(' #') : '#');
              } catch(e) {
                setTags(data.tags);
              }
            }
          }
          if (data && data.is_private === 1) {`
);

fs.writeFileSync('src/pages/CreateIdea.tsx', content);
