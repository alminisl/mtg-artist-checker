import { useMemo, useState } from 'react'
import directory from './data/magicconArtists.json'
import { buildDirMap, lookupCard, norm } from './scryfall.js'

export default function App() {
  const dirMap = useMemo(() => buildDirMap(directory.artists), [])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [result, setResult] = useState(null)

  async function onSubmit(e) {
    e.preventDefault()
    const name = q.trim()
    if (!name) return
    setLoading(true)
    setErr('')
    try {
      setResult(await lookupCard(name))
    } catch {
      setResult(null)
      setErr(`No card found for “${name}”. Check the spelling.`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="wrap">
      <h1>🎨 MTG Artist → MagicCon Amsterdam Checker</h1>
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
        .
      </p>

      <form className="searchbar" onSubmit={onSubmit} autoComplete="off">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="e.g. Lightning Bolt, Wrath of God, Sol Ring…"
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Checking…' : 'Check'}
        </button>
      </form>

      <div className={'status' + (err ? ' err' : '')}>
        {loading && <span className="spin" />}
        {err}
      </div>

      {result && <Results dirMap={dirMap} {...result} />}

      <div className="dirinfo">
        ✅ MagicCon Amsterdam <b>Art of Magic</b> directory: <b>{directory.count}</b> artists.{' '}
        <a href={directory.source} target="_blank" rel="noopener noreferrer">
          Official directory ↗
        </a>
      </div>
    </div>
  )
}

function Results({ dirMap, card, cardImg, nPrints, artists }) {
  return (
    <div>
      <div className="card-head">
        {cardImg && <img src={cardImg} alt={card.name} />}
        <div>
          <h2>{card.name}</h2>
          <div className="meta">
            {nPrints} printing{nPrints !== 1 ? 's' : ''} · {artists.length} unique artist
            {artists.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {artists.map((a) => (
        <ArtistCard key={a.name} artist={a} hit={dirMap.get(norm(a.name))} />
      ))}
    </div>
  )
}

function ArtistCard({ artist, hit }) {
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
      </div>

      {shown.length > 0 && (
        <div className="arts">
          {shown.map((art, i) => (
            <img
              key={i}
              className="art"
              src={art.img}
              alt={`${card_alt(artist.name)} — ${art.label}`}
              title={art.label}
              loading="lazy"
            />
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

const card_alt = (name) => `card art by ${name}`
