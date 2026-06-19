# MTG Artist → MagicCon Amsterdam Checker

Type a Magic: The Gathering card name and see **every artist across every printing**
(via the [Scryfall API](https://scryfall.com/docs/api)), with the full card image for
each artwork, and a badge showing whether each artist is in the
**MagicCon: Amsterdam 2026 — Art of Magic** directory (with their booth number).

The attendee list is a bundled snapshot in `src/data/magicconArtists.json`, parsed from
the official exhibitor grid. `aliases` map booth display names to the names Scryfall
credits cards under (e.g. the "Gabor" / "Zoltan" tiles are Gabor Szikszai / Zoltan Boros).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # serve the built dist/ locally
```

## Deploy to Netlify

`netlify.toml` is already configured (build `npm run build`, publish `dist`).

**Option A — Git (recommended):** push this folder to a GitHub repo, then in Netlify:
"Add new site" → "Import an existing project" → pick the repo. Netlify reads
`netlify.toml`, so no manual settings are needed.

**Option B — CLI / drag-and-drop:**

```bash
npm run build
npx netlify-cli deploy --prod --dir=dist
```

or drag the `dist/` folder onto https://app.netlify.com/drop.

## Updating the artist list

When the festival updates its directory, re-paste the rendered exhibitor grid and
regenerate `src/data/magicconArtists.json` (keep the `count` field in sync).
