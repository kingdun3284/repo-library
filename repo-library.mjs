#!/usr/bin/env node
// repo-library: generates the documentation block of the root AGENTS.md from document covers, and checks it.
// Specification: https://github.com/kingdun3284/repo-library
// Copy this file into a repository unchanged, and keep formatters and linters away from the copy.
//
// Usage, from anywhere inside the repository:
//   node <path to this file> write   regenerate the block
//   node <path to this file> check   fail when a cover is invalid or the block is out of date

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const EDITION = '1.0.0'
export const SPEC_URL = 'https://github.com/kingdun3284/repo-library'
export const BEGIN = '<!-- repo-library:begin -->'
export const END = '<!-- repo-library:end -->'
const COVER_KEYS = ['read-when', 'until']

// Every Markdown file git tracks or would track, so ignored and nested checkouts stay out.
export function listMarkdownFiles(root) {
  const output = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard', '--', '*.md'], {
    cwd: root,
    encoding: 'utf8',
  })
  return [...new Set(output.split('\0').filter(Boolean))].filter((file) => existsSync(path.join(root, file))).sort()
}

// Splits Markdown files into the documents that need a cover. A folder below docs/ with an AGENTS.md is a
// collection: its AGENTS.md is the cover, and its other files are items without covers.
export function classify(files) {
  const nested = files.filter((file) => file !== 'AGENTS.md' && path.posix.basename(file) === 'AGENTS.md')
  const collections = nested
    .filter((file) => file.startsWith('docs/') && file !== 'docs/AGENTS.md')
    .map((file) => `${path.posix.dirname(file)}/`)
  const isItem = (file) =>
    path.posix.basename(file) !== 'AGENTS.md' && collections.some((folder) => file.startsWith(folder))
  return {
    docs: files.filter((file) => file.startsWith('docs/') && !isItem(file)),
    folders: nested.filter((file) => !file.startsWith('docs/')),
  }
}

function unquote(raw) {
  if (raw.startsWith('"')) {
    if (raw.length < 2 || !raw.endsWith('"')) return { error: 'a double-quoted value must end with "' }
    return { value: raw.slice(1, -1).replace(/\\(["\\])/g, '$1') }
  }
  if (raw.startsWith("'")) {
    if (raw.length < 2 || !raw.endsWith("'")) return { error: "a single-quoted value must end with '" }
    return { value: raw.slice(1, -1).replace(/''/g, "'") }
  }
  if (/: |:$| #|^[-?:,[\]{}#&*!|>%@`]/.test(raw)) {
    return { error: 'quote this value with double quotes, because YAML would misread it' }
  }
  return { value: raw }
}

// Reads the front matter cover at the top of a document.
export function parseCover(text) {
  const lines = text.split(/\r?\n/)
  if (lines[0] !== '---') return { error: 'missing cover: the file must start with a --- front matter block' }
  const close = lines.indexOf('---', 1)
  if (close === -1) return { error: 'the cover is not closed with ---' }
  const fields = {}
  for (const line of lines.slice(1, close)) {
    if (line.trim() === '') continue
    const match = /^([a-z][a-z-]*):(?: (.*))?$/.exec(line)
    if (!match) return { error: `the cover line "${line}" is not a single-line "key: value"` }
    const [, key, raw = ''] = match
    if (!COVER_KEYS.includes(key)) return { error: `unknown cover key "${key}"; the keys are ${COVER_KEYS.join(', ')}` }
    if (key in fields) return { error: `the cover repeats "${key}"` }
    const { value, error } = unquote(raw.trim())
    if (error) return { error: `${key}: ${error}` }
    if (!value.trim()) return { error: `the cover's "${key}" is empty` }
    fields[key] = value.trim()
  }
  if (!fields['read-when']) return { error: 'the cover has no read-when' }
  return { fields }
}

export function rules(command) {
  return [
    `This repository follows repo-library ${EDITION} (${SPEC_URL}). The rules apply to every Markdown document under \`docs/\` and every \`AGENTS.md\` below the root.`,
    '',
    '- Before starting a task, read in full each document whose trigger in the catalog below matches it. When you open any other document, read its cover first and stop if its `read-when` does not match your task.',
    '- Documents describe only what is true now. Never record history, earlier states or decision dates; git keeps them. When a past event still constrains the present, state the constraint in the present tense with a one-line reason.',
    '- Keep each fact in one place and link to it from elsewhere. Never restate what code, scripts or configuration define; link to them.',
    "- Give each document one subject. A subject that grows item by item is a collection: a folder under `docs/` with one file per item and an `AGENTS.md` that holds the collection's cover and rules.",
    "- Put rules that apply only inside one folder in that folder's `AGENTS.md`.",
    '- Start every document under `docs/` and every `AGENTS.md` below the root, except collection items, with a cover: front matter with `read-when` and, only for a temporary document, `until`. Record nothing in a cover that git already records.',
    '- Write documents in the language this file declares and use the names it defines. Keep identifiers, commands, paths and quoted interface text as they are.',
    '- Track pending work and open questions in the issue tracker, never in documents or agent memory.',
    '- When the project owner states a rule for this repository, record it in the document that owns the subject, in the same change, not in agent memory.',
    `- After adding, moving or deleting a document or changing a cover, run \`${command} write\`. Never edit this block by hand.`,
  ]
}

function entryLine({ file, fields }) {
  const isCollection = file.startsWith('docs/') && path.posix.basename(file) === 'AGENTS.md'
  const shown = isCollection ? `${path.posix.dirname(file)}/` : file
  const trigger = fields['read-when'].replace(/\.$/, '')
  const until = fields.until ? ` (temporary, until: ${fields.until.replace(/\.$/, '')})` : ''
  return `- ${trigger}: [\`${shown}\`](${file})${until}`
}

export function renderBlock({ docs, folders, command }) {
  const lines = [
    BEGIN,
    `<!-- Generated by \`${command} write\` from document covers. Do not edit by hand. -->`,
    '',
    `## Documentation rules (repo-library ${EDITION})`,
    '',
    ...rules(command),
    '',
    '## Catalog',
  ]
  if (docs.length) {
    lines.push('', 'Read in full every document whose trigger matches your task before you start it.', '')
    lines.push(...docs.map(entryLine))
  }
  if (folders.length) {
    lines.push('', '### Folder rules', '', 'These apply inside their folder. Read them before changing files there.', '')
    lines.push(...folders.map(entryLine))
  }
  lines.push(END)
  return lines.join('\n')
}

export function replaceBlock(text, block) {
  const begin = text.indexOf(BEGIN)
  const end = text.indexOf(END)
  if (begin === -1 || end === -1 || end < begin) {
    return { error: `add the lines ${BEGIN} and ${END}, in that order, where the block belongs` }
  }
  if (text.indexOf(BEGIN, begin + 1) !== -1 || text.indexOf(END, end + 1) !== -1) {
    return { error: 'the block markers appear more than once' }
  }
  return { text: text.slice(0, begin) + block + text.slice(end + END.length) }
}

// Builds the new AGENTS.md text for the repository at root, or lists what prevents it.
export function generate(root, scriptPath) {
  const errors = []
  const covered = (files) =>
    files.flatMap((file) => {
      const { fields, error } = parseCover(readFileSync(path.join(root, file), 'utf8'))
      if (error) {
        errors.push(`${file}: ${error}`)
        return []
      }
      return [{ file, fields }]
    })
  const { docs, folders } = classify(listMarkdownFiles(root))
  const command = `node ${path.relative(root, scriptPath).split(path.sep).join('/')}`
  const block = renderBlock({ docs: covered(docs), folders: covered(folders), command })
  const entryPath = path.join(root, 'AGENTS.md')
  if (!existsSync(entryPath)) return { errors: [...errors, 'AGENTS.md: there is no AGENTS.md at the repository root'], command }
  const current = readFileSync(entryPath, 'utf8')
  const { text, error } = replaceBlock(current, block)
  if (error) errors.push(`AGENTS.md: ${error}`)
  return { current, text, errors, command, entryPath }
}

export function main(mode, cwd = process.cwd()) {
  if (mode !== 'write' && mode !== 'check') {
    console.error('usage: node repo-library.mjs <write|check>')
    return 2
  }
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8' }).trim()
  const { current, text, errors, command, entryPath } = generate(root, realpathSync(fileURLToPath(import.meta.url)))
  if (errors.length) {
    for (const error of errors) console.error(`repo-library: ${error}`)
    return 1
  }
  if (mode === 'write') {
    if (text !== current) writeFileSync(entryPath, text)
    console.log(`repo-library: ${text === current ? 'AGENTS.md is already up to date' : 'updated AGENTS.md'}`)
    return 0
  }
  if (text !== current) {
    console.error(`repo-library: the block in AGENTS.md is out of date; run \`${command} write\``)
    return 1
  }
  console.log('repo-library: covers and catalog are up to date')
  return 0
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  process.exitCode = main(process.argv[2])
}
