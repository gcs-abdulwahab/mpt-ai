import { idbContent, idbSupported } from './idb.js'

/**
 * Author-created content lives beside the bundled bank, in the same IndexedDB.
 *
 * @typedef {Object} Category   a unit the author created
 * @property {string} id        `category:<uuid>`
 * @property {'category'} type
 * @property {string} exam      which exam group it appears under
 * @property {string} title
 * @property {string} tagline
 * @property {number} hue
 * @property {number} createdAt
 * @property {number} updatedAt
 *
 * @typedef {Object} CustomQuestion
 * @property {string} id        `question:<uuid>`
 * @property {'question'} type
 * @property {string} categoryId
 * @property {string} prompt
 * @property {string[]} choices
 * @property {number} answer    index into choices
 * @property {string} [directive]
 * @property {string[]} [statements]
 * @property {string} [closing]
 * @property {string} [explanation]
 * @property {number} order
 */

const memory = new Map()

const uuid = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

async function readAll() {
  if (!idbSupported) return [...memory.values()]
  try {
    return await idbContent.getAll()
  } catch {
    return [...memory.values()]
  }
}

async function write(record) {
  memory.set(record.id, record)
  if (!idbSupported) return record
  try {
    await idbContent.put(record)
  } catch {
    /* memory already holds it */
  }
  return record
}

async function remove(ids) {
  ids.forEach((id) => memory.delete(id))
  if (!idbSupported) return
  try {
    await idbContent.deleteMany(ids)
  } catch {
    /* memory already dropped it */
  }
}

export const contentStore = {
  async load() {
    const rows = await readAll()
    return {
      categories: rows.filter((row) => row.type === 'category').sort((a, b) => a.createdAt - b.createdAt),
      questions: rows.filter((row) => row.type === 'question').sort((a, b) => a.order - b.order),
    }
  },

  saveCategory(input) {
    const now = Date.now()
    return write({
      hue: 322,
      tagline: '',
      exam: 'Custom',
      ...input,
      id: input.id ?? `category:${uuid()}`,
      type: 'category',
      title: input.title.trim(),
      createdAt: input.createdAt ?? now,
      updatedAt: now,
    })
  },

  saveQuestion(input) {
    const now = Date.now()
    const choices = input.choices.map((choice) => choice.trim()).filter(Boolean)
    return write({
      ...input,
      id: input.id ?? `question:${uuid()}`,
      type: 'question',
      choices,
      answer: Number(input.answer),
      statements: input.statements?.map((s) => s.trim()).filter(Boolean) ?? undefined,
      order: input.order ?? now,
      updatedAt: now,
    })
  },

  deleteQuestion(id) {
    return remove([id])
  },

  /** Deleting a category takes its questions with it — nothing should be orphaned. */
  async deleteCategory(id) {
    const { questions } = await contentStore.load()
    const doomed = questions.filter((question) => question.categoryId === id).map((question) => question.id)
    await remove([id, ...doomed])
  },

  async clear() {
    memory.clear()
    if (idbSupported) {
      try {
        await idbContent.clear()
      } catch {
        /* memory already cleared */
      }
    }
  },
}

/**
 * Export one category in exactly the shape of the bundled data files, so authored
 * content can be dropped into src/data/questions/ and shipped with the app.
 */
export function toDataFile(category, questions) {
  const slug = category.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'category'
  const perLesson = 10
  const sets = []
  for (let i = 0; i < questions.length; i += perLesson) sets.push(questions.slice(i, i + perLesson))
  if (sets.length > 1 && sets.at(-1).length < 4) sets[sets.length - 2].push(...sets.pop())

  return {
    unit: slug,
    kind: 'custom',
    title: category.title,
    exam: category.exam,
    tagline: category.tagline || undefined,
    lessons: sets.map((set, index) => ({
      id: `${slug}-${index + 1}`,
      title: sets.length > 1 ? `${category.title} · Set ${index + 1}` : category.title,
      subtitle: category.tagline || undefined,
      questions: set.map((question, i) => ({
        id: `${slug}-q${index * perLesson + i + 1}`,
        directive: question.directive || undefined,
        prompt: question.prompt,
        statements: question.statements?.length ? question.statements : undefined,
        closing: question.closing || undefined,
        choices: question.choices,
        answer: question.answer,
        explanation: question.explanation || undefined,
      })),
    })),
  }
}

/** Accepts a data file (bundled shape or an export) and turns it into store records. */
export function fromDataFile(file, { exam = 'Custom' } = {}) {
  const lessons = Array.isArray(file?.lessons) ? file.lessons : []
  const questions = lessons.flatMap((lesson) => lesson.questions ?? [])
  if (!questions.length) throw new Error('No questions found in that file.')

  return {
    category: {
      title: file.title ?? file.unit ?? 'Imported',
      tagline: file.tagline ?? '',
      exam: file.exam ?? exam,
    },
    questions: questions.map((question, index) => ({
      prompt: question.prompt ?? '',
      directive: question.directive ?? '',
      statements: question.statements ?? [],
      closing: question.closing ?? '',
      choices: question.choices ?? [],
      // Imported items may be keyless (answer: null) — the author keys them in the UI.
      answer: Number.isInteger(question.answer) ? question.answer : -1,
      explanation: question.explanation ?? '',
      order: index,
    })),
  }
}
