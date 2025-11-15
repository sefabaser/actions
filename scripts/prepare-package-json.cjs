const fs = require('fs');

const cwd = process.cwd();
const packageJson = require(`${cwd}/package.json`);

const newPackageJson = {
  ...packageJson,
  main: packageJson.publishConfig?.main ?? packageJson.main,
  types: packageJson.publishConfig?.types ?? packageJson.types,
  module: packageJson.publishConfig?.module ?? packageJson.module
};

try {
  fs.writeFileSync(`${cwd}/package.json`, JSON.stringify(newPackageJson, undefined, 2));
} catch (e) {
  console.error('Failed to write package.json:', e);
}
