import { useMemo, useState } from 'react'
import directory from './data/magicconArtists.json'
import { buildDirMap, lookupCard, norm } from './scryfall.js'
import { useSaved } from './useSaved.js'

export default function App() {
  const dirMap = useMemo(() => buildDirMap(directory.artists), [])
  const saved = useSaved()
  const [view, setView] = useState('search') // 'search' | 'saved'
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)

  async function run(name) {
    const trimmed = name.trim()
    if (!trimmed) return
    setView('search')
    setQ(trimmed)
    setLoading(true)
    setErr('')
    try {
      setResult(await lookupCard(trimmed))
    } catch {
      setResult(null)
      setErr(`No card found for “${trimmed}”. Check the spelling.`)
    } finally {
      setLoading(false)
    }
  }

  function onSubmit(e) {
    e.preventDefault()
    run(q)
  }

  return (
    <div className="wrap">
      <h1>🎨 MTG Artist → MagicCon Amsterdam Checker</h1>

      <nav className="tabs">
        <button
          className={'tab' + (view === 'search' ? ' active' : '')}
          onClick={() => setView('search')}
        >
          Search
        </button>
        <button
          className={'tab' + (view === 'saved' ? ' active' : '')}
          onClick={() => setView('saved')}
        >
          My signing list
          {saved.items.length > 0 && <span className="count">{saved.items.length}</span>}
        </button>
      </nav>

      {view === 'search' ? (
        <>
          <p className="sub">
            Type a card name. It lists <b>every artist across every printing</b> (via the{' '}
            <a href="https://scryfall.com/docs/api" target="_blank" rel="noopener noreferrer">
              Scryfall API
            </a>
            ) and tells you which ones are in the{' '}
            <a
              href="https://mcamsterdam.mtgfestivals.com/en-us/art-of-magic/artist-directory.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              MagicCon Amsterdam artist directory
            </a>
            . Tap <b>✓ Save to sign</b> on an artist to add the card to your signing list.
          </p>

          <form className="searchbar" onSubmit={onSubmit} autoComplete="off">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. Lightning Bolt, Y'shtola, Sol Ring…"
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Checking…' : 'Check'}
            </button>
          </form>

          <div className={'status' + (err ? ' err' : '')}>
            {loading && <span className="spin" />}
            {err}
          </div>

          {result?.suggestions && <Suggestions list={result.suggestions} onPick={run} />}

          {result && !result.suggestions && (
            <Results key={result.card.id} dirMap={dirMap} saved={saved} {...result} />
          )}
        </>
      ) : (
        <SavedView saved={saved} dirMap={dirMap} onSearch={() => setView('search')} />
      )}

      <div className="dirinfo">
        ✅ MagicCon Amsterdam <b>Art of Magic</b> directory: <b>{directory.count}</b> artists.{' '}
        <a href={directory.source} target="_blank" rel="noopener noreferrer">
          Official directory ↗
        </a>
      </div>
    </div>
  )
}

function Suggestions({ list, onPick }) {
  return (
    <div className="suggest">
      <div className="suggest-head">Did you mean…</div>
      <div className="suggest-grid">
        {list.map((s, i) => (
          <button
            key={i}
            className="suggest-item"
            onClick={() => onPick(s.name)}
            title={s.name}
          >
            {s.thumb && <img src={s.thumb} alt="" loading="lazy" />}
            <span className="suggest-name">{s.name}</span>
            {s.set && <span className="suggest-set">{s.set}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function Results({ dirMap, saved, card, cardImg, nPrints, artists }) {
  const [showOthers, setShowOthers] = useState(false)

  const atCon = artists.filter((a) => dirMap.get(norm(a.name)))
  const others = artists.filter((a) => !dirMap.get(norm(a.name)))

  return (
    <div>
      <div className="card-head">
        {cardImg && <img src={cardImg} alt={card.name} />}
        <div>
          <h2>{card.name}</h2>
          <div className="meta">
            {nPrints} printing{nPrints !== 1 ? 's' : ''} · {artists.length} unique artist
            {artists.length !== 1 ? 's' : ''} · <b className="hit">{atCon.length} at MagicCon</b>
          </div>
        </div>
      </div>

      {atCon.length > 0 ? (
        atCon.map((a) => (
          <ArtistCard
            key={a.name}
            cardName={card.name}
            artist={a}
            hit={dirMap.get(norm(a.name))}
            saved={saved}
          />
        ))
      ) : (
        <div className="nohit">
          None of this card's artists are in the MagicCon Amsterdam directory.
        </div>
      )}

      {others.length > 0 && (
        <>
          <button
            className="toggle-others"
            onClick={() => setShowOthers((v) => !v)}
            aria-expanded={showOthers}
          >
            {showOthers ? '▾ Hide' : '▸ Show'} {others.length} artist
            {others.length !== 1 ? 's' : ''} not at MagicCon
          </button>

          {showOthers &&
            others.map((a) => (
              <ArtistCard
                key={a.name}
                cardName={card.name}
                artist={a}
                hit={dirMap.get(norm(a.name))}
                saved={saved}
              />
            ))}
        </>
      )}
    </div>
  )
}

function ArtistCard({ cardName, artist, hit, saved }) {
  const art0 = artist.arts[0]
  const id = norm(cardName) + '|' + norm(artist.name)
  const isSaved = saved.has(id)
  const item = {
    id,
    card: cardName,
    artist: artist.name,
    booth: hit?.booth || '',
    atCon: !!hit,
    img: art0?.img || '',
    label: art0?.label || '',
  }

  const shown = artist.arts.slice(0, 8)
  const extra = artist.arts.length - shown.length

  return (
    <div className="artist">
      <div className="top">
        <span className="name">{artist.name}</span>
        {hit ? (
          <span className="badge yes">
            ✅ At MagicCon Amsterdam{hit.booth ? ` · Booth ${hit.booth}` : ''}
          </span>
        ) : (
          <span className="badge no">✕ Not in directory</span>
        )}
        <button
          className={'save' + (isSaved ? ' on' : '')}
          onClick={() => saved.toggle(item)}
          title={isSaved ? 'Remove from signing list' : 'Save this card to get signed'}
        >
          {isSaved ? '✓ Saved' : '+ Save to sign'}
        </button>
      </div>

      {shown.length > 0 && (
        <div className="arts">
          {shown.map((art, i) => (
            <figure className="artfig" key={i}>
              <img
                className="art"
                src={art.img}
                alt={`card art by ${artist.name} — ${art.label}`}
                title={art.label}
                loading="lazy"
              />
              <figcaption className={'arttag' + (art.og ? ' og' : '')}>
                {art.og ? 'Original' : art.treat}
              </figcaption>
            </figure>
          ))}
          {extra > 0 && <span className="more">+{extra} more</span>}
        </div>
      )}

      <div className="prints">
        <b>{artist.arts.length}</b> artwork{artist.arts.length !== 1 ? 's' : ''} ·{' '}
        <b>{artist.prints.length}</b> printing{artist.prints.length !== 1 ? 's' : ''}:{' '}
        {artist.prints.slice(0, 12).join(', ')}
        {artist.prints.length > 12 ? ', …' : ''}
      </div>
    </div>
  )
}

function SavedView({ saved, dirMap, onSearch }) {
  const groups = useMemo(() => {
    const m = new Map()
    for (const it of saved.items) {
      if (!m.has(it.artist)) m.set(it.artist, [])
      m.get(it.artist).push(it)
    }
    return [...m.entries()]
      .map(([artist, cards]) => {
        const hit = dirMap.get(norm(artist))
        return { artist, cards, booth: hit?.booth || '', atCon: !!hit }
      })
      .sort(
        (a, b) =>
          b.atCon - a.atCon ||
          (a.booth || 'zzz').localeCompare(b.booth || 'zzz') ||
          a.artist.localeCompare(b.artist),
      )
  }, [saved.items, dirMap])

  if (!saved.items.length) {
    return (
      <div className="empty">
        <p>No cards saved yet.</p>
        <p className="sub">
          Search a card and tap <b>✓ Save to sign</b> on an artist to build your
          signing route.
        </p>
        <button onClick={onSearch}>Go to search</button>
      </div>
    )
  }

  const attending = groups.filter((g) => g.atCon).length

  return (
    <div>
      <div className="saved-summary">
        <b>{saved.items.length}</b> card{saved.items.length !== 1 ? 's' : ''} ·{' '}
        <b>{groups.length}</b> artist{groups.length !== 1 ? 's' : ''} ·{' '}
        <b>{attending}</b> at MagicCon
        <button className="linkbtn" onClick={saved.clear}>
          Clear all
        </button>
      </div>

      {groups.map((g) => (
        <div className="artist" key={g.artist}>
          <div className="top">
            <span className="name">{g.artist}</span>
            {g.atCon ? (
              <span className="badge yes">
                ✅ At MagicCon Amsterdam{g.booth ? ` · Booth ${g.booth}` : ''}
              </span>
            ) : (
              <span className="badge no">✕ Not attending</span>
            )}
          </div>

          <div className="saved-cards">
            {g.cards.map((c) => (
              <div className="saved-card" key={c.id}>
                {c.img && <img src={c.img} alt={c.card} loading="lazy" />}
                <div className="saved-card-info">
                  <div className="saved-card-name">{c.card}</div>
                  {c.label && <div className="saved-card-set">{c.label}</div>}
                </div>
                <button
                  className="rm"
                  onClick={() => saved.remove(c.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
