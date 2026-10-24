import { escapeHtml, escapeAttr } from './utils.js';
import { amenityIconsHtml, amenityIconUrlForCategory, amenityListItemsHtml, poiIconUrlForType } from './amenity-icons.js';
import { setupOsmPoiLayer } from './osm-poi.js';
import { locateOnTrail, sliceTrail } from './trail-line.js';
import { toggleCommunityInRide, isCommunityInRide, onRideChange, getRideStopIds } from './ride-planner.js';

const DEFAULT_CENTER = [-91.13, 34.35]; // Arkansas Delta, Phillips/Desha counties
const DEFAULT_ZOOM = 9;

// Below this zoom, amenity pins are dense enough to overlap the community
// markers, so they only appear once a rider has zoomed in on a community.
const AMENITY_MARKER_MIN_ZOOM = 13;

// The map is drawn as a single completed trail for now, regardless of each
// segment's actual Airtable Status — the site launches once the trail is
// substantially finished, so there's no in-progress state to show yet.
const TRAIL_COLOR = '#1a5c38';
const RIDE_HIGHLIGHT_COLOR = '#c1592e';

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
    const segmentLines = buildSegmentLines(dataset.segments, communityById, dataset.trailLine);

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
    addRideHighlightLayer(map, segmentLines, dataset.trailLine, communityById);
    addCommunityMarkers(map, locatedCommunities, dataset.amenities);
    addAmenityMarkers(map, dataset.amenities);
    addPointOfInterestMarkers(map, dataset.pointsOfInterest, communityById);
    fitToData(map, segmentLines, locatedCommunities);
    setupOsmPoiLayer(map);
  });
}

function hasCoordinates(community) {
  return Number.isFinite(community.lat) && Number.isFinite(community.lng);
}

// Each segment is drawn along the traced trail route between its linked
// towns. Without the route, it falls back to straight lines between towns.
function buildSegmentLines(segments, communityById, trailLine) {
  return segments
    .map((segment) => {
      const points = segment.communityIds
        .map((id) => communityById.get(id))
        .filter((c) => c && hasCoordinates(c));
      if (points.length < 2) return null;

      if (trailLine) {
        const miles = points.map((p) => locateOnTrail(trailLine, p.lng, p.lat).mile);
        return {
          ...segment,
          coordinates: sliceTrail(trailLine, Math.min(...miles), Math.max(...miles)),
        };
      }

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

function addRideHighlightLayer(map, segmentLines, trailLine, communityById) {
  map.addSource('trail-segment-highlight', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
  });

  map.addLayer({
    id: 'trail-segment-line-highlight',
    type: 'line',
    source: 'trail-segment-highlight',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: { 'line-color': RIDE_HIGHLIGHT_COLOR, 'line-width': 7 },
  });

  onRideChange(() => {
    const stopIds = getRideStopIds();

    // With the traced route, highlight exactly the stretch between the
    // ride's first and last stops, even if they fall mid-segment.
    if (trailLine) {
      const miles = [...stopIds]
        .map((id) => communityById.get(id))
        .filter((c) => c && hasCoordinates(c))
        .map((c) => locateOnTrail(trailLine, c.lng, c.lat).mile);
      const features = miles.length >= 2
        ? [{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: sliceTrail(trailLine, Math.min(...miles), Math.max(...miles)) },
          }]
        : [];
      map.getSource('trail-segment-highlight').setData({ type: 'FeatureCollection', features });
      return;
    }

    const features = segmentLines
      .filter((s) => s.communityIds.every((id) => stopIds.has(id)))
      .map((s) => ({
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: s.coordinates },
      }));
    map.getSource('trail-segment-highlight').setData({ type: 'FeatureCollection', features });
  });
}

function addCommunityMarkers(map, communities, amenities) {
  const markerEls = new Map();

  const markers = communities.map((community) => {
    const el = document.createElement('div');
    el.className = 'trail-marker';
    el.setAttribute('aria-label', community.name);
    markerEls.set(community.id, el);

    const communityAmenities = amenities.filter((a) => a.communityIds.includes(community.id));

    const popup = new mapboxgl.Popup({ offset: 24, maxWidth: '280px' }).setHTML(
      popupHtml(community, communityAmenities)
    );
    popup.on('open', () => popup.setHTML(popupHtml(community, communityAmenities)));

    const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([community.lng, community.lat])
      .setPopup(popup)
      .addTo(map);

    return marker;
  });

  map.getContainer().addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ride-toggle]');
    if (!btn) return;
    toggleCommunityInRide(btn.getAttribute('data-ride-toggle'));
  });

  onRideChange((selectedIds) => {
    markerEls.forEach((el, id) => {
      el.classList.toggle('trail-marker--selected', selectedIds.includes(id));
    });
    document.querySelectorAll('[data-ride-toggle]').forEach((btn) => {
      const id = btn.getAttribute('data-ride-toggle');
      const inRide = isCommunityInRide(id);
      btn.textContent = inRide ? 'Remove from My Ride' : 'Add to My Ride';
      btn.classList.toggle('map-popup__ride-btn--active', inRide);
    });
  });

  return markers;
}

function popupHtml(community, amenities) {
  const amenitiesHtml = amenities.length
    ? `<ul class="map-popup__list">${amenityListItemsHtml(amenities)}</ul>`
    : '<p class="map-popup__empty">No amenities listed yet.</p>';

  const inRide = isCommunityInRide(community.id);

  return `
    <div class="map-popup">
      <h3>${escapeHtml(community.name)}</h3>
      ${community.photo ? `<img class="map-popup__photo" src="${escapeAttr(community.photo)}" alt="${escapeAttr(community.name)}" />` : ''}
      ${community.description ? `<p>${escapeHtml(community.description)}</p>` : ''}
      <button type="button" class="map-popup__ride-btn${inRide ? ' map-popup__ride-btn--active' : ''}" data-ride-toggle="${escapeAttr(community.id)}">
        ${inRide ? 'Remove from My Ride' : 'Add to My Ride'}
      </button>
      <div class="map-popup__amenities">
        <p class="map-popup__amenities-label">Amenities</p>
        ${amenityIconsHtml(amenities)}
        ${amenitiesHtml}
      </div>
      ${community.website ? `<a class="map-popup__link" href="${escapeAttr(community.website)}" target="_blank" rel="noopener">Visit website</a>` : ''}
    </div>
  `;
}

function hasAmenityCoordinates(amenity) {
  return Number.isFinite(amenity.lat) && Number.isFinite(amenity.lng);
}

// Fine-grained per-amenity pins, layered on top of the community markers.
// Only amenities with a parsed "GPS Coordinates" value get a pin — records
// missing coordinates are silently skipped, not errored on.
function addAmenityMarkers(map, amenities) {
  const located = amenities.filter(hasAmenityCoordinates);

  const markers = located.map((amenity) => {
    const iconUrl = amenityIconUrlForCategory(amenity.category);

    const el = document.createElement('div');
    el.className = iconUrl ? 'amenity-marker' : 'amenity-marker amenity-marker--generic';
    el.setAttribute('aria-label', amenity.name);
    if (iconUrl) {
      const img = document.createElement('img');
      img.src = iconUrl;
      img.alt = '';
      img.width = 16;
      img.height = 16;
      img.loading = 'lazy';
      el.appendChild(img);
    }

    const popup = new mapboxgl.Popup({ offset: 18, maxWidth: '240px' }).setHTML(amenityPopupHtml(amenity));

    return new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([amenity.lng, amenity.lat])
      .setPopup(popup)
      .addTo(map);
  });

  const updateAmenityMarkerVisibility = () => {
    const visible = map.getZoom() >= AMENITY_MARKER_MIN_ZOOM;
    markers.forEach((marker) => {
      marker.getElement().classList.toggle('amenity-marker--hidden', !visible);
      if (!visible && marker.getPopup()?.isOpen()) {
        marker.getPopup().remove();
      }
    });
  };

  updateAmenityMarkerVisibility();
  map.on('zoom', updateAmenityMarkerVisibility);

  return markers;
}

function amenityPopupHtml(amenity) {
  return `
    <div class="map-popup">
      <h3>${escapeHtml(amenity.name)}</h3>
      <p class="map-popup__amenities-label">${escapeHtml(amenity.category || 'Amenity')}</p>
      ${amenity.mapsUrl ? `<a class="map-popup__link" href="${escapeAttr(amenity.mapsUrl)}" target="_blank" rel="noopener">View on Google Maps</a>` : ''}
    </div>
  `;
}

// Trail landmarks (bridges, historic sites, etc.) from the Points of Interest
// table. Unlike amenity pins, these stay visible at every zoom level since
// they're sights along the trail itself rather than in-town services.
function addPointOfInterestMarkers(map, pointsOfInterest, communityById) {
  return pointsOfInterest.filter(hasAmenityCoordinates).map((poi) => {
    const el = document.createElement('div');
    el.className = 'poi-marker';
    el.setAttribute('aria-label', poi.name);
    const img = document.createElement('img');
    img.src = poiIconUrlForType(poi.type);
    img.alt = '';
    img.width = 18;
    img.height = 18;
    el.appendChild(img);

    const nearestCommunity = poi.communityIds.map((id) => communityById.get(id)).find(Boolean);
    const popup = new mapboxgl.Popup({ offset: 20, maxWidth: '280px' }).setHTML(
      poiPopupHtml(poi, nearestCommunity)
    );

    return new mapboxgl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([poi.lng, poi.lat])
      .setPopup(popup)
      .addTo(map);
  });
}

function poiPopupHtml(poi, nearestCommunity) {
  const details = [
    poi.type,
    poi.mileMarker != null ? `Mile ${poi.mileMarker}` : '',
    nearestCommunity ? `Near ${nearestCommunity.name}` : '',
  ].filter(Boolean);

  return `
    <div class="map-popup">
      <h3>${escapeHtml(poi.name)}</h3>
      ${details.length ? `<p class="map-popup__amenities-label">${escapeHtml(details.join(' · '))}</p>` : ''}
      ${poi.photo ? `<img class="map-popup__photo" src="${escapeAttr(poi.photo)}" alt="${escapeAttr(poi.name)}" />` : ''}
      ${poi.description ? `<p>${escapeHtml(poi.description)}</p>` : ''}
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
