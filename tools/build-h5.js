const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'src/main.js');
const outDir = path.join(root, 'dist/h5');

function moduleId(file) {
  return `/${path.relative(root, file).replace(/\\/g, '/')}`;
}

function resolveModule(from, request) {
  const base = path.resolve(path.dirname(from), request);
  return path.extname(base) ? base : `${base}.js`;
}

function collectModules(file, modules) {
  if (modules.has(file)) return;
  const source = fs.readFileSync(file, 'utf8');
  modules.set(file, source);
  const requirePattern = /require\(['"](.+?)['"]\)/g;
  let match;
  while ((match = requirePattern.exec(source))) {
    if (!match[1].startsWith('.')) continue;
    collectModules(resolveModule(file, match[1]), modules);
  }
}

function bundle() {
  const modules = new Map();
  collectModules(entry, modules);
  const factories = Array.from(modules.entries()).map(([file, source]) => {
    return `${JSON.stringify(moduleId(file))}: new Function('module', 'exports', 'require', ${JSON.stringify(source)})`;
  }).join(',\n');

  return `(function(){
  const factories = {${factories}};
  const cache = {};
  function normalize(value) {
    const parts = [];
    value.split('/').forEach((part) => {
      if (!part || part === '.') return;
      if (part === '..') parts.pop(); else parts.push(part);
    });
    return '/' + parts.join('/');
  }
  function load(id) {
    if (cache[id]) return cache[id].exports;
    if (!factories[id]) throw new Error('Missing H5 module: ' + id);
    const module = { exports: {} };
    cache[id] = module;
    const localRequire = (request) => {
      const base = id.slice(0, id.lastIndexOf('/') + 1);
      return load(normalize(base + request + (request.endsWith('.js') ? '' : '.js')));
    };
    factories[id](module, module.exports, localRequire);
    return module.exports;
  }
  load('/src/main.js');
})();\n`;
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });
fs.copyFileSync(path.join(root, 'web/index.html'), path.join(outDir, 'index.html'));
fs.copyFileSync(path.join(root, 'web/runtime.js'), path.join(outDir, 'runtime.js'));
fs.copyFileSync(path.join(root, 'assets/dream-post-office-hall.webp'), path.join(outDir, 'assets/dream-post-office-hall.webp'));
fs.writeFileSync(path.join(outDir, 'game.bundle.js'), bundle());
console.log(`Built H5 game: ${outDir}`);
