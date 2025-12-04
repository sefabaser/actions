import fs from 'fs';
import path from 'path';

let cwd = process.cwd();
let packageJsonPath = path.join(cwd, 'package.json');
let packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

let newPackageJson = {
  ...packageJson,
  main: packageJson.publishConfig?.main ?? packageJson.main,
  types: packageJson.publishConfig?.types ?? packageJson.types,
  module: packageJson.publishConfig?.module ?? packageJson.module,
  exports: packageJson.publishConfig?.exports ?? packageJson.exports,
};

try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(newPackageJson, undefined, 2));
} catch (e) {
  console.error('Failed to write package.json:', e);
}

