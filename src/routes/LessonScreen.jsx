import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { CheckIcon, CloseIcon } from '../components/icons.jsx'
import { useContent } from '../content/contentContext.js'
import { shuffle } from '../lib/shuffle.js'
import { useProgress } from '../storage/progressContext.js'
import './LessonScreen.css'

const CHOICE_KEYS = ['1', '2', '3', '4']
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI']

/** Coached questions carry a written explanation; past-paper items carry their origin. */
function explain(question) {
  if (question.explanation) return question.explanation
  if (question.source) {
    const where = question.source.number ? `, Q${question.source.number}` : ''
    return `Original exam question — ${question.source.paper}${where}.`
  }
  return null
}

/** Says who stands behind the answer when it is not the examiner's own printed key. */
function keyNote(question) {
  const source = question.source
  if (source?.keyedBy === 'mpt-ai') {
    return 'Answer worked out by MPT-AI — no official key was published for this paper.'
  }
  if (source?.keySource) return `Answer key via ${source.keySource}.`
  return null
}

/** Mounted with key={lessonId}, so every lesson starts from clean state. */
export default function LessonScreen({ lessonId }) {
  const navigate = useNavigate()
  const progress = useProgress()
  const { getLesson, getNextLesson } = useContent()
  const lesson = getLesson(lessonId)

  // Questions are re-ordered per attempt so a repeat run is not recall of position.
  const [questions, setQuestions] = useState(() => (lesson ? shuffle(lesson.questions) : []))

  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState(null)
  const [checked, setChecked] = useState(false)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const headingRef = useRef(null)

  const question = questions[index]
  const isLast = index === questions.length - 1
  const score = answers.filter((a) => a.correct).length

  const check = useCallback(() => {
    if (selected === null || checked) return
    setChecked(true)
    setAnswers((prev) => [
      ...prev,
      { question, choice: selected, correct: selected === question.answer },
    ])
  }, [checked, question, selected])

  const advance = useCallback(() => {
    if (!checked) return
    if (isLast) {
      // `answers` already includes the question that was just checked.
      const finalScore = answers.filter((a) => a.correct).length
      progress.recordAttempt(lesson.id, { score: finalScore, total: questions.length })
      setFinished(true)
      return
    }
    setIndex((i) => i + 1)
    setSelected(null)
    setChecked(false)
  }, [answers, checked, isLast, lesson, progress, questions.length])

  const restart = () => {
    setQuestions(shuffle(lesson.questions))
    setIndex(0)
    setSelected(null)
    setChecked(false)
    setAnswers([])
    setFinished(false)
  }

  useEffect(() => {
    headingRef.current?.focus()
  }, [index, finished])

  useEffect(() => {
    if (finished) return undefined
    const onKeyDown = (event) => {
      if (CHOICE_KEYS.includes(event.key) && !checked) {
        const i = Number(event.key) - 1
        if (i < (question?.choices.length ?? 0)) setSelected(i)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (checked) advance()
        else check()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [advance, check, checked, finished, question])

  if (!lesson) return <Navigate to="/" replace />
  if (!progress.ready) return <div className="lesson lesson--loading">Loading…</div>
  if (!progress.isUnlocked(lesson.id)) return <Navigate to="/" replace />

  const BACK = `/track/${lesson.trackId}`

  if (finished) {
    const missed = answers.filter((a) => !a.correct)
    const next = getNextLesson(lesson.id)
    return (
      <div className="lesson" style={{ '--hue': lesson.hue }}>
        <div className="results">
          <ScoreRing score={score} total={questions.length} />
          <h1>
            {score === questions.length
              ? 'Flawless — lesson mastered.'
              : score >= questions.length * 0.6
                ? 'Lesson complete.'
                : 'Lesson complete — worth another run.'}
          </h1>
          <p className="results__score">
            {score} of {questions.length} correct
          </p>

          {missed.length > 0 && (
            <section className="review">
              <h2>Review what you missed</h2>
              <ul>
                {missed.map(({ question: q, choice }) => (
                  <li key={q.id}>
                    <p className={`review__prompt${lesson.rtl ? ' urdu' : ''}`} dir={lesson.rtl ? 'rtl' : 'ltr'}>
                      {q.prompt}
                    </p>
                    <p className={`review__wrong${lesson.rtl ? ' urdu' : ''}`} dir={lesson.rtl ? 'rtl' : 'ltr'}>
                      You chose: {q.choices[choice]}
                    </p>
                    <p className={`review__right${lesson.rtl ? ' urdu' : ''}`} dir={lesson.rtl ? 'rtl' : 'ltr'}>
                      Correct: {q.choices[q.answer]}
                    </p>
                    <p className="review__why">{explain(q)}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="results__actions">
            <button className="btn" type="button" onClick={() => navigate(BACK)}>
              Back to the path
            </button>
            <button className="btn btn--ghost" type="button" onClick={restart}>
              Practise again
            </button>
            {next && progress.isUnlocked(next.id) && (
              <button
                className="btn btn--ghost"
                type="button"
                onClick={() => navigate(`/lesson/${next.id}`)}
              >
                Next lesson: {next.title}
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const answeredCorrectly = checked && selected === question.answer

  return (
    <div className="lesson" style={{ '--hue': lesson.hue }}>
      <header className="lesson__bar">
        <Link className="lesson__close" to={`/track/${lesson.trackId}`} aria-label="Leave lesson">
          <CloseIcon width="22" height="22" />
        </Link>
        <div className="lesson__progress" role="img" aria-label={`Question ${index + 1} of ${questions.length}`}>
          <span style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
        <span className="lesson__count">
          {index + 1}/{questions.length}
        </span>
      </header>

      <main className="lesson__body">
        <p className="lesson__unit">
          {lesson.trackTitle} · {lesson.unitTitle}
        </p>
        {question.directive && <p className="lesson__directive">{question.directive}</p>}
        <h1
          className={`lesson__prompt${lesson.rtl ? ' urdu' : ''}`}
          dir={lesson.rtl ? 'rtl' : 'ltr'}
          tabIndex={-1}
          ref={headingRef}
        >
          {question.prompt}
        </h1>

        {/* UPSC-style items: a stem, a list of numbered statements, then the ask. */}
        {question.statements && (
          <ol className="statements">
            {question.statements.map((statement, i) => (
              <li key={statement}>
                <span className="statements__mark">{ROMAN[i] ?? i + 1}</span>
                <span>{statement}</span>
              </li>
            ))}
          </ol>
        )}
        {question.closing && <p className="lesson__closing">{question.closing}</p>}

        <ul className="choices">
          {question.choices.map((choice, i) => {
            const isSelected = selected === i
            const isAnswer = i === question.answer
            let tone = ''
            if (checked && isAnswer) tone = ' choice--correct'
            else if (checked && isSelected) tone = ' choice--wrong'
            else if (isSelected) tone = ' choice--selected'
            return (
              <li key={choice}>
                <button
                  type="button"
                  className={`choice${tone}${lesson.rtl ? ' urdu' : ''}`}
                  dir={lesson.rtl ? 'rtl' : 'ltr'}
                  onClick={() => !checked && setSelected(i)}
                  aria-pressed={isSelected}
                  disabled={checked}
                >
                  <span className="choice__key">{i + 1}</span>
                  <span className="choice__text">{choice}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </main>

      <footer className={`lesson__footer${checked ? (answeredCorrectly ? ' is-correct' : ' is-wrong') : ''}`}>
        {checked && (
          <div className="feedback">
            <p className="feedback__title">
              {answeredCorrectly ? (
                <>
                  <CheckIcon width="20" height="20" /> Correct
                </>
              ) : (
                // one flex item, so the label and the answer stay on the same line
                <span>
                  Correct answer:{' '}
                  <span className={lesson.rtl ? 'urdu' : undefined} dir={lesson.rtl ? 'rtl' : 'ltr'}>
                    {question.choices[question.answer]}
                  </span>
                </span>
              )}
            </p>
            <p
              className={`feedback__why${lesson.rtl ? ' urdu' : ''}`}
              dir={lesson.rtl ? 'rtl' : 'ltr'}
            >
              {explain(question)}
            </p>
            {keyNote(question) && <p className="feedback__provenance">{keyNote(question)}</p>}
          </div>
        )}
        <button
          className="btn btn--wide"
          type="button"
          onClick={checked ? advance : check}
          disabled={selected === null}
        >
          {checked ? (isLast ? 'Finish' : 'Continue') : 'Check'}
        </button>
      </footer>
    </div>
  )
}

function ScoreRing({ score, total }) {
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const pct = total === 0 ? 0 : score / total
  return (
    <svg className="ring" viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
      <circle className="ring__track" cx="60" cy="60" r={radius} />
      <circle
        className="ring__value"
        cx="60"
        cy="60"
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - pct)}
      />
      <text x="60" y="68" textAnchor="middle" className="ring__label">
        {Math.round(pct * 100)}%
      </text>
    </svg>
  )
}
