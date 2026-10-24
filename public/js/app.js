import { getMapboxToken, getTrailRoute, getTrailSegments, getCommunities, getAmenities, getPointsOfInterest, getResources } from './data.js';
import { normalizeSegment, normalizeCommunity, normalizeAmenity, normalizePointOfInterest, normalizeResource } from './normalize.js';
import { buildTrailLine, locateOnTrail } from './trail-line.js';
import { initMap } from './map.js';
import { renderTrailTowns } from './towns.js';
import { initRidePlanner } from './ride-planner.js';
import { renderResources } from './resources.js';

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupSmoothScroll();
  setYear();

  // Resources are independent of the trail data, so they load and render
  // on their own without waiting on (or being blocked by) the map.
  loadResources().then(renderResources);

  const [dataset, mapboxToken] = await Promise.all([loadTrailData(), loadMapboxToken()]);

  initRidePlanner(dataset);
  initMap(dataset, mapboxToken);
  renderTrailTowns(dataset);
});

async function loadResources() {
  try {
    const records = await getResources();
    return records.map(normalizeResource);
  } catch (err) {
    console.error('Failed to load resources', err);
    return [];
  }
}

async function loadTrailData() {
  try {
    const [segmentRecords, communityRecords, amenityRecords, poiRecords, trailRoute] = await Promise.all([
      getTrailSegments(),
      getCommunities(),
      getAmenities(),
      // Points of interest are optional extras; don't let them take down the
      // rest of the trail data if that table fails to load.
      getPointsOfInterest().catch((err) => {
        console.error('Failed to load points of interest', err);
        return [];
      }),
      // Without the traced route the map falls back to straight lines
      // between towns, so this is optional too.
      getTrailRoute().catch((err) => {
        console.error('Failed to load trail route', err);
        return null;
      }),
    ]);

    const trailLine = trailRoute ? buildTrailLine(trailRoute) : null;

    return {
      segments: segmentRecords.map(normalizeSegment),
      communities: communityRecords.map(normalizeCommunity),
      amenities: amenityRecords.map(normalizeAmenity),
      pointsOfInterest: placePointsOnTrail(poiRecords.map(normalizePointOfInterest), trailLine),
      trailLine,
      error: null,
    };
  } catch (err) {
    console.error('Failed to load trail data', err);
    return { segments: [], communities: [], amenities: [], pointsOfInterest: [], trailLine: null, error: err };
  }
}

// Anything farther than this from the traced route is probably a mistyped
// coordinate rather than a real off-trail landmark.
const OFF_TRAIL_WARNING_MILES = 0.5;

// Fills in a trail mile for points of interest that don't have a Mile Marker
// set in Airtable, and flags any that sit suspiciously far from the trail.
function placePointsOnTrail(pointsOfInterest, trailLine) {
  if (!trailLine) return pointsOfInterest;

  return pointsOfInterest.map((poi) => {
    if (!Number.isFinite(poi.lat) || !Number.isFinite(poi.lng)) return poi;

    const { mile, offTrailMiles } = locateOnTrail(trailLine, poi.lng, poi.lat);
    if (offTrailMiles > OFF_TRAIL_WARNING_MILES) {
      console.warn(
        `Point of interest "${poi.name}" is ${offTrailMiles.toFixed(1)} miles from the trail. Check its GPS Coordinates in Airtable.`
      );
    }
    return poi.mileMarker != null ? poi : { ...poi, mileMarker: Math.round(mile * 10) / 10 };
  });
}

async function loadMapboxToken() {
  try {
    return await getMapboxToken();
  } catch (err) {
    console.error('Failed to load Mapbox token', err);
    return null;
  }
}

function setupNav() {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.classList.toggle('is-open', isOpen);
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.classList.remove('is-open');
    });
  });
}

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function setYear() {
  const el = document.getElementById('current-year');
  if (el) el.textContent = String(new Date().getFullYear());
}
