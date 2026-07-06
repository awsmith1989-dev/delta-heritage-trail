import { escapeHtml, escapeAttr } from './utils.js';
import { amenityIconsHtml } from './amenity-icons.js';
import { setupOsmPoiLayer } from './osm-poi.js';

const DEFAULT_CENTER = [-91.13, 34.35]; // Arkansas Delta, Phillips/Desha counties
const DEFAULT_ZOOM = 9;

// The map is drawn as a single completed trail for now, regardless of each
// segment's actual Airtable Status — the site launches once the trail is
// substantially finished, so there's no in-progress state to show yet.
const TRAIL_COLOR = '#1a5c38';

export function initMap(dataset, mapboxToken) {
  const mapEl = document.getElementById('trail-map');
  const statusEl = document.getElementById('map-status');
  if (!mapEl) return;

  if (!mapboxToken) {
    setStatus(statusEl, 'The map is temporarily unavailable. Please try again later.', true);
    return;
  }

  if (dataset.error) {
    setStatus(statusEl, 'We had trouble loading trail data. Please refresh the page.', true);
  }

  mapboxgl.accessToken = mapboxToken;

  const map = new mapboxgl.Map({
    container: mapEl,
    style: 'mapbox://styles/mapbox/outdoors-v12',
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
  });

  map.addControl(new mapboxgl.NavigationControl(), 'top-right');
  map.addControl(new mapboxgl.FullscreenControl(), 'top-right');
  map.scrollZoom.disable();
  mapEl.addEventListener('mouseenter', () => map.scrollZoom.enable());
  mapEl.addEventListener('mouseleave', () => map.scrollZoom.disable());

  map.on('load', () => {
    const communityById = new Map(dataset.communities.map((c) => [c.id, c]));
    const locatedCommunities = dataset.communities.filter(hasCoordinates);
    const segmentLines = buildSegmentLines(dataset.segments, communityById);

    if (!segmentLines.length && !locatedCommunities.length) {
      setStatus(
        statusEl,
        'Map data is being added for the Delta Heritage Trail. Check back soon!',
        false
      );
    } else if (!segmentLines.length) {
      setStatus(
        statusEl,
        'Trail towns are shown below. Add Latitude and Longitude to Communities in Airtable to draw the trail path.',
        false
      );
    } else if (!dataset.error) {
      setStatus(statusEl, '', false, true);
    }

    addSegmentLayer(map, segmentLines);
    addCommunityMarkers(map, locatedCommunities, dataset.amenities);
    fitToData(map, segmentLines, locatedCommunities);
    setupOsmPoiLayer(map);
  });
}

function hasCoordinates(community) {
  return Number.isFinite(community.lat) && Number.isFinite(community.lng);
}

function buildSegmentLines(segments, communityById) {
  return segments
    .map((segment) => {
      const points = segment.communityIds
        .map((id) => communityById.get(id))
        .filter((c) => c && hasCoordinates(c));
      if (points.length < 2) return null;
      const sorted = [...points].sort((a, b) => b.lat - a.lat);
      return {
        ...segment,
        coordinates: sorted.map((p) => [p.lng, p.lat]),
      };
    })
    .filter(Boolean);
}

function addSegmentLayer(map, segmentLines) {
  const features = segmentLines.map((s) => ({
    type: 'Feature',
    properties: { name: s.name, distance: s.distance, photo: s.photo },
    geometry: { type: 'LineString', coordinates: s.coordinates },
  }));

  map.addSource('trail-segment', { type: 'geojson', data: { type: 'FeatureCollection', features } });

  const layerId = 'trail-segment-line';
  map.addLayer({
    id: layerId,
    type: 'line',
    source: 'trail-segment',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': TRAIL_COLOR, 'line-width': 5 },
  });

  map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
  map.on('click', layerId, (e) => {
    const props = e.features[0].properties;
    new mapboxgl.Popup({ offset: 12 })
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="map-popup">
          <h3>${escapeHtml(props.name)}</h3>
          ${props.photo ? `<img class="map-popup__photo" src="${escapeAttr(props.photo)}" alt="${escapeAttr(props.name)}" />` : ''}
          <p>${escapeHtml(props.distance)} miles</p>
        </div>`
      )
      .addTo(map);
  });
}

function addCommunityMarkers(map, communities, amenities) {
  return communities.map((community) => {
    const el = document.createElement('div');
    el.className = 'trail-marker';
    el.setAttribute('aria-label', community.name);

    const communityAmenities = amenities.filter((a) => a.communityIds.includes(community.id));

    const popup = new mapboxgl.Popup({ offset: 24, maxWidth: '280px' }).setHTML(
      popupHtml(community, communityAmenities)
    );

    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([community.lng, community.lat])
      .setPopup(popup)
      .addTo(map);

    return marker;
  });
}

function popupHtml(community, amenities) {
  const amenitiesHtml = amenities.length
    ? `<ul class="map-popup__list">${amenities
        .map(
          (a) =>
            `<li><strong>${escapeHtml(a.name)}</strong><span>${escapeHtml(a.category)}</span></li>`
        )
        .join('')}</ul>`
    : '<p class="map-popup__empty">No amenities listed yet.</p>';

  return `
    <div class="map-popup">
      <h3>${escapeHtml(community.name)}</h3>
      ${community.photo ? `<img class="map-popup__photo" src="${escapeAttr(community.photo)}" alt="${escapeAttr(community.name)}" />` : ''}
      ${community.description ? `<p>${escapeHtml(community.description)}</p>` : ''}
      <div class="map-popup__amenities">
        <p class="map-popup__amenities-label">Amenities</p>
        ${amenityIconsHtml(amenities)}
        ${amenitiesHtml}
      </div>
      ${community.website ? `<a class="map-popup__link" href="${escapeAttr(community.website)}" target="_blank" rel="noopener">Visit website</a>` : ''}
    </div>
  `;
}

function fitToData(map, segmentLines, communities) {
  const points = [
    ...segmentLines.flatMap((s) => s.coordinates),
    ...communities.map((c) => [c.lng, c.lat]),
  ];
  if (!points.length) return;

  const bounds = points.reduce(
    (b, coord) => b.extend(coord),
    new mapboxgl.LngLatBounds(points[0], points[0])
  );
  map.fitBounds(bounds, { padding: 60, maxZoom: 12, duration: 0 });
}

function setStatus(el, message, isError, hide) {
  if (!el) return;
  if (hide) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle('map-status--error', Boolean(isError));
}
