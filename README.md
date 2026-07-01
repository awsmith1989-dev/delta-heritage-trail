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
  js/                           ES modules: data.js, normalize.js, map.js, towns.js, stats.js, app.js
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

The trail is split into a solid "northern" line and a dashed "southern" line
by comparing each segment's average latitude to the median latitude across
all segments — no hardcoded town list, so it keeps working as the base grows.

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
