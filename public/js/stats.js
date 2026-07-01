export function renderStats(dataset) {
  if (dataset.error) return;

  const totalMiles = dataset.segments.reduce((sum, s) => sum + (s.distance || 0), 0);

  setStat('stat-miles', totalMiles ? formatMiles(totalMiles) : '—');
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
