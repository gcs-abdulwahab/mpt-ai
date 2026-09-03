import { Link } from 'react-router-dom'
import { CheckIcon, LockIcon, StarIcon } from './icons.jsx'

/**
 * One stop on the path. States: locked, current (next up), done, mastered (all correct).
 */
export default function LessonNode({ lesson, position, state, record }) {
  const label = `${lesson.title} — ${
    { locked: 'locked', current: 'start this lesson', done: 'completed', mastered: 'all correct' }[
      state
    ]
  }`

  const inner = (
    <>
      <span className="node__disc">
        {state === 'locked' && <LockIcon width="26" height="26" />}
        {state === 'current' && <span className="node__index">{position}</span>}
        {state === 'done' && <CheckIcon width="28" height="28" />}
        {state === 'mastered' && <StarIcon width="28" height="28" />}
      </span>
      <span className="node__meta" dir={lesson.rtl ? 'rtl' : 'ltr'}>
        <span className={`node__title${lesson.rtl ? ' urdu' : ''}`}>{lesson.title}</span>
        <span className="node__sub" dir="ltr">
          {record
            ? `Best ${record.bestScore}/${record.total}`
            : `${lesson.questions.length} questions`}
        </span>
      </span>
    </>
  )

  if (state === 'locked') {
    return (
      <li className="node node--locked" data-side={position % 2 ? 'left' : 'right'}>
        <span className="node__button" aria-label={label} aria-disabled="true">
          {inner}
        </span>
      </li>
    )
  }

  return (
    <li className={`node node--${state}`} data-side={position % 2 ? 'left' : 'right'}>
      <Link className="node__button" to={`/lesson/${lesson.id}`} aria-label={label}>
        {inner}
      </Link>
    </li>
  )
}
