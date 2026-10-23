// Fails when the source breaks a design system rule that a pattern can catch
// (frontend/design-system/README.md, "Rules that never break"). Runs with `npm run lint`.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const targets = ['src', 'index.html']
const extensions = new Set(['.ts', '.tsx', '.css', '.html'])

const SMALL_SIZE = /\b(?:size|w|h)-(?:px|0\.5|1|1\.5|2|2\.5|3)\b/

const rules = [
  { name: 'em dash (use a comma, a period or two sentences)', test: (line) => /[—―]/.test(line) },
  { name: 'dot separator between data', test: (line) => /[·•∙]/.test(line) },
  { name: 'emoji (use an icon)', test: (line) => /\p{Extended_Pictographic}/u.test(line) },
  { name: 'separator or side line (border on one side)', test: (line) => /\bborder-[lrtbxyse](?![a-z])/.test(line) },
  { name: 'separator line (border on one side, CSS)', test: (line) => /\bborder-(?:left|right|top|bottom|inline|block)\b/.test(line) },
  { name: 'divider between rows', test: (line) => /\bdivide-[xy]\b/.test(line) },
  { name: 'horizontal rule', test: (line) => /<hr\b/i.test(line) },
  { name: 'uppercase label (sentence case only)', test: (line) => /\buppercase\b/.test(line) },
  { name: 'monospace font (Geist with tabular figures only)', test: (line) => /\bfont-mono\b|\bmonospace\b|Geist Mono/.test(line) },
  { name: 'round shape (status dots and circles are not allowed)', test: (line) => /\brounded-full\b/.test(line) },
  { name: 'small round status dot', test: (line) => /\brounded-pill\b/.test(line) && SMALL_SIZE.test(line) },
]

function files(path) {
  const full = join(root, path)
  if (statSync(full).isFile()) return [full]
  return readdirSync(full).flatMap((name) => files(join(path, name)))
}

const findings = []
for (const file of targets.flatMap(files)) {
  if (!extensions.has(extname(file))) continue
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .forEach((line, i) => {
      for (const rule of rules) {
        if (rule.test(line)) findings.push(`${relative(root, file)}:${i + 1}  ${rule.name}\n    ${line.trim()}`)
      }
    })
}

if (findings.length) {
  console.error(`Design rules: ${findings.length} finding(s)\n`)
  console.error(findings.join('\n'))
  process.exit(1)
}
console.log('Design rules: no findings')
