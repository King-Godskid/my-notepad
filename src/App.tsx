import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { checkNote, type Note } from './actions'
import './App.css'

const NOTES_STORAGE_KEY = 'my-notepad-notes'
const SUGGESTED_TAGS = [
  'work',
  'personal',
  'ideas',
  'church',
  'home',
  'someday',
  'study',
  'travel',
]

type FormatAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'heading'
  | 'bullet-list'
  | 'numbered-list'

const FORMAT_ACTIONS: Array<[FormatAction, string]> = [
  ['bold', 'Bold'],
  ['italic', 'Italic'],
  ['underline', 'Underline'],
  ['heading', 'Heading'],
  ['bullet-list', 'Bulleted list'],
  ['numbered-list', 'Numbered list'],
]

const noteMarkdownSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), 'u'],
}

function getNoteSearchText(body: string) {
  return body
    .replace(/<[^>]*>/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^\s*(?:[-+*]|\d+\.)\s+/gm, ' ')
    .replace(/[*_`~#>]/g, ' ')
    .toLowerCase()
}

function nodeToMarkdown(node: Node, listDepth = 0): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent ?? ''
  }

  if (!(node instanceof HTMLElement)) {
    return ''
  }

  const children = Array.from(node.childNodes)
    .map((child) => nodeToMarkdown(child, listDepth))
    .join('')
  const tag = node.tagName.toLowerCase()

  if (tag === 'strong' || tag === 'b') return `**${children}**`
  if (tag === 'em' || tag === 'i') return `*${children}*`
  if (tag === 'u') return `<u>${children}</u>`
  if (tag === 'code') return `\`${children}\``
  if (tag === 'br') return '\n'
  if (/^h[1-6]$/.test(tag)) {
    return `${'#'.repeat(Number(tag[1]))} ${children.trim()}\n\n`
  }
  if (tag === 'p' || tag === 'div') return `${children.trim()}\n\n`
  if (tag === 'blockquote') {
    return `${children.trim().split('\n').map((line) => `> ${line}`).join('\n')}\n\n`
  }
  if (tag === 'a') {
    const href = node.getAttribute('href')
    return href ? `[${children}](${href})` : children
  }
  if (tag === 'ul' || tag === 'ol') {
    const items = Array.from(node.children).filter(
      (child) => child.tagName.toLowerCase() === 'li',
    )
    const markdownItems = items
      .map((item, index) => {
        const content = Array.from(item.childNodes)
          .map((child) => nodeToMarkdown(child, listDepth + 1))
          .join('')
          .trim()
        if (!content) {
          return ''
        }
        const marker = tag === 'ol' ? `${index + 1}.` : '-'
        return `${'  '.repeat(listDepth)}${marker} ${content}`
      })
      .filter(Boolean)
    return markdownItems.length ? `${markdownItems.join('\n')}\n\n` : ''
  }
  if (tag === 'pre') return `\`\`\`\n${node.textContent?.trim() ?? ''}\n\`\`\`\n\n`

  return children
}

function editorToMarkdown(editor: HTMLElement) {
  let markdown = ''
  let previousWasBlock = false

  for (const child of Array.from(editor.childNodes)) {
    const isBlock =
      child instanceof HTMLElement &&
      /^(H[1-6]|P|DIV|UL|OL|PRE|BLOCKQUOTE)$/.test(child.tagName)
    if (isBlock && markdown && !markdown.endsWith('\n\n')) {
      markdown = `${markdown.trimEnd()}\n\n`
    } else if (previousWasBlock && markdown && !markdown.endsWith('\n\n')) {
      markdown = `${markdown.trimEnd()}\n\n`
    }

    markdown += nodeToMarkdown(child).trim()
    if (isBlock) {
      markdown += '\n\n'
    }
    previousWasBlock = isBlock
  }

  return markdown.trim()
}

function FormatIcon({ action }: { action: FormatAction }) {
  const commonProps = {
    'aria-hidden': true as const,
    fill: 'none',
    height: 18,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
    width: 18,
  }

  switch (action) {
    case 'bold':
      return <svg {...commonProps}><path d="M7 5h6a4 4 0 0 1 0 8H7zM7 13h7a4 4 0 0 1 0 8H7z" /></svg>
    case 'italic':
      return <svg {...commonProps}><path d="M14 4h6M4 20h6M15 4 9 20" /></svg>
    case 'underline':
      return <svg {...commonProps}><path d="M7 4v7a5 5 0 0 0 10 0V4M5 21h14" /></svg>
    case 'heading':
      return <svg {...commonProps}><path d="M5 5v14M19 5v14M5 12h14" /></svg>
    case 'bullet-list':
      return <svg {...commonProps}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle cx="4" cy="12" r="1" fill="currentColor" /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg>
    case 'numbered-list':
      return <svg {...commonProps}><path d="M10 6h10M10 12h10M10 18h10M4 5h1v3M4 11h2l-2 2h2M4 17h2l-2 2h2" /></svg>
  }
}

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
  const [editorVersion, setEditorVersion] = useState(0)
  const [activeFormats, setActiveFormats] = useState<Record<FormatAction, boolean>>({
    bold: false,
    italic: false,
    underline: false,
    heading: false,
    'bullet-list': false,
    'numbered-list': false,
  })
  const editorRef = useRef<HTMLDivElement>(null)
  const markdownBodyRef = useRef<HTMLTextAreaElement>(null)
  const tagsInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [storageReady, setStorageReady] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const searchTerms = searchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const allTags = [...new Set(notes.flatMap((note) => note.tags))]
  const filteredNotes = notes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => {
      const title = note.title.toLowerCase()
      const body = getNoteSearchText(note.body)
      return (
        (!selectedTag || note.tags.includes(selectedTag)) &&
        searchTerms.every((term) => title.includes(term) || body.includes(term))
      )
    })

  function addSuggestedTag(tag: string) {
    const input = tagsInputRef.current
    if (!input) {
      return
    }

    const tags = input.value.split(',').map((value) => value.trim()).filter(Boolean)
    if (tags.some((value) => value.toLowerCase() === tag)) {
      return
    }

    input.value = [...tags, tag].join(', ')
    input.focus()
  }

  function syncEditorMarkdown() {
    if (!editorRef.current || !markdownBodyRef.current) {
      return
    }

    markdownBodyRef.current.value = editorToMarkdown(editorRef.current)
    editorRef.current.dataset.empty = String(!editorRef.current.textContent?.trim())
  }

  function updateActiveFormats() {
    const editor = editorRef.current
    const selection = document.getSelection()
    if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) {
      return
    }

    const anchor =
      selection.anchorNode.nodeType === Node.ELEMENT_NODE
        ? (selection.anchorNode as Element)
        : selection.anchorNode.parentElement
    const hasAncestor = (selector: string) => {
      const match = anchor?.closest(selector)
      return Boolean(match && editor.contains(match))
    }
    const insideHeading = hasAncestor('h1, h2, h3, h4, h5, h6')

    setActiveFormats({
      bold:
        hasAncestor('strong, b') ||
        (!insideHeading && document.queryCommandState('bold')),
      italic: document.queryCommandState('italic') || hasAncestor('em, i'),
      underline: document.queryCommandState('underline') || hasAncestor('u'),
      heading: insideHeading,
      'bullet-list': hasAncestor('ul'),
      'numbered-list': hasAncestor('ol'),
    })
  }

  function handleEditorKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (![' ', 'Enter', 'Backspace'].includes(event.key)) {
      return
    }

    const editor = editorRef.current
    const selection = document.getSelection()
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null
    const anchor =
      selection?.anchorNode?.nodeType === Node.ELEMENT_NODE
        ? (selection.anchorNode as Element)
        : selection?.anchorNode?.parentElement

    if (editor && selection?.isCollapsed && (event.key === ' ' || event.key === 'Enter')) {
      const insideHeading = Boolean(anchor?.closest('h1, h2, h3, h4, h5, h6'))
      const formatsSwitchedOff: Partial<Record<FormatAction, boolean>> = {}

      for (const [action, command] of [
        ['bold', 'bold'],
        ['italic', 'italic'],
        ['underline', 'underline'],
      ] as const) {
        if (action === 'bold' && insideHeading && !anchor?.closest('strong, b')) {
          continue
        }

        if (document.queryCommandState(command) || activeFormats[action]) {
          document.execCommand(command, false)
          formatsSwitchedOff[action] = false
        }
      }

      updateActiveFormats()
      if (Object.keys(formatsSwitchedOff).length > 0) {
        setActiveFormats((current) => ({ ...current, ...formatsSwitchedOff }))
      }
    }

    const listItem = anchor?.closest('li')

    if (
      editor &&
      selection?.isCollapsed &&
      range &&
      listItem &&
      editor.contains(listItem) &&
      !listItem.textContent?.trim()
    ) {
      event.preventDefault()
      const list = listItem.parentElement
      const listParent = list?.parentElement
      const followingItems = list
        ? Array.from(list.children).slice(
            Array.from(list.children).indexOf(listItem) + 1,
          )
        : []
      const followingList = list?.cloneNode(false) as HTMLOListElement | null
      followingItems.forEach((item) => followingList?.append(item))
      const listNextSibling = list?.nextSibling ?? null
      const hasPreviousItems =
        list !== null && list !== undefined && list.children.length > 1

      if (list && !hasPreviousItems) {
        list.remove()
      } else {
        listItem.remove()
      }

      const paragraph = document.createElement('p')
      paragraph.append(document.createElement('br'))
      const insertionAnchor = hasPreviousItems ? list?.nextSibling ?? null : listNextSibling
      listParent?.insertBefore(paragraph, insertionAnchor)

      if (followingItems.length > 0 && followingList) {
        listParent?.insertBefore(followingList, insertionAnchor)
      }

      const nextRange = document.createRange()
      nextRange.setStart(paragraph, 0)
      nextRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(nextRange)
      syncEditorMarkdown()
      updateActiveFormats()
      return
    }

    if (event.key !== 'Enter') {
      return
    }

    const heading = anchor?.closest('h1, h2, h3, h4, h5, h6')

    if (
      !editor ||
      !selection?.isCollapsed ||
      !range ||
      !heading ||
      !editor.contains(heading)
    ) {
      return
    }

    event.preventDefault()
    const paragraph = document.createElement('p')
    const remainingContent = document.createRange()
    remainingContent.selectNodeContents(heading)
    remainingContent.setStart(range.startContainer, range.startOffset)
    paragraph.append(remainingContent.extractContents())
    if (!paragraph.textContent?.trim()) {
      paragraph.replaceChildren(document.createElement('br'))
    }
    heading.after(paragraph)
    const nextRange = document.createRange()
    nextRange.setStart(paragraph, 0)
    nextRange.collapse(true)
    selection.removeAllRanges()
    selection.addRange(nextRange)
    syncEditorMarkdown()
    updateActiveFormats()
  }

  useEffect(() => {
    function handleSelectionChange() {
      updateActiveFormats()
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

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
      setStorageError('Your changes are shown here, but could not be saved in this browser.')
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
    setEditorVersion((version) => version + 1)
    setActiveFormats({
      bold: false,
      italic: false,
      underline: false,
      heading: false,
      'bullet-list': false,
      'numbered-list': false,
    })
  }

  function handleDelete(index: number) {
    setNotes((currentNotes) =>
      currentNotes.filter((_, currentIndex) => currentIndex !== index),
    )
    setHasChanges(true)
  }

  function applyFormatting(action: FormatAction) {
    const editor = editorRef.current
    if (!editor || !markdownBodyRef.current) {
      return
    }

    editor.focus()
    const selection = document.getSelection()
    const hasSelection = Boolean(selection && !selection.isCollapsed)
    const commandByAction: Record<FormatAction, [string, string?]> = {
      bold: ['bold'],
      italic: ['italic'],
      underline: ['underline'],
      heading: ['formatBlock', activeFormats.heading ? '<p>' : '<h1>'],
      'bullet-list': ['insertUnorderedList'],
      'numbered-list': ['insertOrderedList'],
    }
    const [command, value] = commandByAction[action]
    document.execCommand(command, false, value)
    if (
      hasSelection &&
      selection &&
      (action === 'bold' || action === 'italic' || action === 'underline')
    ) {
      selection.collapseToEnd()
      const range = selection.getRangeAt(0)
      const anchor =
        range.startContainer.nodeType === Node.ELEMENT_NODE
          ? (range.startContainer as Element)
          : range.startContainer.parentElement
      const markSelector = {
        bold: 'strong, b',
        italic: 'em, i',
        underline: 'u',
      }[action]
      const mark = anchor?.closest(markSelector)
      if (mark && editor.contains(mark) && mark.contains(range.startContainer)) {
        const trailingRange = document.createRange()
        trailingRange.selectNodeContents(mark)
        trailingRange.setStart(range.startContainer, range.startOffset)
        const trailingContent = trailingRange.extractContents()
        const caret = document.createTextNode('')
        mark.after(caret, trailingContent)
        selection.setPosition(caret, 0)
      }
      if (document.queryCommandState(command)) {
        document.execCommand(command, false)
      }
    }
    syncEditorMarkdown()
    if (!hasSelection) {
      setActiveFormats((current) => ({
        ...current,
        [action]: !current[action],
      }))
    } else {
      updateActiveFormats()
    }
  }

  return (
    <main className="notes-app">
      <header className="page-header">
        <p className="eyebrow">Where thoughts take shape</p>
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

          <label htmlFor="body-editor">Note</label>
          <div className="note-editor-frame">
            <div className="formatting-toolbar" role="toolbar" aria-label="Note formatting">
              {FORMAT_ACTIONS.map(([action, label]) => (
                <button
                  key={action}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={activeFormats[action]}
                  className={activeFormats[action] ? 'is-active' : undefined}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyFormatting(action)}
                >
                  <FormatIcon action={action} />
                </button>
              ))}
            </div>
            <div
              id="body-editor"
              className="note-editor"
              key={editorVersion}
              ref={editorRef}
              contentEditable
              role="textbox"
              aria-label="Note"
              aria-placeholder="Write something worth remembering..."
              aria-multiline="true"
              data-empty="true"
              suppressContentEditableWarning
              onInput={syncEditorMarkdown}
              onKeyDown={handleEditorKeyDown}
              onKeyUp={updateActiveFormats}
              onMouseUp={updateActiveFormats}
            />
          </div>
          <textarea
            id="body-markdown"
            name="body"
            ref={markdownBodyRef}
            hidden
            readOnly
          />

          <label htmlFor="tags">Tags</label>
          <input
            id="tags"
            name="tags"
            ref={tagsInputRef}
            type="text"
            placeholder="work, ideas, someday"
            aria-describedby="tags-hint"
          />
          <p id="tags-hint" className="field-hint">
            Choose a suggestion or enter any tags separated by commas.
          </p>
          <div className="tag-filters suggested-tags" role="group" aria-label="Suggested tags">
            {SUGGESTED_TAGS.map((tag) => (
              <button
                className="tag-filter-button"
                key={tag}
                type="button"
                aria-label={`Add ${tag} tag`}
                onClick={() => addSuggestedTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>

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
          <span className="note-count">{filteredNotes.length}</span>
        </div>

        <label className="search-label" htmlFor="note-search">
          Search notes
        </label>
        <input
          id="note-search"
          className="note-search"
          type="search"
          placeholder="Search titles and notes"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
        />

        <div className="tag-filters" role="group" aria-label="Filter notes by tag">
          <button
            className={`tag-filter-button${selectedTag === null ? ' is-active' : ''}`}
            type="button"
            aria-pressed={selectedTag === null}
            onClick={() => setSelectedTag(null)}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              className={`tag-filter-button${selectedTag === tag ? ' is-active' : ''}`}
              key={tag}
              type="button"
              aria-pressed={selectedTag === tag}
              onClick={() => setSelectedTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>

        {notes.length === 0 ? (
          <p className="empty-state">Your saved notes will appear here.</p>
        ) : filteredNotes.length === 0 ? (
          <p className="empty-state">No notes match</p>
        ) : (
          <ul>
            {filteredNotes.map(({ note, index }) => (
              <li className="note-card" key={index}>
                <div className="note-card-heading">
                  <h3>{note.title}</h3>
                  <button
                    className="delete-note-button"
                    type="button"
                    aria-label={`Delete ${note.title}`}
                    onClick={() => handleDelete(index)}
                  >
                    Delete
                  </button>
                </div>
                <div className="note-body markdown-content">
                  <ReactMarkdown
                    rehypePlugins={[rehypeRaw, [rehypeSanitize, noteMarkdownSchema]]}
                  >
                    {note.body}
                  </ReactMarkdown>
                </div>
                {note.tags.length > 0 && (
                  <ul className="tag-list" aria-label="Tags">
                    {note.tags.map((tag) => (
                      <li key={tag}>
                        <button
                          className="note-tag-button"
                          type="button"
                          aria-label={`Show notes tagged ${tag}`}
                          onClick={() => setSelectedTag(tag)}
                        >
                          {tag}
                        </button>
                      </li>
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
