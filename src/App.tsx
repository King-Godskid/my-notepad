import { useEffect, useState, type FormEvent } from 'react'
import { checkNote, type Note } from './actions'
import './App.css'

const NOTES_STORAGE_KEY = 'my-notepad-notes'

function isNoteArray(value: unknown): value is Note[] {
  return (
    Array.isArray(value) &&
    value.every(
      (note) =>
        typeof note === 'object' &&
        note !== null &&
        'title' in note &&
        typeof note.title === 'string' &&
        'body' in note &&
        typeof note.body === 'string' &&
        'tags' in note &&
        Array.isArray(note.tags) &&
        note.tags.every((tag: unknown) => typeof tag === 'string'),
    )
  )
}

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [storageReady, setStorageReady] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  useEffect(() => {
    try {
      const savedNotes = window.localStorage.getItem(NOTES_STORAGE_KEY)
      if (savedNotes !== null) {
        const parsedNotes: unknown = JSON.parse(savedNotes)
        if (!isNoteArray(parsedNotes)) {
          throw new Error('Saved notes have an invalid format.')
        }
        setNotes(parsedNotes)
      }
    } catch {
      setStorageError(
        'Saved notes could not be loaded. Saving a new note will replace the unreadable data.',
      )
    } finally {
      setStorageReady(true)
    }
  }, [])

  useEffect(() => {
    if (!storageReady || !hasChanges) {
      return
    }

    try {
      window.localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes))
      setStorageError('')
    } catch {
      setStorageError('Your note is shown here, but could not be saved in this browser.')
    }
  }, [hasChanges, notes, storageReady])

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const result = checkNote(new FormData(form))

    if (!result.ok) {
      setError(result.error)
      return
    }

    setNotes((currentNotes) => [...currentNotes, result.note])
    setHasChanges(true)
    setError('')
    form.reset()
  }

  return (
    <main className="notes-app">
      <header className="page-header">
        <p className="eyebrow">YOUR SPACE TO THINK</p>
        <h1>My notes</h1>
        <p className="page-description">
          Capture an idea while it’s fresh.
        </p>
      </header>

      <section className="note-composer" aria-labelledby="composer-title">
        <h2 id="composer-title">Write a note</h2>
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="title">Title</label>
          <input
            id="title"
            name="title"
            type="text"
            placeholder="Give your note a title"
            aria-describedby={error ? 'form-error' : undefined}
          />

          <label htmlFor="body">Note</label>
          <textarea
            id="body"
            name="body"
            rows={6}
            placeholder="Write something worth remembering..."
            aria-describedby={error ? 'form-error' : undefined}
          />

          <label htmlFor="tags">Tags</label>
          <input
            id="tags"
            name="tags"
            type="text"
            placeholder="work, ideas, someday"
            aria-describedby="tags-hint"
          />
          <p id="tags-hint" className="field-hint">
            Separate tags with commas.
          </p>

          {error && (
            <p id="form-error" className="form-error" role="alert">
              {error}
            </p>
          )}
          {storageError && (
            <p className="form-error" role="alert">
              {storageError}
            </p>
          )}

          <button type="submit">Save note</button>
        </form>
      </section>

      <section className="notes-list" aria-labelledby="notes-title">
        <div className="section-heading">
          <h2 id="notes-title">Your notes</h2>
          <span className="note-count">{notes.length}</span>
        </div>

        {notes.length === 0 ? (
          <p className="empty-state">Your saved notes will appear here.</p>
        ) : (
          <ul>
            {notes.map((note, index) => (
              <li className="note-card" key={index}>
                <h3>{note.title}</h3>
                <p className="note-body">{note.body}</p>
                {note.tags.length > 0 && (
                  <ul className="tag-list" aria-label="Tags">
                    {note.tags.map((tag) => (
                      <li key={tag}>{tag}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}

export default App
