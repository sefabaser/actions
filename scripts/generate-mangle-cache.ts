import * as fs from 'fs';
import * as path from 'path';
import { ManglePrefix } from './config';

const srcDir = './src';
const outputFile = './mangle-cache.json';

function scanForUnderscoreProps(dir: string): Set<string> {
  let props = new Set<string>();
  let regex = /[.[]_([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

  function scan(directory: string) {
    fs.readdirSync(directory).forEach(file => {
      let fullPath = path.join(directory, file);
      let stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        scan(fullPath);
      } else if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
        let content = fs.readFileSync(fullPath, 'utf-8');
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          props.add('_' + match[1]);
        }
      }
    });
  }

  scan(dir);
  return props;
}

let props = Array.from(scanForUnderscoreProps(srcDir)).sort();
let cache: Record<string, string> = {};

props.forEach((prop, index) => {
  let name = '';
  let i = index;
  do {
    name = String.fromCharCode(97 + (i % 26)) + name;
    i = Math.floor(i / 26) - 1;
  } while (i >= 0);
  cache[prop] = ManglePrefix + name;
});

fs.writeFileSync(outputFile, JSON.stringify(cache, undefined, 2));
console.log(`✅ Generated mangle cache with ${props.length} properties.`);
