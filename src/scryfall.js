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

// Classify a printing's visual treatment. '' = standard/original art.
function treatmentOf(card) {
  const fe = card.frame_effects || []
  if (card.border_color === 'borderless') return 'Borderless'
  if (fe.includes('extendedart')) return 'Extended art'
  if (fe.includes('showcase')) return 'Showcase'
  if (card.full_art) return 'Full art'
  if (fe.includes('etched')) return 'Etched'
  return ''
}

// Per-printing artist contributions: { artist, illId, treat, img, label }.
// Handles "A & B" joint credits and multi-face cards (each face its own art).
function contributions(card) {
  const out = []
  const treat = treatmentOf(card)
  const label = setLabel(card) + (treat ? ` · ${treat}` : '')
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
          treat,
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

// Resolve a typed name to a single card, or a list of suggestions.
// Tries exact-ish fuzzy first; on "not found" / "ambiguous" it falls back to a
// full name search so partial queries like "yshtola" still surface matches.
async function resolveCard(name) {
  try {
    const card = await sf(
      'https://api.scryfall.com/cards/named?fuzzy=' + encodeURIComponent(name),
    )
    return { card }
  } catch {
    const res = await fetch(
      'https://api.scryfall.com/cards/search?order=name&unique=cards&q=' +
        encodeURIComponent(name),
      { headers: { Accept: 'application/json' } },
    )
    const j = await res.json()
    const list = (j && j.object !== 'error' && j.data) || []
    if (list.length === 1) return { card: list[0] }
    if (list.length > 1) {
      return {
        suggestions: list.slice(0, 20).map((c) => ({
          name: c.name,
          set: (c.set || '').toUpperCase(),
          thumb:
            c.image_uris?.art_crop ||
            c.card_faces?.[0]?.image_uris?.art_crop ||
            '',
        })),
      }
    }
    throw new Error('not found')
  }
}

// Resolve a card by (fuzzy) name and aggregate every artist across every printing.
// Returns either { suggestions: [...] } or the full aggregated result.
export async function lookupCard(name) {
  const resolved = await resolveCard(name)
  if (resolved.suggestions) return { suggestions: resolved.suggestions }
  const named = resolved.card

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

  // Order so the standard/original printing wins as the representative for each
  // (illustration + treatment): non-promo first, then earliest released.
  prints.sort((a, b) => {
    const pa = a.set_type === 'promo' ? 1 : 0
    const pb = b.set_type === 'promo' ? 1 : 0
    if (pa !== pb) return pa - pb
    return (a.released_at || '').localeCompare(b.released_at || '')
  })

  // artist -> { printings, distinct artworks keyed by illustration + treatment }
  const map = new Map()
  for (const c of prints) {
    for (const con of contributions(c)) {
      const k = norm(con.artist)
      if (!map.has(k))
        map.set(k, { name: con.artist, prints: new Set(), arts: new Map() })
      const e = map.get(k)
      e.prints.add(con.label)
      const artKey = con.illId + '|' + (con.treat || '')
      if (con.img && !e.arts.has(artKey))
        e.arts.set(artKey, {
          img: con.img,
          label: con.label,
          treat: con.treat,
          og: !con.treat,
        })
    }
  }

  const artists = [...map.values()]
    .map((a) => ({
      name: a.name,
      prints: [...a.prints],
      // original art(s) first, then alternate treatments
      arts: [...a.arts.values()].sort((x, y) => (x.og ? 0 : 1) - (y.og ? 0 : 1)),
    }))
    .sort((x, y) => x.name.localeCompare(y.name))

  const cardImg =
    named.image_uris?.normal ||
    named.card_faces?.[0]?.image_uris?.normal ||
    ''

  return { card: named, cardImg, nPrints: prints.length, artists }
}
