import fs from 'fs';
import path from 'path';

let targetFiles = ['index.d.ts', 'index.d.mts'];

targetFiles.forEach(fileName => {
  let filePath = path.join(process.cwd(), 'dist', fileName);

  if (fs.existsSync(filePath)) {
    let fileContents = fs.readFileSync(filePath, 'utf-8');

    // Remove lines with private members starting with _
    // Matches: private _, private static _, private readonly _, private get _, private set _, etc.
    let cleaned = fileContents
      .split('\n')
      .filter(line => !line.trim().match(/^private\s+(?:static\s+|readonly\s+|get\s+|set\s+)*_/))
      .join('\n');

    fs.writeFileSync(filePath, cleaned);
    console.log(`✅ The private members of "dist/${fileName}" are cleaned.`);
  }
});

