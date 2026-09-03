import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { BookIcon, CheckIcon, CloseIcon } from '../components/icons.jsx'
import { useContent } from '../content/contentContext.js'
import { contentStore, fromDataFile, toDataFile } from '../storage/contentStore.js'
import './AdminScreen.css'

const EXAM_CHOICES = ['CSS', 'PMS', 'UPSC', 'Custom']
const BLANK_QUESTION = {
  prompt: '',
  directive: '',
  statements: '',
  closing: '',
  choices: ['', '', '', ''],
  answer: -1,
  explanation: '',
}

export default function AdminScreen() {
  const { categories, customQuestions, refresh, tracks } = useContent()
  const [selectedId, setSelectedId] = useState(null)
  const [categoryForm, setCategoryForm] = useState({ title: '', tagline: '', exam: 'Custom' })
  const [question, setQuestion] = useState(BLANK_QUESTION)
  const [editingId, setEditingId] = useState(null)
  const [error, setError] = useState(null)
  const [flash, setFlash] = useState(null)
  const fileRef = useRef(null)

  const selected = categories.find((category) => category.id === selectedId) ?? categories[0] ?? null
  const mine = customQuestions
    .filter((q) => q.categoryId === selected?.id)
    .sort((a, b) => a.order - b.order)

  useEffect(() => {
    if (!flash) return undefined
    const timer = setTimeout(() => setFlash(null), 3000)
    return () => clearTimeout(timer)
  }, [flash])

  const say = (message) => {
    setError(null)
    setFlash(message)
  }

  async function addCategory(event) {
    event.preventDefault()
    if (!categoryForm.title.trim()) return setError('Give the category a name.')
    const hue = Math.round(Math.random() * 360)
    const saved = await contentStore.saveCategory({ ...categoryForm, hue })
    await refresh()
    setSelectedId(saved.id)
    setCategoryForm({ title: '', tagline: '', exam: categoryForm.exam })
    say(`Category "${saved.title}" created.`)
  }

  async function removeCategory(category) {
    await contentStore.deleteCategory(category.id)
    await refresh()
    setSelectedId(null)
    say(`Deleted "${category.title}" and its questions.`)
  }

  function editQuestion(item) {
    setEditingId(item.id)
    setQuestion({
      prompt: item.prompt ?? '',
      directive: item.directive ?? '',
      statements: (item.statements ?? []).join('\n'),
      closing: item.closing ?? '',
      choices: [...(item.choices ?? []), '', '', '', ''].slice(0, Math.max(4, item.choices?.length ?? 4)),
      answer: item.answer ?? -1,
      explanation: item.explanation ?? '',
    })
    setError(null)
  }

  async function saveQuestion(event) {
    event.preventDefault()
    if (!selected) return setError('Create a category first.')
    if (!question.prompt.trim()) return setError('The question needs a prompt.')
    const filled = question.choices.map((c) => c.trim()).filter(Boolean)
    if (filled.length < 2) return setError('Give at least two options.')
    if (question.answer >= 0 && !question.choices[question.answer]?.trim()) {
      return setError('The option marked correct is empty.')
    }

    await contentStore.saveQuestion({
      id: editingId ?? undefined,
      categoryId: selected.id,
      prompt: question.prompt,
      directive: question.directive,
      statements: question.statements.split('\n'),
      closing: question.closing,
      choices: question.choices,
      answer: question.answer,
      explanation: question.explanation,
      order: editingId ? mine.find((q) => q.id === editingId)?.order : Date.now(),
    })
    await refresh()
    setQuestion(BLANK_QUESTION)
    setEditingId(null)
    say(editingId ? 'Question updated.' : 'Question added.')
  }

  async function removeQuestion(id) {
    await contentStore.deleteQuestion(id)
    await refresh()
    if (editingId === id) {
      setEditingId(null)
      setQuestion(BLANK_QUESTION)
    }
    say('Question deleted.')
  }

  function exportCategory() {
    if (!selected) return
    const payload = toDataFile(selected, mine.filter((q) => Number.isInteger(q.answer) && q.answer >= 0))
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${payload.unit}.json`
    link.click()
    URL.revokeObjectURL(url)
    say('Exported in the same shape as the bundled data files.')
  }

  async function importFile(event) {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const parsed = fromDataFile(JSON.parse(await file.text()))
      const category = await contentStore.saveCategory(parsed.category)
      for (const item of parsed.questions) {
        await contentStore.saveQuestion({ ...item, categoryId: category.id })
      }
      await refresh()
      setSelectedId(category.id)
      const keyless = parsed.questions.filter((q) => q.answer < 0).length
      const count = parsed.questions.length
      say(
        `Imported ${count} question${count === 1 ? '' : 's'} into "${category.title}"` +
          (keyless ? ` — ${keyless} still ${keyless === 1 ? 'needs' : 'need'} a correct answer marked.` : '.'),
      )
    } catch (problem) {
      setError(`Could not import that file: ${problem.message}`)
    } finally {
      event.target.value = ''
    }
  }

  const customTrack = tracks.find((track) => track.custom && track.units.some((u) => u.id === selected?.id))

  return (
    <div className="admin">
      <header className="admin__header">
        <Link className="brand" to="/">
          <BookIcon width="22" height="22" />
          <span>
            MPT<span className="brand__dot">·</span>AI
          </span>
        </Link>
        <Link className="path-header__back" to="/">
          ← Back to the app
        </Link>
        <h1>Dashboard</h1>
        <p className="admin__blurb">
          Add your own categories and questions. They appear in the app immediately, on this device,
          and export in the same JSON shape as the bundled question bank.
        </p>
        {flash && (
          <p className="admin__flash" role="status">
            <CheckIcon width="16" height="16" /> {flash}
          </p>
        )}
        {error && (
          <p className="admin__error" role="alert">
            {error}
          </p>
        )}
      </header>

      <main className="admin__body">
        <section className="admin__panel">
          <h2>Categories</h2>
          <ul className="cat-list">
            {categories.length === 0 && <li className="cat-list__empty">No categories yet.</li>}
            {categories.map((category) => {
              const count = customQuestions.filter((q) => q.categoryId === category.id).length
              return (
                <li key={category.id} className={category.id === selected?.id ? 'is-selected' : undefined}>
                  <button type="button" onClick={() => setSelectedId(category.id)}>
                    <span className="cat-list__title">{category.title}</span>
                    <span className="cat-list__meta">
                      {category.exam} · {count} question{count === 1 ? '' : 's'}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Delete ${category.title}`}
                    onClick={() => removeCategory(category)}
                  >
                    <CloseIcon width="16" height="16" />
                  </button>
                </li>
              )
            })}
          </ul>

          <form className="stack" onSubmit={addCategory}>
            <h3>New category</h3>
            <label>
              Name
              <input
                value={categoryForm.title}
                onChange={(e) => setCategoryForm({ ...categoryForm, title: e.target.value })}
                placeholder="e.g. Indian Polity"
              />
            </label>
            <label>
              Description
              <input
                value={categoryForm.tagline}
                onChange={(e) => setCategoryForm({ ...categoryForm, tagline: e.target.value })}
                placeholder="optional"
              />
            </label>
            <label>
              Shows under
              <select
                value={categoryForm.exam}
                onChange={(e) => setCategoryForm({ ...categoryForm, exam: e.target.value })}
              >
                {EXAM_CHOICES.map((exam) => (
                  <option key={exam}>{exam}</option>
                ))}
              </select>
            </label>
            <button className="btn btn--small" type="submit">
              Add category
            </button>
          </form>

          <div className="stack">
            <h3>Import / export</h3>
            <button className="btn btn--small btn--ghost" type="button" onClick={() => fileRef.current?.click()}>
              Import a JSON file
            </button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
            <button
              className="btn btn--small btn--ghost"
              type="button"
              onClick={exportCategory}
              disabled={!selected}
            >
              Export this category
            </button>
          </div>
        </section>

        <section className="admin__panel admin__panel--wide">
          {selected ? (
            <>
              <h2>
                {selected.title}{' '}
                {customTrack && (
                  <Link className="admin__view" to={`/track/${customTrack.id}`}>
                    view in app →
                  </Link>
                )}
              </h2>

              <ul className="q-list">
                {mine.length === 0 && <li className="cat-list__empty">No questions in this category yet.</li>}
                {mine.map((item, index) => {
                  const keyed = Number.isInteger(item.answer) && item.answer >= 0
                  return (
                    <li key={item.id}>
                      <div>
                        <p className="q-list__prompt">
                          <span className="q-list__num">{index + 1}</span>
                          {item.prompt}
                        </p>
                        <p className="q-list__answer">
                          {keyed ? `Correct: ${item.choices[item.answer]}` : 'No correct answer marked yet'}
                        </p>
                      </div>
                      <div className="q-list__actions">
                        {!keyed && <span className="badge">needs key</span>}
                        <button className="btn btn--small btn--ghost" type="button" onClick={() => editQuestion(item)}>
                          Edit
                        </button>
                        <button
                          className="icon-btn"
                          type="button"
                          aria-label="Delete question"
                          onClick={() => removeQuestion(item.id)}
                        >
                          <CloseIcon width="16" height="16" />
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <form className="stack q-form" onSubmit={saveQuestion}>
                <h3>{editingId ? 'Edit question' : 'New question'}</h3>
                <label>
                  Prompt
                  <textarea
                    rows={2}
                    value={question.prompt}
                    onChange={(e) => setQuestion({ ...question, prompt: e.target.value })}
                    placeholder="Consider the following statements:"
                  />
                </label>
                <label>
                  Instruction line <span className="hint">optional — shown above the prompt</span>
                  <input
                    value={question.directive}
                    onChange={(e) => setQuestion({ ...question, directive: e.target.value })}
                    placeholder="Identify the SYNONYM for the given word."
                  />
                </label>
                <label>
                  Statements <span className="hint">optional — one per line, numbered I, II, III</span>
                  <textarea
                    rows={3}
                    value={question.statements}
                    onChange={(e) => setQuestion({ ...question, statements: e.target.value })}
                  />
                </label>
                <label>
                  Closing line <span className="hint">optional — e.g. "Which of the above are correct?"</span>
                  <input
                    value={question.closing}
                    onChange={(e) => setQuestion({ ...question, closing: e.target.value })}
                  />
                </label>

                <fieldset className="options">
                  <legend>Options — pick the correct one</legend>
                  {question.choices.map((choice, index) => (
                    <div className="options__row" key={index}>
                      <input
                        type="radio"
                        name="answer"
                        checked={question.answer === index}
                        onChange={() => setQuestion({ ...question, answer: index })}
                        aria-label={`Mark option ${index + 1} correct`}
                      />
                      <input
                        value={choice}
                        onChange={(e) => {
                          const choices = [...question.choices]
                          choices[index] = e.target.value
                          setQuestion({ ...question, choices })
                        }}
                        placeholder={`Option ${index + 1}`}
                      />
                    </div>
                  ))}
                  <button
                    className="btn btn--small btn--ghost"
                    type="button"
                    onClick={() => setQuestion({ ...question, choices: [...question.choices, ''] })}
                  >
                    Add another option
                  </button>
                </fieldset>

                <label>
                  Explanation <span className="hint">optional — shown after answering</span>
                  <textarea
                    rows={2}
                    value={question.explanation}
                    onChange={(e) => setQuestion({ ...question, explanation: e.target.value })}
                  />
                </label>

                <div className="q-form__actions">
                  <button className="btn" type="submit">
                    {editingId ? 'Save changes' : 'Add question'}
                  </button>
                  {editingId && (
                    <button
                      className="btn btn--ghost"
                      type="button"
                      onClick={() => {
                        setEditingId(null)
                        setQuestion(BLANK_QUESTION)
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </>
          ) : (
            <p className="cat-list__empty">Create a category on the left to start adding questions.</p>
          )}
        </section>
      </main>
    </div>
  )
}
