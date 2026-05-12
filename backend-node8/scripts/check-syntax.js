'use strict';

const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const files = [path.join(rootDir, 'server.js')]
  .concat(findJavaScriptFiles(path.join(rootDir, 'src')))
  .concat(findJavaScriptFiles(path.join(rootDir, 'scripts')));
let failed = false;

files.forEach(function (file) {
  const result = childProcess.spawnSync(process.execPath, ['--check', file], {
    stdio: 'inherit'
  });

  if (result.status !== 0) {
    failed = true;
  }
});

if (failed) {
  process.exit(1);
}

console.log('Checked ' + files.length + ' JavaScript files.');

function findJavaScriptFiles(dir) {
  let results = [];

  fs.readdirSync(dir).forEach(function (entry) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      results = results.concat(findJavaScriptFiles(fullPath));
      return;
    }

    if (/\.js$/.test(entry)) {
      results.push(fullPath);
    }
  });

  return results;
}
