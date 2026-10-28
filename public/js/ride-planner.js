import { escapeHtml, escapeAttr } from './utils.js';
import { amenityIconsHtml, amenityListItemsHtml } from './amenity-icons.js';
import { locateOnTrail } from './trail-line.js';

const state = {
  dataset: null,
  trailOrder: [],
  cumDistance: [],
  selectedIds: [],
  isMinimized: false,
};

const listeners = new Set();

export function initRidePlanner(dataset) {
  state.dataset = dataset;
  const { order, cumDistance } = dataset.trailLine
    ? buildTrailOrderFromRoute(dataset.trailLine, dataset.communities, dataset.pointsOfInterest)
    : buildTrailOrder(dataset.segments, dataset.communities);
  state.trailOrder = order;
  state.cumDistance = cumDistance;
  state.selectedIds = [];

  setupControls();
  render();
}

// The trail is a single unbranched path, so "planning a ride" just means
// picking two or more stops on that path — the rider passes through
// everything in between regardless of what they explicitly clicked.
//
// With the traced route available, every located town and point of
// interest is placed by its trail mile, so stops and distances don't depend
// on how segments are linked in Airtable, and a ride can start or end at a
// landmark between towns (e.g. Watson to the Benzal Bridge).
function buildTrailOrderFromRoute(trailLine, communities, pointsOfInterest) {
  const located = [
    ...communities.map((c) => ({ ...c, kind: 'community' })),
    ...pointsOfInterest.map((p) => ({ ...p, kind: 'poi' })),
  ].filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng));

  const placed = located
    .map((stop) => ({ stop, mile: locateOnTrail(trailLine, stop.lng, stop.lat).mile }))
    .sort((a, b) => a.mile - b.mile);

  return {
    order: placed.map((p) => p.stop),
    cumDistance: placed.map((p) => p.mile),
  };
}

// Fallback when the route file is unavailable: walk the chain of two-town
// segments. A segment linked to more than two towns is skipped, which
// breaks the chain there. Points of interest can't be placed without the
// route, so only towns are plannable here.
function buildTrailOrder(segments, communities) {
  const communityById = new Map(communities.map((c) => [c.id, c]));
  const adjacency = new Map();

  segments.forEach((segment) => {
    const ids = segment.communityIds.filter((id) => communityById.has(id));
    if (ids.length !== 2) return;
    const [a, b] = ids;
    if (!adjacency.has(a)) adjacency.set(a, []);
    if (!adjacency.has(b)) adjacency.set(b, []);
    adjacency.get(a).push({ id: b, distance: segment.distance });
    adjacency.get(b).push({ id: a, distance: segment.distance });
  });

  const ids = [...adjacency.keys()];
  if (!ids.length) return { order: [], cumDistance: [] };

  const startId = ids.find((id) => adjacency.get(id).length === 1) || ids[0];

  const order = [];
  const cumDistance = [];
  const visited = new Set();
  let current = startId;
  let previous = null;
  let distanceSoFar = 0;

  while (current && !visited.has(current)) {
    visited.add(current);
    order.push({ ...communityById.get(current), kind: 'community' });
    cumDistance.push(distanceSoFar);

    const next = (adjacency.get(current) || []).find((n) => n.id !== previous);
    previous = current;
    current = next ? next.id : null;
    if (next) distanceSoFar += next.distance;
  }

  return { order, cumDistance };
}

// Stops are towns or points of interest, keyed by Airtable record ID (unique
// across tables, so the two share one ID space).
export function toggleStopInRide(stopId) {
  const idx = state.selectedIds.indexOf(stopId);
  if (idx === -1) state.selectedIds.push(stopId);
  else state.selectedIds.splice(idx, 1);
  notify();
}

function removeStopFromRide(stopId) {
  state.selectedIds = state.selectedIds.filter((id) => id !== stopId);
  notify();
}

function clearRide() {
  state.selectedIds = [];
  state.isMinimized = false;
  notify();
}

function toggleMinimized() {
  state.isMinimized = !state.isMinimized;
  render();
}

export function isStopInRide(stopId) {
  return state.selectedIds.includes(stopId);
}

// Whether a stop can be added to a ride — points of interest only can when
// the traced route is available to place them.
export function isPlannableStop(stopId) {
  return state.trailOrder.some((s) => s.id === stopId);
}

// Fires immediately with the current selection, then again on every change,
// so late subscribers (e.g. a map layer added after init) sync for free.
export function onRideChange(callback) {
  listeners.add(callback);
  callback(state.selectedIds);
}

function notify() {
  listeners.forEach((cb) => cb(state.selectedIds));
  render();
}

function setupControls() {
  const listEl = document.getElementById('ride-planner-stops');
  const clearBtn = document.getElementById('ride-planner-clear');
  const minimizeBtn = document.getElementById('ride-popup-minimize');

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ride-remove]');
      if (!btn) return;
      removeStopFromRide(btn.getAttribute('data-ride-remove'));
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearRide());
  }

  if (minimizeBtn) {
    minimizeBtn.addEventListener('click', () => toggleMinimized());
  }
}

function getRideRange() {
  const indices = state.selectedIds
    .map((id) => state.trailOrder.findIndex((c) => c.id === id))
    .filter((i) => i !== -1);

  if (!indices.length) return null;

  const minIdx = Math.min(...indices);
  const maxIdx = Math.max(...indices);

  return {
    stops: state.trailOrder.slice(minIdx, maxIdx + 1),
    startMile: state.cumDistance[minIdx],
    endMile: state.cumDistance[maxIdx],
    distance: state.cumDistance[maxIdx] - state.cumDistance[minIdx],
  };
}

// The set of stop IDs the current ride passes through, including
// pass-through towns between selected stops — used to highlight the
// matching trail segments on the map when there's no traced route.
export function getRideStopIds() {
  const range = getRideRange();
  return new Set(range ? range.stops.map((c) => c.id) : []);
}

// Trail miles of the ride's first and last stops (only meaningful with the
// traced route), or null until at least two distinct stops are picked.
export function getRideMileRange() {
  const range = getRideRange();
  if (!range || range.stops.length < 2) return null;
  return { from: range.startMile, to: range.endMile };
}

function render() {
  const hintEl = document.getElementById('ride-hint');
  const popupEl = document.getElementById('ride-popup');
  const miniSummaryEl = document.getElementById('ride-popup-mini-summary');
  const minimizeBtn = document.getElementById('ride-popup-minimize');
  const listEl = document.getElementById('ride-planner-stops');
  const distanceEl = document.getElementById('ride-distance');
  const amenitiesEl = document.getElementById('ride-planner-amenities');
  if (!popupEl || !listEl || !distanceEl || !amenitiesEl) return;

  if (!state.selectedIds.length) {
    if (hintEl) hintEl.hidden = false;
    popupEl.hidden = true;
    return;
  }

  if (hintEl) hintEl.hidden = true;
  popupEl.hidden = false;
  popupEl.classList.toggle('ride-popup--minimized', state.isMinimized);

  if (minimizeBtn) {
    minimizeBtn.setAttribute('aria-expanded', String(!state.isMinimized));
    minimizeBtn.setAttribute('aria-label', state.isMinimized ? 'Expand ride planner' : 'Minimize ride planner');
    minimizeBtn.innerHTML = state.isMinimized ? '&plus;' : '&minus;';
  }

  const range = getRideRange();

  if (!range) {
    listEl.innerHTML = '<li class="ride-planner__empty">Those stops aren&rsquo;t on a connected stretch of trail yet.</li>';
    distanceEl.textContent = '0';
    amenitiesEl.innerHTML = '';
    if (miniSummaryEl) miniSummaryEl.textContent = '';
    return;
  }

  const startId = state.selectedIds[0];

  // Pass-through towns are listed so riders see where they can stop, but
  // pass-through landmarks are left out to keep the list short.
  const listedStops = range.stops.filter((s) => s.kind === 'community' || state.selectedIds.includes(s.id));

  listEl.innerHTML = listedStops
    .map((c) => {
      const isStart = c.id === startId;
      const isSelected = state.selectedIds.includes(c.id);
      return `
        <li class="ride-planner__stop${isSelected ? ' ride-planner__stop--selected' : ''}${c.kind === 'poi' ? ' ride-planner__stop--poi' : ''}">
          <span class="ride-planner__stop-name">${escapeHtml(c.name)}</span>
          ${isStart ? '<span class="ride-planner__stop-badge">Start</span>' : ''}
          ${
            isSelected && !isStart
              ? `<button type="button" class="ride-planner__stop-remove" data-ride-remove="${escapeAttr(c.id)}" aria-label="Remove ${escapeAttr(c.name)} from ride">&times;</button>`
              : ''
          }
        </li>
      `;
    })
    .join('');

  const townsInRange = range.stops.filter((s) => s.kind === 'community');
  const amenitiesInRange = state.dataset.amenities.filter((a) =>
    townsInRange.some((c) => a.communityIds.includes(c.id))
  );

  distanceEl.textContent = formatMiles(range.distance);

  if (miniSummaryEl) {
    const stopCount = state.selectedIds.length;
    miniSummaryEl.textContent = `${formatMiles(range.distance)} mi · ${stopCount} stop${stopCount === 1 ? '' : 's'}`;
  }

  if (amenitiesInRange.length) {
    const listHtml = amenityListItemsHtml(amenitiesInRange, {
      metaFor: (a) => {
        const town = townsInRange.find((c) => a.communityIds.includes(c.id));
        return [a.category, town?.name].filter(Boolean).join(' · ');
      },
    });
    amenitiesEl.innerHTML = `${amenityIconsHtml(amenitiesInRange)}<ul class="map-popup__list ride-popup__amenity-list">${listHtml}</ul>`;
  } else {
    amenitiesEl.innerHTML = '<p class="ride-planner__amenities-empty">No amenities listed along this stretch yet.</p>';
  }
}

function formatMiles(value) {
  return Math.round(value * 10) / 10;
}
