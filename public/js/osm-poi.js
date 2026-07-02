const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const DEBOUNCE_MS = 500;
const RESULT_LIMIT = 50;
// Below this zoom the viewport bbox is large enough that a query would be
// slow/expensive for a shared public endpoint and mostly noise on this map.
const MIN_ZOOM = 10;

const TAG_LABELS = {
  restaurant: 'Restaurant',
  cafe: 'Cafe',
  hotel: 'Hotel',
  motel: 'Motel',
  guest_house: 'Guest House',
  hostel: 'Hostel',
  convenience: 'Convenience Store',
  bicycle: 'Bicycle Shop',
};

// Adds a debounced, viewport-driven layer of OpenStreetMap POIs (via the
// Overpass API) as small gray "community data" markers, distinct from the
// green verified-amenity markers sourced from Airtable.
export function setupOsmPoiLayer(map) {
  let markers = [];
  let debounceHandle = null;
  let requestToken = 0;

  function clearMarkers() {
    markers.forEach((marker) => marker.remove());
    markers = [];
  }

  async function refresh() {
    if (map.getZoom() < MIN_ZOOM) {
      clearMarkers();
      return;
    }

    const token = ++requestToken;
    let pois;
    try {
      pois = await fetchOsmPois(map.getBounds());
    } catch {
      return; // fail silently — an unavailable Overpass API shouldn't disrupt the map
    }

    if (token !== requestToken) return; // a newer viewport already superseded this request

    clearMarkers();
    pois.forEach((poi) => markers.push(createOsmMarker(map, poi)));
  }

  map.on('move', () => {
    clearTimeout(debounceHandle);
    debounceHandle = setTimeout(refresh, DEBOUNCE_MS);
  });

  refresh();
}

async function fetchOsmPois(bounds) {
  const bbox = [bounds.getSouth(), bounds.getWest(), bounds.getNorth(), bounds.getEast()].join(',');
  const query = `[out:json][timeout:25];(` +
    `node["amenity"~"^(restaurant|cafe)$"](${bbox});` +
    `node["tourism"~"^(hotel|motel|guest_house|hostel)$"](${bbox});` +
    `node["shop"~"^(convenience|bicycle)$"](${bbox});` +
    `);out body ${RESULT_LIMIT};`;

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass responded with ${response.status}`);
  }

  const data = await response.json();
  const elements = Array.isArray(data.elements) ? data.elements : [];

  return elements
    .slice(0, RESULT_LIMIT)
    .map((el) => {
      const tags = el.tags || {};
      const tagKey = tags.amenity || tags.tourism || tags.shop || '';
      const category = TAG_LABELS[tagKey] || null;
      return {
        lat: el.lat,
        lng: el.lon,
        name: tags.name || category || 'Point of interest',
        category,
      };
    })
    .filter((poi) => Number.isFinite(poi.lat) && Number.isFinite(poi.lng));
}

function createOsmMarker(map, poi) {
  const el = document.createElement('div');
  el.className = 'osm-poi-marker';
  el.title = poi.category ? `${poi.name} (${poi.category})` : poi.name;

  const dot = document.createElement('span');
  dot.className = 'osm-poi-marker__dot';

  const label = document.createElement('span');
  label.className = 'osm-poi-marker__label';
  label.textContent = poi.name;

  el.append(dot, label);

  return new mapboxgl.Marker({ element: el, anchor: 'left' })
    .setLngLat([poi.lng, poi.lat])
    .addTo(map);
}
