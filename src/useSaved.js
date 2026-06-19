import { useEffect, useState } from 'react'

const KEY = 'mtg-signing-list-v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

// localStorage-backed list of cards you want signed.
// Each item: { id, card, artist, booth, atCon, img, label, savedAt }
export function useSaved() {
  const [items, setItems] = useState(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      /* quota / private mode — ignore */
    }
  }, [items])

  // keep multiple tabs in sync
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === KEY) setItems(load())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const has = (id) => items.some((i) => i.id === id)

  const toggle = (item) =>
    setItems((prev) =>
      prev.some((i) => i.id === item.id)
        ? prev.filter((i) => i.id !== item.id)
        : [...prev, { ...item, savedAt: Date.now() }],
    )

  const remove = (id) => setItems((prev) => prev.filter((i) => i.id !== id))

  const clear = () => setItems([])

  return { items, has, toggle, remove, clear }
}
