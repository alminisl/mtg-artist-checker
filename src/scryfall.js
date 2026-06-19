// Scryfall lookups + artist aggregation.

const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

export { norm }

// Build a lookup map: normalized name/alias -> { name, booth }
export function buildDirMap(artists) {
  const m = new Map()
  for (const a of artists) {
    if (!a.name) continue
    for (const key of [a.name, ...(a.aliases || [])]) {
      m.set(norm(key), { name: a.name, booth: a.booth })
    }
  }
  return m
}

async function sf(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json' } })
  const j = await r.json()
  if (j.object === 'error') throw new Error(j.details || 'Scryfall error')
  return j
}

const setLabel = (c) =>
  `${(c.set || '').toUpperCase()} #${c.collector_number || '?'}`

// Per-printing artist contributions: { artist, illId, img, label }.
// Handles "A & B" joint credits and multi-face cards (each face its own art).
function contributions(card) {
  const out = []
  const label = setLabel(card)
  const add = (artistStr, illId, uris) => {
    const u = uris || card.image_uris
    const img = u && (u.normal || u.large || u.png || u.small) // full card image
    ;(artistStr || '')
      .split(' & ')
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((a) =>
        out.push({
          artist: a,
          illId: illId || card.illustration_id || img || a,
          img,
          label,
        }),
      )
  }
  if (Array.isArray(card.card_faces) && card.card_faces.some((f) => f.artist)) {
    card.card_faces.forEach((f) => add(f.artist, f.illustration_id, f.image_uris))
  } else {
    add(card.artist, card.illustration_id, card.image_uris)
  }
  return out
}

// Resolve a card by (fuzzy) name and aggregate every artist across every printing.
export async function lookupCard(name) {
  const named = await sf(
    'https://api.scryfall.com/cards/named?fuzzy=' + encodeURIComponent(name),
  )

  let url =
    named.prints_search_uri ||
    'https://api.scryfall.com/cards/search?order=released&unique=prints&q=' +
      encodeURIComponent('oracleid:' + named.oracle_id)

  const prints = []
  try {
    while (url) {
      const page = await sf(url)
      prints.push(...(page.data || []))
      url = page.has_more ? page.next_page : null
    }
  } catch {
    /* fall back to the single card below */
  }
  if (!prints.length) prints.push(named)

  // artist -> { printings, distinct artworks keyed by illustration_id }
  const map = new Map()
  for (const c of prints) {
    for (const con of contributions(c)) {
      const k = norm(con.artist)
      if (!map.has(k))
        map.set(k, { name: con.artist, prints: new Set(), arts: new Map() })
      const e = map.get(k)
      e.prints.add(con.label)
      if (con.img && !e.arts.has(con.illId))
        e.arts.set(con.illId, { img: con.img, label: con.label })
    }
  }

  const artists = [...map.values()]
    .map((a) => ({
      name: a.name,
      prints: [...a.prints],
      arts: [...a.arts.values()],
    }))
    .sort((x, y) => x.name.localeCompare(y.name))

  const cardImg =
    named.image_uris?.normal ||
    named.card_faces?.[0]?.image_uris?.normal ||
    ''

  return { card: named, cardImg, nPrints: prints.length, artists }
}
