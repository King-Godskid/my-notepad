export type Note = {
  title: string
  body: string
  tags: string[]
}

export type CheckNoteResult =
  | { ok: false; error: string }
  | { ok: true; note: Note }

export function checkNote(formData: FormData): CheckNoteResult {
  const rawTitle = formData.get('title')
  const rawBody = formData.get('body')
  const title = typeof rawTitle === 'string' ? rawTitle.trim() : ''
  const body = typeof rawBody === 'string' ? rawBody.trim() : ''

  if (title === '') {
    return { ok: false, error: 'Please enter a title.' }
  }

  if (body === '') {
    return { ok: false, error: 'Please enter a note body.' }
  }

  const rawTags = formData.get('tags')
  const tags =
    typeof rawTags === 'string'
      ? [...new Set(rawTags.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean))]
      : []

  return {
    ok: true,
    note: { title, body, tags },
  }
}
