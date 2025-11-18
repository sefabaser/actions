import fs from 'fs';
import path from 'path';

let dtsPath = path.join(process.cwd(), 'dist/index.d.ts');

if (!fs.existsSync(dtsPath)) {
  console.error('❌ "dist/index.d.ts" not found');
  process.exit(1);
}

let dts = fs.readFileSync(dtsPath, 'utf-8');

// Remove lines with private members starting with _
// Matches: private _, private static _, private readonly _, private get _, private set _, etc.
let cleaned = dts
  .split('\n')
  .filter(line => !line.trim().match(/^private\s+(?:static\s+|readonly\s+|get\s+|set\s+)*_/))
  .join('\n');

fs.writeFileSync(dtsPath, cleaned);
console.log('✅ The private members of "dist/index.d.ts" are cleaned.');

