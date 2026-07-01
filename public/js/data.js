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
