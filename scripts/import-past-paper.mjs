/**
 * Imports an FPSC MPT past-paper PDF into the question bank.
 *
 *   node scripts/import-past-paper.mjs --pdf ./MPT-2027.pdf --label "MPT 2027" [--skip 21-40,58-72] [--dry]
 *
 * The PDFs published by cssaspirants.pk mark the correct option in bold, so the
 * answer key is read from the font each option is rendered in. A paper whose
 * options are all one font carries no key and is rejected rather than guessed at.
 *
 * Lessons for a label that already exists are replaced, so re-running is safe.
 */
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'questions', 'past-papers')
const PAGE_EDGE = 588 // pt — text rendered past this is clipped by the page margin
const PER_LESSON = 10

const SECTION_TO_UNIT = {
  ENGLISH: 'english',
  'GENERAL ABILITIES': 'general-abilities',
  'GENERAL KNOWLEDGE': 'general-knowledge',
  'ISLAMIC STUDIES': 'islamic-studies',
  URDU: 'urdu',
}

const NOISE =
  /(cssaspirants\.pk|WhatsApp|^Page \d+ of \d+$|^FPSC MPT CSS-|FEDERAL PUBLIC SERVICE|MCQ-BASED PRELIMINARY|COMPETITIVE EXAMINATION|TOTAL MARKS|^NOTE:|Original FPSC MPT paper|those items have been prepared|MCQs, \d+ minutes|All remaining questions|compiled from the published|^Attempt in$|exam conditions)/i
const SECTION = /^([A-Z][A-Z '&/()-]{4,}?)\s*(?:\(.*?\))?\s*\(Marks\s*=\s*\d+\)\s*$/
const BARE_SECTION = new RegExp(`^(${Object.keys(SECTION_TO_UNIT).join('|')})\\s*$`)

function args() {
  const out = {}
  for (let i = 2; i < process.argv.length; i++) {
    const key = process.argv[i]
    if (!key.startsWith('--')) continue
    const next = process.argv[i + 1]
    out[key.slice(2)] = !next || next.startsWith('--') ? true : (i++, next)
  }
  return out
}

/** "21-40,58" → predicate over question numbers the publisher did not source from FPSC. */
function parseSkip(spec) {
  if (!spec) return () => false
  const ranges = String(spec)
    .split(',')
    .map((part) => part.split('-').map(Number))
  return (n) => ranges.some(([from, to]) => n >= from && n <= (to ?? from))
}

function splitOptions(items) {
  const segments = []
  for (const item of items) {
    const parts = item.str.split(/(?=\([a-d]\)\s)/)
    let cursor = item.x
    for (const part of parts) {
      const share = item.str.length ? (part.length / item.str.length) * item.width : 0
      const marker = part.match(/^\(([a-d])\)\s*/)
      if (marker) {
        segments.push({ text: part.slice(marker[0].length), font: item.font, end: cursor + share })
      } else if (segments.length) {
        const last = segments[segments.length - 1]
        last.text += part
        last.end = cursor + share
      }
      cursor += share
    }
  }
  return segments
}

async function readLines(file) {
  const pdf = await getDocument({ data: new Uint8Array(readFileSync(file)), useSystemFonts: true }).promise
  const lines = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const { items } = await page.getTextContent()
    let current = null
    for (const item of items) {
      if (!item.str) continue
      const y = Math.round(item.transform[5])
      if (!current || Math.abs(current.y - y) > 3) {
        if (current) lines.push(current)
        current = { y, items: [] }
      }
      current.items.push({ str: item.str, font: item.fontName, x: item.transform[4], width: item.width })
    }
    if (current) lines.push(current)
  }
  return lines.map((line) => ({ ...line, text: line.items.map((i) => i.str).join('').trim() }))
}

function parsePaper(lines) {
  const questions = []
  let section = null
  let directive = null
  let q = null
  let sawOption = false

  const flush = () => {
    if (q && q.options.length) questions.push(q)
    q = null
  }

  for (const line of lines) {
    const text = line.text
    if (!text || NOISE.test(text)) continue

    const heading = text.match(SECTION) || text.match(BARE_SECTION)
    if (heading) {
      flush()
      section = heading[1].trim()
      directive = null
      sawOption = false
      continue
    }

    const start = text.match(/^(\d{1,3})\.\s*(.*)$/)
    if (start) {
      flush()
      q = { number: Number(start[1]), section, directive, prompt: start[2].trim(), options: [] }
      sawOption = false
      if (/^\([a-d]\)\s/.test(q.prompt)) {
        const offset = line.items.findIndex((i) => /\([a-d]\)/.test(i.str))
        q.options.push(...splitOptions(line.items.slice(offset < 0 ? 0 : offset)))
        q.prompt = ''
        sawOption = true
      }
      continue
    }

    if (/^\([a-d]\)\s/.test(text)) {
      if (q) {
        q.options.push(...splitOptions(line.items))
        sawOption = true
      }
      continue
    }

    // Neither numbered nor an option: a wrapped prompt, or an instruction for what follows.
    if (q && !sawOption) q.prompt = `${q.prompt} ${text}`.trim()
    else {
      directive = text
      flush()
    }
  }
  flush()
  return questions
}

const options = args()
if (!options.pdf || !options.label) {
  console.error('usage: node scripts/import-past-paper.mjs --pdf <file.pdf> --label "MPT 2027" [--skip 21-40] [--dry]')
  process.exit(1)
}

const skip = parseSkip(options.skip)
const parsed = parsePaper(await readLines(options.pdf))
const tally = new Map()
parsed.forEach((q) => q.options.forEach((o) => tally.set(o.font, (tally.get(o.font) || 0) + 1)))
if (tally.size < 2) {
  console.error(
    `No answer key found in ${options.pdf}: every option renders in one font, so the correct choices are not marked. Import aborted.`,
  )
  process.exit(1)
}
const regularFont = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]

const dropped = { noKey: 0, clipped: 0, skipped: 0, passage: 0, malformed: 0 }
const kept = []
for (const q of parsed) {
  const opts = q.options.map((o) => ({ ...o, text: o.text.replace(/\s+/g, ' ').trim() }))
  const prompt = (q.prompt || q.directive || '').replace(/\s+/g, ' ').trim()
  const directive = q.prompt ? q.directive : null
  const bold = opts.filter((o) => o.font !== regularFont)

  if (skip(q.number)) dropped.skipped++
  else if (opts.length !== 4 || !prompt || opts.some((o) => !o.text)) dropped.malformed++
  else if (bold.length !== 1) dropped.noKey++
  else if (opts.some((o) => o.end > PAGE_EDGE)) dropped.clipped++
  else if (/passage|the given figure|diagram below/i.test(`${prompt} ${directive ?? ''}`)) dropped.passage++
  else {
    kept.push({
      unit: SECTION_TO_UNIT[q.section],
      number: q.number,
      question: {
        id: `${options.label.toLowerCase().replace(/[^a-z0-9]/g, '')}-${q.number}`,
        directive: directive || undefined,
        prompt,
        choices: opts.map((o) => o.text),
        answer: opts.indexOf(bold[0]),
        source: { paper: options.label, number: q.number },
      },
    })
  }
}

console.log(`${options.label}: parsed ${parsed.length}, kept ${kept.length}`)
console.log('dropped:', dropped)
if (kept.some((k) => !k.unit)) {
  console.error('unmapped sections:', [...new Set(parsed.map((q) => q.section))])
  process.exit(1)
}
if (options.dry) {
  console.log('dry run — nothing written')
  process.exit(0)
}

mkdirSync(ROOT, { recursive: true })
const slug = options.label.replace(/[^0-9]/g, '')
for (const unit of new Set(kept.map((k) => k.unit))) {
  const items = kept.filter((k) => k.unit === unit).sort((a, b) => a.number - b.number)
  const sets = []
  for (let i = 0; i < items.length; i += PER_LESSON) sets.push(items.slice(i, i + PER_LESSON))
  if (sets.length > 1 && sets.at(-1).length < 4) sets[sets.length - 2].push(...sets.pop())

  const lessons = sets.map((set, index) => ({
    id: `${unit}-${slug}-${index + 1}`,
    title: `${options.label} · Set ${index + 1}`,
    subtitle: `Questions ${set[0].number}-${set.at(-1).number} of the original paper`,
    paper: options.label,
    questions: set.map((k) => k.question),
  }))

  const path = `${ROOT}/${unit}.json`
  const file = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : {
        unit,
        kind: 'past-paper',
        source:
          'FPSC MCQ-based Preliminary Test past papers, as published by cssaspirants.pk. Answers are the keys marked in those papers.',
        lessons: [],
      }
  file.lessons = [...file.lessons.filter((lesson) => lesson.paper !== options.label), ...lessons]
  writeFileSync(path, JSON.stringify(file, null, 2) + '\n')
  console.log(`  ${unit}: ${lessons.length} lessons, ${items.length} questions`)
}
