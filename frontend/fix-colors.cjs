const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;

  // CSS replacements
  if (file.endsWith('index.css')) {
    content = content.replace(/background: rgba\(15, 21, 36, 0\.8\);/g, 'background: var(--bg-tertiary);');
    content = content.replace(/background: rgba\(255, 255, 255, 0\.01\);/g, 'background: var(--bg-glass-hover);');
    content = content.replace(/background: linear-gradient\(135deg, #fff 0%, #cbd5e1 100%\);\n\s*-webkit-background-clip/g, 'color: var(--text-primary);\n  /* background: linear-gradient... */\n  /* -webkit-background-clip');
    content = content.replace(/-webkit-text-fill-color: transparent;/g, '/* -webkit-text-fill-color: transparent; */');
    content = content.replace(/box-shadow: 10px 0 30px rgba\(0, 0, 0, 0\.7\);/g, 'box-shadow: 10px 0 30px rgba(0, 0, 0, 0.15);');
  }

  // TSX replacements
  if (file.endsWith('.tsx')) {
    content = content.replace(/color: '#fff'/g, "color: 'var(--text-primary)'");
    content = content.replace(/color="#fff"/g, 'color="var(--text-primary)"');
    content = content.replace(/background: 'rgba\(15, 21, 36, 0\.6\)'/g, "background: 'var(--bg-tertiary)'");
    content = content.replace(/background: 'rgba\(15,21,36,0\.3\)'/g, "background: 'var(--bg-glass)'");
    content = content.replace(/rgba\(15, 21, 36, 0\.4\)/g, "var(--bg-tertiary)");
    content = content.replace(/background: 'rgba\(255,255,255,0\.02\)'/g, "background: 'var(--bg-glass)'");
    content = content.replace(/background: 'rgba\(255,255,255,0\.01\)'/g, "background: 'var(--bg-glass)'");
    // Auth specific
    content = content.replace(/background: 'radial-gradient\(circle at 10% 20%, rgba\(139, 92, 246, 0\.08\) 0%, rgba\(8, 12, 22, 1\) 90%\)',/g, "background: 'var(--bg-body-gradient)',");
  }

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
