import { useParams } from 'react-router-dom'
import LessonScreen from './LessonScreen.jsx'

/** Keying by lesson id remounts the screen when moving straight on to the next lesson. */
export default function LessonRoute() {
  const { lessonId } = useParams()
  return <LessonScreen key={lessonId} lessonId={lessonId} />
}
