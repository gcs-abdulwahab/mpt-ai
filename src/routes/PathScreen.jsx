import { Link, Navigate, useParams } from 'react-router-dom'
import LessonNode from '../components/LessonNode.jsx'
import { BookIcon } from '../components/icons.jsx'
import { useContent } from '../content/contentContext.js'
import { useInstallPrompt } from '../lib/useInstallPrompt.js'
import { useProgress } from '../storage/progressContext.js'
import './PathScreen.css'

/** Unlocking runs unit by unit, so each unit shows one unlocked-but-unfinished "current" node. */
function lessonState(lesson, { records, isUnlocked }) {
  const record = records[lesson.id]
  if (record) return record.bestScore === record.total ? 'mastered' : 'done'
  return isUnlocked(lesson.id) ? 'current' : 'locked'
}

export default function PathScreen() {
  const { trackId } = useParams()
  const { getTrack } = useContent()
  const track = getTrack(trackId)
  const progress = useProgress()
  const { canInstall, install } = useInstallPrompt()

  if (!track) return <Navigate to="/" replace />

  const trackLessons = track.units.flatMap((unit) => unit.lessons)
  const completed = trackLessons.filter((lesson) => progress.records[lesson.id]).length
  const mastered = trackLessons.filter((lesson) => {
    const record = progress.records[lesson.id]
    return record && record.bestScore === record.total
  }).length
  const percent = Math.round((completed / trackLessons.length) * 100)
  const nextLesson = trackLessons.find((lesson) => !progress.records[lesson.id])
  const { blueprint } = track

  return (
    <>
      <header className="path-header">
        <div className="path-header__top">
          <Link className="brand" to="/">
            <BookIcon width="22" height="22" />
            <span>
              MPT<span className="brand__dot">·</span>AI
            </span>
          </Link>
          {canInstall && (
            <button className="btn btn--small" type="button" onClick={install}>
              Install app
            </button>
          )}
        </div>

        <Link className="path-header__back" to="/">
          ← All papers
        </Link>
        <h1>
          {track.exam} · {track.title}
        </h1>
        <p className="path-header__blurb">{track.tagline}</p>
        {blueprint && (
          <p className="path-header__blurb">
            {blueprint.totalMcqs} MCQs in {blueprint.minutes} minutes · qualifying mark{' '}
            {blueprint.passingMarks}/{blueprint.totalMcqs} · no negative marking
          </p>
        )}
        {track.note && <p className="path-header__note">{track.note}</p>}

        <div className="summary">
          <div className="summary__bar" role="img" aria-label={`${percent}% of lessons complete`}>
            <span style={{ width: `${percent}%` }} />
          </div>
          <p className="summary__text">
            <strong>
              {completed}/{trackLessons.length}
            </strong>{' '}
            lessons complete · <strong>{mastered}</strong> mastered
            {nextLesson ? (
              <>
                {' '}
                · next up: <strong>{nextLesson.title}</strong>
              </>
            ) : (
              ' · every lesson cleared'
            )}
          </p>
        </div>
      </header>

      <main className="path">
        {track.units.map((unit) => (
          <section className="unit" key={unit.id} style={{ '--hue': unit.hue }}>
            <div className="unit__banner" dir={unit.rtl ? 'rtl' : 'ltr'}>
              <div>
                <h2 className={unit.rtl ? 'urdu' : undefined}>{unit.title}</h2>
                <p className={unit.rtl ? 'urdu' : undefined}>{unit.tagline}</p>
              </div>
              {unit.marks ? (
                // Always LTR: an RTL banner would otherwise render "/200 marks" reversed.
                <span className="unit__marks" dir="ltr">
                  {unit.marks}
                  <small>/{blueprint?.totalMcqs ?? 100} marks</small>
                </span>
              ) : (
                <span className="unit__marks" dir="ltr">
                  {unit.questionCount}
                  <small>questions</small>
                </span>
              )}
            </div>

            {unit.note && <p className="unit__note">{unit.note}</p>}

            <ol className="unit__nodes">
              {unit.lessons.map((lesson, index) => (
                <LessonNode
                  key={lesson.id}
                  lesson={lesson}
                  position={index + 1}
                  state={lessonState(lesson, progress)}
                  record={progress.records[lesson.id]}
                />
              ))}
            </ol>
          </section>
        ))}
      </main>

      <footer className="path-footer">
        <p>
          {track.lessonCount} lessons · {track.questionCount} questions · stored on this device.
        </p>
        <button className="btn btn--ghost btn--small" type="button" onClick={progress.resetProgress}>
          Reset all progress
        </button>
      </footer>
    </>
  )
}
