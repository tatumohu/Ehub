import { Project } from 'ts-morph';
import path from 'path';
import fs from 'fs';

const project = new Project();
const srcDir = path.join(process.cwd(), 'src');

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

const files = getAllFiles(srcDir);

files.forEach(f => {
  const sourceFile = project.addSourceFileAtPath(f);
  let changed = false;
  
  const imports = sourceFile.getImportDeclarations();
  imports.forEach(i => {
    if (i.getModuleSpecifierValue() === 'motion/react' || i.getModuleSpecifierValue() === 'framer-motion') {
      i.remove();
      changed = true;
    }
  });

  if (changed) {
    sourceFile.saveSync();
    console.log('Removed import in', f);
  }
});
