const FUNCTIONS_BASE = '/.netlify/functions';

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Request to ${url} failed with status ${res.status}`);
  }
  return res.json();
}

export async function getMapboxToken() {
  const data = await fetchJSON(`${FUNCTIONS_BASE}/mapbox-token`);
  return data.token;
}

// Traced route of the whole trail, served as a static file rather than from
// Airtable since it only changes if the trail itself is rerouted.
export async function getTrailRoute() {
  return fetchJSON('/data/dht.geojson');
}

export async function getTrailSegments() {
  const data = await fetchJSON(`${FUNCTIONS_BASE}/airtable?table=segments`);
  return data.records || [];
}

export async function getCommunities() {
  const data = await fetchJSON(`${FUNCTIONS_BASE}/airtable?table=communities`);
  return data.records || [];
}

export async function getAmenities() {
  const data = await fetchJSON(`${FUNCTIONS_BASE}/airtable?table=amenities`);
  return data.records || [];
}

export async function getPointsOfInterest() {
  const data = await fetchJSON(`${FUNCTIONS_BASE}/airtable?table=pois`);
  return data.records || [];
}

export async function getResources() {
  const data = await fetchJSON(`${FUNCTIONS_BASE}/airtable?table=resources`);
  return data.records || [];
}
