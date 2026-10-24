// Geometry helpers for the traced trail route (public/data/dht.geojson), a
// single LineString running from Lexa (mile 0) to Arkansas City.
//
// Distances use a flat local projection in miles, which is accurate to well
// under 1% across the trail's small extent and keeps this dependency-free.

const MILES_PER_DEGREE_LAT = 69.0;
const MILES_PER_DEGREE_LNG = MILES_PER_DEGREE_LAT * Math.cos((34.1 * Math.PI) / 180);

function toXY([lng, lat]) {
  return [lng * MILES_PER_DEGREE_LNG, lat * MILES_PER_DEGREE_LAT];
}

// Pulls the first LineString out of a GeoJSON FeatureCollection, Feature or
// bare geometry and precomputes cumulative mileage along it.
export function buildTrailLine(geojson) {
  const geometries = geojson?.type === 'FeatureCollection'
    ? geojson.features.map((f) => f.geometry)
    : [geojson?.type === 'Feature' ? geojson.geometry : geojson];
  const line = geometries.find((g) => g?.type === 'LineString');
  if (!line || line.coordinates.length < 2) return null;

  const coordinates = line.coordinates.map(([lng, lat]) => [lng, lat]);
  const points = coordinates.map(toXY);
  const cumMiles = [0];
  for (let i = 1; i < points.length; i += 1) {
    cumMiles.push(cumMiles[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  }

  return { coordinates, points, cumMiles, totalMiles: cumMiles[cumMiles.length - 1] };
}

// Nearest point on the trail to [lng, lat]: its trail mile and how far off
// the trail the input point sits, both in miles.
export function locateOnTrail(trail, lng, lat) {
  const [qx, qy] = toXY([lng, lat]);
  let best = { mile: 0, offTrailMiles: Infinity };

  for (let i = 0; i < trail.points.length - 1; i += 1) {
    const [ax, ay] = trail.points[i];
    const [bx, by] = trail.points[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    const t = lengthSq ? Math.max(0, Math.min(1, ((qx - ax) * dx + (qy - ay) * dy) / lengthSq)) : 0;
    const offTrailMiles = Math.hypot(qx - (ax + t * dx), qy - (ay + t * dy));
    if (offTrailMiles < best.offTrailMiles) {
      best = { mile: trail.cumMiles[i] + t * Math.sqrt(lengthSq), offTrailMiles };
    }
  }

  return best;
}

function coordinateAtMile(trail, mile) {
  const { coordinates, cumMiles } = trail;
  const i = Math.max(0, cumMiles.findIndex((m) => m >= mile) - 1);
  const span = cumMiles[i + 1] - cumMiles[i];
  const t = span ? (mile - cumMiles[i]) / span : 0;
  const [aLng, aLat] = coordinates[i];
  const [bLng, bLat] = coordinates[i + 1];
  return [aLng + t * (bLng - aLng), aLat + t * (bLat - aLat)];
}

// The stretch of trail between two mileages, as LineString coordinates.
export function sliceTrail(trail, fromMile, toMile) {
  const start = Math.max(0, Math.min(fromMile, toMile));
  const end = Math.min(trail.totalMiles, Math.max(fromMile, toMile));
  const inner = trail.coordinates.filter((_, i) => trail.cumMiles[i] > start && trail.cumMiles[i] < end);
  return [coordinateAtMile(trail, start), ...inner, coordinateAtMile(trail, end)];
}
