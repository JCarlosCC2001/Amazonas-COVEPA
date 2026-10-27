// Barrera tipográfica: toda tipografía en línea (JSX) debe usar tokens del sistema.
//   fontFamily  -> 'var(--font-*)' o 'inherit'
//   fontSize    -> 'var(--text-*)'
//   fontWeight  -> 'var(--fw-*)'
// Uso: npm run check:typography           (informa)
//      npm run check:typography:strict    (falla el proceso si hay incumplimientos)
const fs = require('fs')
const path = require('path')

const strict = process.argv.includes('--strict')

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name)
    return d.isDirectory() ? walk(p) : p.endsWith('.jsx') ? [p] : []
  })
}

const RULES = [
  { name: 'fontFamily', re: /fontFamily\s*:\s*(?!['"`](?:var\(--font-|inherit))(?=\S)/g, hint: "var(--font-sans|mono)" },
  { name: 'fontSize', re: /fontSize\s*:\s*(?!['"`]var\(--text-)(?=['"`\d])/g, hint: "var(--text-*)" },
  { name: 'fontWeight', re: /fontWeight\s*:\s*(?!['"`]var\(--fw-)(?=['"`\d])/g, hint: "var(--fw-*)" },
]

let errors = 0
for (const f of walk('src')) {
  const txt = fs.readFileSync(f, 'utf8')
  const norm = f.replace(/\\/g, '/')
  for (const r of RULES) {
    const n = (txt.match(r.re) || []).length
    if (n) { console.log(`✖ ${norm}: ${n} ${r.name} sin token (usar ${r.hint})`); errors += n }
  }
}
if (errors && strict) { console.error(`Barrera tipográfica: ${errors} incumplimientos`); process.exit(1) }
console.log(errors ? `Advertencias: ${errors}` : 'Barrera tipográfica OK: toda la tipografía en línea usa tokens')
