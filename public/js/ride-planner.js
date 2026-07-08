import { escapeHtml, escapeAttr } from './utils.js';
import { amenityIconsHtml } from './amenity-icons.js';

const state = {
  dataset: null,
  trailOrder: [],
  cumDistance: [],
  selectedIds: [],
};

const listeners = new Set();

export function initRidePlanner(dataset) {
  state.dataset = dataset;
  const { order, cumDistance } = buildTrailOrder(dataset.segments, dataset.communities);
  state.trailOrder = order;
  state.cumDistance = cumDistance;
  state.selectedIds = [];

  setupControls();
  render();
}

// The trail is a single unbranched path, so "planning a ride" just means
// picking two or more stops on that path — the rider passes through
// everything in between regardless of what they explicitly clicked.
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
    order.push(communityById.get(current));
    cumDistance.push(distanceSoFar);

    const next = (adjacency.get(current) || []).find((n) => n.id !== previous);
    previous = current;
    current = next ? next.id : null;
    if (next) distanceSoFar += next.distance;
  }

  return { order, cumDistance };
}

export function toggleCommunityInRide(communityId) {
  const idx = state.selectedIds.indexOf(communityId);
  if (idx === -1) state.selectedIds.push(communityId);
  else state.selectedIds.splice(idx, 1);
  notify();
}

function removeCommunityFromRide(communityId) {
  state.selectedIds = state.selectedIds.filter((id) => id !== communityId);
  notify();
}

function clearRide() {
  state.selectedIds = [];
  notify();
}

export function isCommunityInRide(communityId) {
  return state.selectedIds.includes(communityId);
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

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-ride-remove]');
      if (!btn) return;
      removeCommunityFromRide(btn.getAttribute('data-ride-remove'));
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => clearRide());
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
    distance: state.cumDistance[maxIdx] - state.cumDistance[minIdx],
  };
}

// The set of community IDs the current ride passes through, including
// pass-through towns between selected stops — used to highlight the
// matching trail segments on the map.
export function getRideStopIds() {
  const range = getRideRange();
  return new Set(range ? range.stops.map((c) => c.id) : []);
}

function render() {
  const listEl = document.getElementById('ride-planner-stops');
  const summaryEl = document.getElementById('ride-planner-summary');
  const clearBtn = document.getElementById('ride-planner-clear');
  const distanceEl = document.getElementById('ride-distance');
  const amenitiesEl = document.getElementById('ride-planner-amenities');
  if (!listEl || !summaryEl || !clearBtn || !distanceEl || !amenitiesEl) return;

  if (!state.selectedIds.length) {
    listEl.innerHTML = '<li class="ride-planner__empty">Click a trail town marker on the map above to set your start point.</li>';
    summaryEl.hidden = true;
    clearBtn.hidden = true;
    return;
  }

  const range = getRideRange();
  clearBtn.hidden = false;

  if (!range) {
    listEl.innerHTML = '<li class="ride-planner__empty">Those towns aren&rsquo;t on a connected stretch of trail yet.</li>';
    summaryEl.hidden = true;
    return;
  }

  const startId = state.selectedIds[0];

  listEl.innerHTML = range.stops
    .map((c) => {
      const isStart = c.id === startId;
      const isSelected = state.selectedIds.includes(c.id);
      return `
        <li class="ride-planner__stop${isSelected ? ' ride-planner__stop--selected' : ''}">
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

  const amenitiesInRange = state.dataset.amenities.filter((a) =>
    range.stops.some((c) => a.communityIds.includes(c.id))
  );

  distanceEl.textContent = formatMiles(range.distance);
  amenitiesEl.innerHTML = amenitiesInRange.length
    ? `${amenityIconsHtml(amenitiesInRange)}<p class="ride-planner__amenities-count">${amenitiesInRange.length} amenities along the way</p>`
    : '<p class="ride-planner__amenities-empty">No amenities listed along this stretch yet.</p>';

  summaryEl.hidden = false;
}

function formatMiles(value) {
  return Math.round(value * 10) / 10;
}
