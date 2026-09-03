import { Link } from 'react-router-dom'
import { BookIcon } from '../components/icons.jsx'
import { useContent } from '../content/contentContext.js'
import { useInstallPrompt } from '../lib/useInstallPrompt.js'
import { useProgress } from '../storage/progressContext.js'
import './TracksScreen.css'

export default function TracksScreen() {
  const { exams, tracks, totalQuestions } = useContent()
  const { records } = useProgress()
  const { canInstall, install } = useInstallPrompt()

  return (
    <>
      <header className="tracks-header">
        <div className="tracks-header__top">
          <div className="brand">
            <BookIcon width="22" height="22" />
            <span>
              MPT<span className="brand__dot">·</span>AI
            </span>
          </div>
          {canInstall && (
            <button className="btn btn--small" type="button" onClick={install}>
              Install app
            </button>
          )}
        </div>
        <h1>Pick your paper.</h1>
        <p className="tracks-header__blurb">
          {totalQuestions} MCQs from real past papers and coached sets — offline, on your phone.
        </p>
      </header>

      <main className="tracks">
        {exams.map((exam) => (
          <section className="exam" key={exam.id}>
            <div className="exam__heading">
              <h2>{exam.title}</h2>
              {exam.blurb && <p>{exam.blurb}</p>}
            </div>

            <div className="exam__tracks">
              {tracks
                .filter((track) => track.exam === exam.id)
                .map((track) => {
                  const done = track.units
                    .flatMap((unit) => unit.lessons)
                    .filter((lesson) => records[lesson.id]).length
                  const percent = Math.round((done / track.lessonCount) * 100)
                  return (
                    <Link className="track" to={`/track/${track.id}`} key={track.id}>
                      <h3>{track.title}</h3>
                      <p className="track__tagline">{track.tagline}</p>
                      <div className="track__bar">
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <p className="track__meta">
                        <strong>
                          {done}/{track.lessonCount}
                        </strong>{' '}
                        lessons · {track.questionCount} questions
                      </p>
                    </Link>
                  )
                })}
            </div>
          </section>
        ))}
      </main>

      <footer className="tracks-footer">
        <p>Progress is stored on this device and works offline.</p>
        <Link className="tracks-footer__admin" to="/admin">
          Dashboard — add your own questions →
        </Link>
      </footer>
    </>
  )
}
