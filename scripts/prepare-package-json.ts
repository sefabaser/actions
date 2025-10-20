let fs = require('fs');

let cwd = process.cwd();
let packageJson = require(`${cwd}/package.json`);

let newPackageJson = {
  ...packageJson,
  main: packageJson.publishConfig?.main ?? packageJson.main,
  types: packageJson.publishConfig?.types ?? packageJson.types,
  module: packageJson.publishConfig?.module ?? packageJson.module
};

try {
  fs.writeFileSync(`${cwd}/package.json`, JSON.stringify(newPackageJson, undefined, 2));
} catch (e) {}
