// build_all.js
const fs = require('fs');
const path = require('path');

const root = 'C:\\Users\\NuevoAdmin\\.gemini\\antigravity\\scratch\\sistema-escolar';
const pub = path.join(root, 'public');

// 1. Copy public/index.html -> root index.html
fs.copyFileSync(path.join(pub, 'index.html'), path.join(root, 'index.html'));
console.log('Copied public/index.html to root index.html');

// 2. Ensure root css/ and js/ directories exist and copy assets
const copyDir = (src, dest) => {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const sPath = path.join(src, f);
    const dPath = path.join(dest, f);
    if (fs.statSync(sPath).isDirectory()) {
      copyDir(sPath, dPath);
    } else {
      fs.copyFileSync(sPath, dPath);
    }
  }
};

copyDir(path.join(pub, 'css'), path.join(root, 'css'));
copyDir(path.join(pub, 'js'), path.join(root, 'js'));
console.log('Copied public/css and public/js to root css and js');

// 3. Generate Single-File Standalone HTML
const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(pub, 'css', 'styles.css'), 'utf8');
const xlsxJs = fs.readFileSync(path.join(pub, 'js', 'xlsx.full.min.js'), 'utf8');
const offlineDbJs = fs.readFileSync(path.join(pub, 'js', 'offline-db.js'), 'utf8');
const appJs = fs.readFileSync(path.join(pub, 'js', 'app.js'), 'utf8');

// Replace external references with inline content
let standalone = html;
standalone = standalone.replace(
  '<link rel="stylesheet" href="css/styles.css">',
  '<style>\n' + css + '\n</style>'
);
standalone = standalone.replace(
  /<script src="js\/xlsx\.full\.min\.js"><\/script>\s*<!--[^>]*-->\s*<script src="js\/offline-db\.js"><\/script>\s*<script src="js\/app\.js"><\/script>/,
  '<script>\n' + xlsxJs + '\n</script>\n<script>\n' + offlineDbJs + '\n</script>\n<script>\n' + appJs + '\n</script>'
);

const desktopAppRapida = 'C:\\Users\\NuevoAdmin\\Desktop\\TuProfeWeb_App_Rapida.html';
fs.writeFileSync(desktopAppRapida, standalone, 'utf8');
console.log('Generated standalone:', desktopAppRapida, 'Size:', standalone.length);

const desktopCompleta = 'C:\\Users\\NuevoAdmin\\Desktop\\TuProfeWeb_Completa.html';
fs.writeFileSync(desktopCompleta, standalone, 'utf8');
console.log('Generated standalone:', desktopCompleta);

fs.writeFileSync(path.join(root, 'TuProfeWeb_Completa.html'), standalone, 'utf8');
console.log('Build completed successfully!');
