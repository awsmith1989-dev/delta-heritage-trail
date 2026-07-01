import { isSegmentComplete } from './normalize.js';

export function renderStats(dataset) {
  if (dataset.error) return;

  const milesCompleted = dataset.segments
    .filter((s) => isSegmentComplete(s.status))
    .reduce((sum, s) => sum + (s.distance || 0), 0);
  const milesRemaining = dataset.segments
    .filter((s) => !isSegmentComplete(s.status))
    .reduce((sum, s) => sum + (s.distance || 0), 0);

  setStat('stat-miles-completed', milesCompleted ? formatMiles(milesCompleted) : '—');
  setStat('stat-miles-remaining', milesRemaining ? formatMiles(milesRemaining) : '—');
  setStat('stat-towns', dataset.communities.length || '—');
  setStat('stat-amenities', dataset.amenities.length || '—');
}

function formatMiles(value) {
  return Math.round(value * 10) / 10;
}

function setStat(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
