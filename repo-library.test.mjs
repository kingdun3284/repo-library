import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { after, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { BEGIN, END, classify, main, parseCover, renderBlock, replaceBlock } from './repo-library.mjs'

const script = fileURLToPath(new URL('./repo-library.mjs', import.meta.url))
const roots = []
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function repository(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'repo-library-'))
  roots.push(root)
  execFileSync('git', ['init', '-q'], { cwd: root })
  for (const [file, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), text)
  }
  return root
}

function run(root, mode) {
  try {
    return { code: 0, output: execFileSync('node', [script, mode], { cwd: root, encoding: 'utf8', stdio: 'pipe' }) }
  } catch (error) {
    return { code: error.status, output: `${error.stdout}${error.stderr}` }
  }
}

const cover = (readWhen, until) => `---\nread-when: ${readWhen}\n${until ? `until: ${until}\n` : ''}---\n\n# Title\n`

test('a cover yields its read-when and until', () => {
  assert.deepEqual(parseCover(cover('Before changing the API.', 'The old API is removed.')), {
    fields: { 'read-when': 'Before changing the API.', until: 'The old API is removed.' },
  })
})

test('a document without front matter has no cover', () => {
  assert.match(parseCover('# Title\n').error, /missing cover/)
})

test('a cover needs read-when', () => {
  assert.match(parseCover('---\nuntil: Later.\n---\n').error, /no read-when/)
})

test('a cover accepts only the known keys', () => {
  assert.match(parseCover('---\nread-when: Always.\nupdated: 2026-01-01\n---\n').error, /unknown cover key "updated"/)
})

test('a cover rejects a repeated key', () => {
  assert.match(parseCover('---\nread-when: A.\nread-when: B.\n---\n').error, /repeats "read-when"/)
})

test('a plain value that YAML would misread must be quoted', () => {
  assert.match(parseCover(cover('Before deploys: API only.')).error, /quote this value/)
  assert.deepEqual(parseCover(cover('"Before deploys: API only."')).fields, { 'read-when': 'Before deploys: API only.' })
  assert.deepEqual(parseCover(cover("'It''s: quoted.'")).fields, { 'read-when': "It's: quoted." })
})

test('collection items need no cover, and folder rules outside docs are listed separately', () => {
  const files = [
    'AGENTS.md',
    'README.md',
    'docs/guide.md',
    'docs/parity/AGENTS.md',
    'docs/parity/receipt.md',
    'patches/AGENTS.md',
    'patches/README.md',
  ]
  assert.deepEqual(classify(files), {
    docs: ['docs/guide.md', 'docs/parity/AGENTS.md'],
    folders: ['patches/AGENTS.md'],
  })
})

test('the catalog shows each trigger with its document, a collection as its folder, and until when set', () => {
  const block = renderBlock({
    docs: [
      { file: 'docs/guide.md', fields: { 'read-when': 'Before changing anything.' } },
      { file: 'docs/parity/AGENTS.md', fields: { 'read-when': 'When porting a feature.', until: 'The port ends.' } },
    ],
    folders: [{ file: 'patches/AGENTS.md', fields: { 'read-when': 'When changing a patch.' } }],
    command: 'node scripts/repo-library.mjs',
  })
  assert.ok(block.startsWith(BEGIN) && block.endsWith(END))
  assert.match(block, /^- Before changing anything: \[`docs\/guide\.md`\]\(docs\/guide\.md\)$/m)
  assert.match(
    block,
    /^- When porting a feature: \[`docs\/parity\/`\]\(docs\/parity\/AGENTS\.md\) \(temporary, until: The port ends\)$/m,
  )
  assert.match(block, /### Folder rules[\s\S]*- When changing a patch: \[`patches\/AGENTS\.md`\]/)
  assert.match(block, /run `node scripts\/repo-library\.mjs write`/)
})

test('the block replaces only the text between the markers', () => {
  assert.deepEqual(replaceBlock(`intro\n${BEGIN}\nold\n${END}\noutro\n`, `${BEGIN}\nnew\n${END}`), {
    text: `intro\n${BEGIN}\nnew\n${END}\noutro\n`,
  })
  assert.match(replaceBlock('no markers', 'x').error, /add the lines/)
  assert.match(replaceBlock(`${BEGIN}${END}${BEGIN}${END}`, 'x').error, /more than once/)
})

test('write fills the block from the covers and check then passes', () => {
  const root = repository({
    'AGENTS.md': `# Agent instructions\n\n${BEGIN}\n${END}\n`,
    'docs/guide.md': cover('Before changing anything.'),
  })
  assert.equal(run(root, 'check').code, 1)
  assert.equal(run(root, 'write').code, 0)
  const text = readFileSync(path.join(root, 'AGENTS.md'), 'utf8')
  assert.match(text, /^# Agent instructions\n\n<!-- repo-library:begin -->/)
  assert.match(text, /- Before changing anything: \[`docs\/guide\.md`\]/)
  assert.deepEqual(run(root, 'check'), { code: 0, output: 'repo-library: covers and catalog are up to date\n' })
})

test('check fails on an invalid cover and names the file', () => {
  const root = repository({
    'AGENTS.md': `${BEGIN}\n${END}\n`,
    'docs/guide.md': '# No cover\n',
  })
  const result = run(root, 'check')
  assert.equal(result.code, 1)
  assert.match(result.output, /docs\/guide\.md: missing cover/)
})

test('check fails when a cover changed after the block was written', () => {
  const root = repository({
    'AGENTS.md': `${BEGIN}\n${END}\n`,
    'docs/guide.md': cover('Before changing anything.'),
  })
  run(root, 'write')
  writeFileSync(path.join(root, 'docs/guide.md'), cover('Before changing the guide.'))
  const result = run(root, 'check')
  assert.equal(result.code, 1)
  assert.match(result.output, /out of date/)
})

test('ignored files stay out of the catalog', () => {
  const root = repository({
    '.gitignore': 'docs/private/\n',
    'AGENTS.md': `${BEGIN}\n${END}\n`,
    'docs/guide.md': cover('Before changing anything.'),
    'docs/private/notes.md': '# No cover\n',
  })
  assert.equal(run(root, 'write').code, 0)
  assert.doesNotMatch(readFileSync(path.join(root, 'AGENTS.md'), 'utf8'), /private/)
})

test('an unknown command prints the usage', () => {
  assert.equal(main('list'), 2)
})
