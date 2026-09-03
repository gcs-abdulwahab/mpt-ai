import coachedEnglish from './questions/coached/english.json'
import coachedAbilities from './questions/coached/general-abilities.json'
import coachedKnowledge from './questions/coached/general-knowledge.json'
import coachedIslamic from './questions/coached/islamic-studies.json'
import coachedUrdu from './questions/coached/urdu.json'
import paperEnglish from './questions/past-papers/english.json'
import paperAbilities from './questions/past-papers/general-abilities.json'
import paperKnowledge from './questions/past-papers/general-knowledge.json'
import paperIslamic from './questions/past-papers/islamic-studies.json'
import cssGsa from './questions/css-compulsory/general-science-ability.json'
import pms2023 from './questions/pms-prelims/2023.json'
import pms2024 from './questions/pms-prelims/2024.json'
import pms2025 from './questions/pms-prelims/2025.json'
import pmsPakStudies from './questions/pms-compulsory/pakistan-studies.json'
import pmsIslamic from './questions/pms-compulsory/islamic-studies.json'

/**
 * Four tracks across the two exams. Each track is an independent path: its units
 * unlock lesson by lesson, and units in one track never gate another.
 */
const TRACKS = [
  {
    id: 'css-mpt',
    exam: 'CSS',
    title: 'MPT — Preliminary Test',
    tagline: 'The FPSC screening paper you must clear to sit the written exam',
    // Units and marks are taken from the section headings printed on the papers
    // themselves (MPT 2023 Special and MPT 2026), not from a syllabus summary.
    blueprint: { totalMcqs: 200, minutes: 200, passingMarks: 66, negativeMarking: false },
    note: 'Real questions from MPT 2023 (Special) and MPT 2026, after coached sets that explain the answer.',
    units: [
      {
        id: 'general-abilities',
        title: 'General Abilities',
        tagline: 'Maths, logic and analytical reasoning',
        marks: 60,
        hue: 172,
        sources: [coachedAbilities, paperAbilities],
      },
      {
        id: 'english',
        title: 'English',
        tagline: 'Grammar, vocabulary, sentence correction',
        marks: 50,
        hue: 244,
        sources: [coachedEnglish, paperEnglish],
      },
      {
        id: 'general-knowledge',
        title: 'General Knowledge',
        tagline: 'Everyday science, current affairs, Pakistan affairs',
        marks: 50,
        hue: 199,
        sources: [coachedKnowledge, paperKnowledge],
      },
      {
        id: 'islamic-studies',
        title: 'Islamic Studies',
        tagline: 'Quran, Seerah, Hadith and history',
        marks: 20,
        hue: 40,
        sources: [coachedIslamic, paperIslamic],
      },
      {
        id: 'urdu',
        title: 'اردو',
        tagline: 'قواعد، محاورات، ضرب الامثال',
        marks: 20,
        hue: 291,
        sources: [coachedUrdu],
      },
    ],
  },
  {
    id: 'css-compulsory',
    exam: 'CSS',
    title: 'Compulsory subjects',
    tagline: 'Part-I MCQs from the CSS written papers',
    note: 'No official key was published for these papers, so the answers were worked out by MPT-AI and are flagged as such.',
    units: [
      {
        id: 'css-compulsory-gsa',
        title: 'General Science & Ability',
        tagline: 'Part-I MCQs, 2013–2025',
        marks: 20,
        hue: 152,
        sources: [cssGsa],
      },
    ],
  },
  {
    id: 'pms-prelims',
    exam: 'PMS',
    title: 'Prelims — General Ability',
    tagline: 'The PPSC screening paper for the Provincial Management Service',
    note: 'PPSC syllabus: general knowledge, Pakistan studies, Islamic studies, current affairs, geography, maths, English, Urdu, everyday science and computer skills — one mixed paper.',
    units: [
      {
        id: 'pms-2025',
        title: 'PPSC PMS 2025',
        tagline: 'General ability paper',
        hue: 268,
        sources: [pms2025],
      },
      {
        id: 'pms-2024',
        title: 'PPSC PMS 2024',
        tagline: 'General ability paper',
        hue: 220,
        sources: [pms2024],
      },
      {
        id: 'pms-2023',
        title: 'PPSC PMS 2023',
        tagline: 'General ability paper',
        hue: 190,
        sources: [pms2023],
      },
    ],
  },
  {
    id: 'pms-compulsory',
    exam: 'PMS',
    title: 'Compulsory subjects',
    tagline: 'Part-I MCQs from the PMS written papers',
    units: [
      {
        id: 'pms-compulsory-pakistan-studies',
        title: 'Pakistan Studies',
        tagline: 'PMS compulsory paper',
        hue: 142,
        sources: [pmsPakStudies],
      },
      {
        id: 'pms-compulsory-islamic-studies',
        title: 'Islamic Studies',
        tagline: 'PMS compulsory paper',
        hue: 40,
        sources: [pmsIslamic],
      },
    ],
  },
]

/**
 * A question is only usable if its answer is a real index. Staging data carries
 * `answer: null` until a key is attached — and `null >= 0` is true in JS, so
 * without this guard such an item would silently mark option 1 as correct.
 */
function isAnswerable(question) {
  return Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.choices.length
}

function buildUnit(unit, track) {
  const rtl = unit.sources.some((source) => source.rtl)
  const lessons = unit.sources
    .flatMap((source) =>
      source.lessons.map((lesson) => ({
        ...lesson,
        questions: lesson.questions.filter(isAnswerable),
        kind: source.kind ?? 'coached',
        unitId: unit.id,
        unitTitle: unit.title,
        trackId: track.id,
        trackTitle: `${track.exam} · ${track.title}`,
        hue: unit.hue,
        rtl,
      })),
    )
    .filter((lesson) => lesson.questions.length > 0)
    .map((lesson, indexInUnit) => ({ ...lesson, indexInUnit }))

  const { sources, ...rest } = unit
  return {
    ...rest,
    rtl,
    note: sources.find((source) => source.note)?.note ?? null,
    questionCount: lessons.reduce((n, lesson) => n + lesson.questions.length, 0),
    lessons,
  }
}

export const tracks = TRACKS.map((track) => {
  const units = track.units.map((unit) => buildUnit(unit, track))
  return {
    ...track,
    units,
    lessonCount: units.reduce((n, unit) => n + unit.lessons.length, 0),
    questionCount: units.reduce((n, unit) => n + unit.questionCount, 0),
  }
})

export function getTrack(trackId) {
  return tracks.find((track) => track.id === trackId) ?? null
}

const EXAM_META = {
  CSS: { title: 'CSS', blurb: 'Central Superior Services — FPSC' },
  PMS: { title: 'PMS', blurb: 'Provincial Management Service — PPSC' },
}

/**
 * Exam groups, derived from the tracks themselves — an exam with no entry in
 * EXAM_META still renders, so adding a track can never make it disappear.
 */
export const exams = [...new Set(TRACKS.map((track) => track.exam))].map((id) => ({
  id,
  title: EXAM_META[id]?.title ?? id,
  blurb: EXAM_META[id]?.blurb ?? '',
}))

/** Every lesson in the app, in path order, across all tracks. */
export const lessons = tracks.flatMap((track) => track.units.flatMap((unit) => unit.lessons))

const lessonsById = new Map(lessons.map((lesson, index) => [lesson.id, { ...lesson, index }]))

export function getLesson(lessonId) {
  return lessonsById.get(lessonId) ?? null
}

export function getNextLesson(lessonId) {
  const current = lessonsById.get(lessonId)
  if (!current) return null
  const next = lessons[current.index + 1]
  return next && next.unitId === current.unitId ? next : null
}

/** The lesson that gates this one — units unlock independently of each other. */
export function getPrerequisite(lessonId) {
  const current = lessonsById.get(lessonId)
  if (!current || current.indexInUnit === 0) return null
  return lessons[current.index - 1] ?? null
}

export const totalQuestions = lessons.reduce((n, lesson) => n + lesson.questions.length, 0)
