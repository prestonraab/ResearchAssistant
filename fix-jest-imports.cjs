const fs = require('fs');
const path = require('path');
const glob = require('glob');

const files = glob.sync('packages/vscode-extension/src/**/__tests__/*.test.ts');
let count = 0;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes("from '@jest/globals'")) {
    const newContent = "import { jest } from '@jest/globals';\n" + content;
    fs.writeFileSync(file, newContent);
    count++;
    console.log(`Fixed: ${file}`);
  }
});

console.log(`\nAdded jest import to ${count} files`);
