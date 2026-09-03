const PER_LESSON = 10

const slugify = (text) =>
  String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'custom'

/** Same rule the bundled curriculum applies: a question without a real key cannot be asked. */
export function isAnswerable(question) {
  return (
    Number.isInteger(question.answer) &&
    question.answer >= 0 &&
    Array.isArray(question.choices) &&
    question.answer < question.choices.length &&
    question.choices.length >= 2 &&
    Boolean(question.prompt?.trim())
  )
}

function chunk(items) {
  const sets = []
  for (let i = 0; i < items.length; i += PER_LESSON) sets.push(items.slice(i, i + PER_LESSON))
  if (sets.length > 1 && sets.at(-1).length < 4) sets[sets.length - 2].push(...sets.pop())
  return sets
}

/**
 * Turns author-created categories into the same track/unit/lesson shape the
 * bundled curriculum uses, so every screen treats both alike. One track per exam
 * group, holding that group's categories as units.
 */
export function buildCustomTracks(categories, questions) {
  const byExam = new Map()
  for (const category of categories) {
    const exam = category.exam?.trim() || 'Custom'
    if (!byExam.has(exam)) byExam.set(exam, [])
    byExam.get(exam).push(category)
  }

  return [...byExam.entries()].map(([exam, group]) => {
    const trackId = `custom-${slugify(exam)}`
    const units = group.map((category) => {
      const mine = questions
        .filter((question) => question.categoryId === category.id)
        .sort((a, b) => a.order - b.order)
      const usable = mine.filter(isAnswerable)

      const lessons = chunk(usable)
        .map((set, index) => ({
          id: `${category.id}-${index + 1}`,
          title: usable.length > PER_LESSON ? `${category.title} · Set ${index + 1}` : category.title,
          subtitle: category.tagline || 'Your own questions',
          kind: 'custom',
          unitId: category.id,
          unitTitle: category.title,
          trackId,
          trackTitle: `${exam} · My questions`,
          hue: category.hue,
          rtl: false,
          questions: set.map((question) => ({
            id: question.id,
            directive: question.directive || undefined,
            prompt: question.prompt,
            statements: question.statements?.length ? question.statements : undefined,
            closing: question.closing || undefined,
            choices: question.choices,
            answer: question.answer,
            explanation: question.explanation || undefined,
            source: { paper: 'Added by you', keyedBy: 'author' },
          })),
        }))
        .map((lesson, indexInUnit) => ({ ...lesson, indexInUnit }))

      const pending = mine.length - usable.length
      return {
        id: category.id,
        title: category.title,
        tagline: category.tagline || 'Your own questions',
        hue: category.hue,
        rtl: false,
        note:
          mine.length === 0
            ? 'No questions yet — add some from the dashboard.'
            : pending === 1
              ? '1 question still needs a correct answer marked before it appears here.'
              : pending > 1
                ? `${pending} questions still need a correct answer marked before they appear here.`
                : null,
        questionCount: usable.length,
        lessons,
      }
    })

    return {
      id: trackId,
      exam,
      title: 'My questions',
      tagline: 'Categories and questions you added on this device',
      custom: true,
      units,
      lessonCount: units.reduce((n, unit) => n + unit.lessons.length, 0),
      questionCount: units.reduce((n, unit) => n + unit.questionCount, 0),
    }
  })
}
