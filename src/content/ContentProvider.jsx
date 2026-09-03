import { useCallback, useEffect, useMemo, useState } from 'react'
import { ContentContext } from './contentContext.js'
import { buildCustomTracks } from './buildCustom.js'
import { exams as bundledExams, tracks as bundledTracks } from '../data/curriculum.js'
import { contentStore } from '../storage/contentStore.js'

/**
 * Merges the bundled question bank with whatever the author has created on this
 * device, and hands every screen one view of the curriculum.
 */
export function ContentProvider({ children }) {
  const [custom, setCustom] = useState({ categories: [], questions: [] })
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    const loaded = await contentStore.load()
    setCustom(loaded)
    setReady(true)
    return loaded
  }, [])

  // Initial read of the author's content; guarded so a slow load can't set state
  // after unmount.
  useEffect(() => {
    let cancelled = false
    contentStore.load().then((loaded) => {
      if (cancelled) return
      setCustom(loaded)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const value = useMemo(() => {
    const customTracks = buildCustomTracks(custom.categories, custom.questions)
    const tracks = [...bundledTracks, ...customTracks]

    const examOrder = [...bundledExams]
    for (const track of customTracks) {
      if (!examOrder.some((exam) => exam.id === track.exam)) {
        examOrder.push({ id: track.exam, title: track.exam, blurb: '' })
      }
    }

    const lessons = tracks.flatMap((track) => track.units.flatMap((unit) => unit.lessons))
    const byId = new Map(lessons.map((lesson, index) => [lesson.id, { ...lesson, index }]))

    return {
      ready,
      tracks,
      exams: examOrder,
      lessons,
      categories: custom.categories,
      customQuestions: custom.questions,
      totalQuestions: lessons.reduce((n, lesson) => n + lesson.questions.length, 0),
      refresh,
      getTrack: (trackId) => tracks.find((track) => track.id === trackId) ?? null,
      getLesson: (lessonId) => byId.get(lessonId) ?? null,
      getNextLesson: (lessonId) => {
        const current = byId.get(lessonId)
        if (!current) return null
        const next = lessons[current.index + 1]
        return next && next.unitId === current.unitId ? next : null
      },
      /** Units unlock independently, so only the previous lesson in the unit gates. */
      getPrerequisite: (lessonId) => {
        const current = byId.get(lessonId)
        if (!current || current.indexInUnit === 0) return null
        return lessons[current.index - 1] ?? null
      },
    }
  }, [custom, ready, refresh])

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}
