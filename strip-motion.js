import { Project, SyntaxKind } from 'ts-morph';
import fs from 'fs';

const project = new Project();
const files = [
  'src/pages/IdeaDetail.tsx',
  'src/pages/ProjectDetail.tsx',
  'src/pages/CreateIdea.tsx'
];

files.forEach(f => {
  const sourceFile = project.addSourceFileAtPath(f);
  
  // Find all JsxOpeningElement and JsxSelfClosingElement
  const elements = [
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement),
    ...sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement)
  ];
  
  elements.forEach(element => {
    const tagNameNode = element.getTagNameNode();
    if (tagNameNode.getText() === 'motion.div') {
      // Create text for 'div' to replace 'motion.div'
      tagNameNode.replaceWithText('div');
      
      // Remove specific attributes
      const propsToRemove = ['initial', 'animate', 'exit', 'transition', 'variants', 'custom', 'drag', 'dragElastic', 'dragConstraints', 'onDragEnd', 'layoutId'];
      propsToRemove.forEach(propName => {
        const attribute = element.getAttribute(propName);
        if (attribute) {
          attribute.remove();
        }
      });
    }
  });

  // Find all JsxClosingElement to replace </motion.div>
  const closingElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxClosingElement);
  closingElements.forEach(element => {
    const tagNameNode = element.getTagNameNode();
    if (tagNameNode.getText() === 'motion.div') {
      tagNameNode.replaceWithText('div');
    }
  });

  sourceFile.saveSync();
});

console.log('Successfully stripped motion out using ts-morph.');
