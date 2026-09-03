import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createLocalAdapter } from './adapter.js'
import { ProgressContext } from './progressContext.js'
import { useContent } from '../content/contentContext.js'

export function ProgressProvider({ adapter, children }) {
  const { lessons, getPrerequisite } = useContent()
  const store = useMemo(() => adapter ?? createLocalAdapter(), [adapter])
  const [records, setRecords] = useState({})
  const [ready, setReady] = useState(false)
  const recordsRef = useRef(records)

  useEffect(() => {
    let cancelled = false
    store.load().then((rows) => {
      if (cancelled) return
      const byLesson = Object.fromEntries(rows.map((row) => [row.lessonId, row]))
      recordsRef.current = byLesson
      setRecords(byLesson)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [store])

  const recordAttempt = useCallback(
    (lessonId, { score, total }) => {
      const existing = recordsRef.current[lessonId]
      const now = Date.now()
      const record = {
        id: `lesson:${lessonId}`,
        lessonId,
        attempts: (existing?.attempts ?? 0) + 1,
        bestScore: Math.max(existing?.bestScore ?? 0, score),
        lastScore: score,
        total,
        completedAt: existing?.completedAt ?? now,
        updatedAt: now,
        dirty: true,
      }
      recordsRef.current = { ...recordsRef.current, [lessonId]: record }
      setRecords(recordsRef.current)
      store.save([record])
      return record
    },
    [store],
  )

  const resetProgress = useCallback(() => {
    recordsRef.current = {}
    setRecords({})
    store.clear()
  }, [store])

  const value = useMemo(() => {
    /**
     * A lesson opens once the previous lesson *in its own unit* is finished, so
     * a candidate can drill one subject without clearing the ones before it.
     */
    const isUnlocked = (lessonId) => {
      const prerequisite = getPrerequisite(lessonId)
      return prerequisite ? Boolean(records[prerequisite.id]) : true
    }

    const completed = Object.keys(records).length
    const mastered = Object.values(records).filter((r) => r.bestScore === r.total).length
    const currentLessonId = lessons.find((lesson) => !records[lesson.id])?.id ?? null

    return {
      ready,
      records,
      recordAttempt,
      resetProgress,
      isUnlocked,
      currentLessonId,
      stats: { completed, mastered, total: lessons.length },
    }
  }, [ready, records, recordAttempt, resetProgress, lessons, getPrerequisite])

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}
