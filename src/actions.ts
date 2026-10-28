export type Note = {
  title: string
  body: string
  tags: string[]
}

export type CheckNoteResult =
  | { ok: false; error: string }
  | { ok: true; note: Note }

export function checkNote(formData: FormData): CheckNoteResult {
  const title = formData.get('title')
  const body = formData.get('body')

  if (typeof title !== 'string' || title.trim() === '') {
    return { ok: false, error: 'Please enter a title.' }
  }

  if (typeof body !== 'string' || body.trim() === '') {
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
