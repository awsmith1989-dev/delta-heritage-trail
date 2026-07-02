# Delta Heritage Trail

Static site for [deltaheritagetrail.com](https://deltaheritagetrail.com), built for Netlify.
It renders an interactive Mapbox map, a trail towns directory, and ride-planning
content, all backed by an Airtable base (`app0dT6mWldFyWgcm`) through a Netlify
serverless proxy so the Airtable API key never reaches the browser.

## Structure

```
netlify.toml                    Netlify build/redirect/header config
netlify/functions/airtable.js   Proxies Airtable reads (whitelisted tables only)
netlify/functions/mapbox-token.js  Serves the Mapbox token to the frontend
public/                         Static site (Netlify publish directory)
  index.html
  css/styles.css
  js/                           ES modules: data.js, normalize.js, map.js, osm-poi.js,
                                 amenity-icons.js, towns.js, stats.js, app.js
```

No build step or bundler is required — `public/` is deployed as-is and the
functions run on Node's built-in `fetch`.

## Environment variables

Set these in the Netlify site settings (Site configuration → Environment variables),
or in a local `.env` file for `netlify dev` (see `.env.example`):

| Variable            | Description                                                        |
|---------------------|----------------------------------------------------------------------|
| `AIRTABLE_API_KEY`  | Airtable personal access token with read access to the base          |
| `AIRTABLE_BASE_ID`  | `app0dT6mWldFyWgcm`                                                   |
| `MAPBOX_TOKEN`      | A public Mapbox access token, restricted to your site's URL(s)       |

## Airtable schema

The proxy (`netlify/functions/airtable.js`) whitelists three tables by ID and
exposes them at `/.netlify/functions/airtable?table=<key>`:

| Query key     | Airtable table                    | Key fields used by the site |
|---------------|------------------------------------|------------------------------|
| `segments`    | Track Trail Segments (`Segments`)  | Segment Name, Distance in Miles, Status, Communities (linked) |
| `communities` | Manage Trail Communities (`Communities`) | Community Name, Latitude, Longitude, Description, Niche Identity, Trail Ready Status, Website, Community Photo (AI), Amenities (linked) |
| `amenities`   | Maintain Amenity Directory (`Amenities`) | Amenity Name, Linked Community, Category, Address, Hours, Verified |

The frontend builds each trail segment's line geometry by joining a segment's
linked `Communities` records to their `Latitude`/`Longitude`. **Populate
Latitude and Longitude on the Communities table** for the map to draw the
trail path and place town markers — until then, the map shows a friendly
empty state and the rest of the site still works from the other fields.

The map draws every segment as a single solid green line, regardless of its
`Status` field — the site launches once the trail is substantially complete,
so there's no in-progress state to visualize on the map yet. The stats strip
still breaks out miles completed vs. remaining from real `Status` values (see
`public/js/normalize.js`'s `isSegmentComplete`); only the map itself treats
the trail as finished.

The site lands directly on the full-size map (hero), with the wordmark and
CTAs in an overlay card and a stats strip (miles completed/remaining, trail
towns, amenities) directly below it.

### Map data layers

The map shows two distinct marker layers, explained in its legend:

- **Verified Amenities** (green branded pins) — Airtable Communities, as
  described above.
- **Community Data** (small gray dots with labels) — `public/js/osm-poi.js`
  queries the public [Overpass API](https://overpass-api.de/api/interpreter)
  (OpenStreetMap) for restaurants, cafes, hotels/lodging, convenience stores,
  and bicycle shops within the current viewport, refetching on `move` with a
  500ms debounce. It only queries at zoom ≥ 10 and caps results at 50, both to
  stay within reasonable use of a free shared public endpoint. Overpass
  requires no API key; failures or empty results are silent by design — the
  map just shows fewer dots rather than an error.

## Local development

```bash
npm install
netlify dev
```

`netlify dev` runs the static site and the functions together on
`http://localhost:8888`, reading environment variables from `.env`.

## Deploying to Netlify

1. Push this repository to GitHub/GitLab/Bitbucket and create a new Netlify
   site from it, or run `netlify deploy --prod` from the CLI.
2. Netlify will read `netlify.toml` automatically (publish dir `public`,
   functions dir `netlify/functions`).
3. Add the three environment variables above in the Netlify dashboard.
4. Point `deltaheritagetrail.com` at the Netlify site (Domain settings).
