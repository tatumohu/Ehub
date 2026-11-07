import fs from 'fs';
import { execSync } from 'child_process';

let tscOutput = '';
try {
  execSync('npx tsc --noEmit', { stdio: 'pipe' });
} catch (e) {
  tscOutput = e.stdout.toString() + e.stderr.toString();
}

const lines = tscOutput.split('\n');
const insertions = {}; // file -> [{line, col, char}]

for (const line of lines) {
  // src/pages/Home.tsx(113,15): error TS1005: '}' expected.
  const match = line.match(/^([^()]+)\((\d+),(\d+)\): error TS[0-9]+: '([^']+)' expected\./);
  if (match) {
    const file = match[1];
    const row = parseInt(match[2]);
    const col = parseInt(match[3]);
    const char = match[4];
    
    if (char === '}' || char === ')' || char === '>' || char === ';' || char === ',') {
       if (!insertions[file]) insertions[file] = [];
       insertions[file].push({ row, col, char });
    }
  }
  
  // also handle "JSX element 'div' has no corresponding closing tag" and insert </div> at end?
  // Let's just do brace, paren, and semicolon insertion.
}

for (const file in insertions) {
  if (!fs.existsSync(file)) continue;
  let fileLines = fs.readFileSync(file, 'utf8').split('\n');
  
  // Sort descending by row and col
  insertions[file].sort((a, b) => {
    if (a.row === b.row) return b.col - a.col;
    return b.row - a.row;
  });

  // Track what we inserted at what row to avoid duplicates causing infinite loops if we run multiple passes
  const applied = new Set();
  
  for (const ins of insertions[file]) {
    const key = `${ins.row}-${ins.col}-${ins.char}`;
    if (applied.has(key)) continue;
    applied.add(key);

    const r = ins.row - 1;
    if (r >= fileLines.length || r < 0) {
      if (r === fileLines.length) fileLines.push(ins.char);
      continue;
    }

    const c = ins.col - 1;
    const currentLine = fileLines[r] || '';
    
    // insert character
    if (c >= currentLine.length) {
      fileLines[r] = currentLine + " " + ins.char;
    } else {
      fileLines[r] = currentLine.substring(0, c) + ins.char + currentLine.substring(c);
    }
  }
  
  fs.writeFileSync(file, fileLines.join('\n'));
  console.log(`Repaired ${file} with ${insertions[file].length} insertions`);
}
