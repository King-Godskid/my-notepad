import { useState, type FormEvent } from 'react'
import { checkNote, type Note } from './actions'
import './App.css'

function App() {
  const [notes, setNotes] = useState<Note[]>([])
  const [error, setError] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const result = checkNote(new FormData(form))

    if (!result.ok) {
      setError(result.error)
      return
    }

    setNotes((currentNotes) => [...currentNotes, result.note])
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
