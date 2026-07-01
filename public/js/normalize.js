function toFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

// Segments.Status choices in Airtable: Open, Active (built) vs.
// Planned, Under Construction, Under Maintenance, Inactive (not yet ridable).
const COMPLETE_STATUSES = new Set(['open', 'active']);

export function isSegmentComplete(status) {
  return COMPLETE_STATUSES.has(String(status).toLowerCase());
}

function extractImageUrl(attachments) {
  if (!Array.isArray(attachments) || !attachments.length) return '';
  const first = attachments[0];
  return first?.thumbnails?.large?.url || first?.url || '';
}

export function normalizeSegment(record) {
  const f = record.fields || {};
  return {
    id: record.id,
    name: f['Segment Name'] || 'Trail Segment',
    startPoint: f['Start Point'] || '',
    endPoint: f['End Point'] || '',
    distance: toFiniteNumber(f['Distance in Miles']) ?? 0,
    status: f['Status'] || '',
    notes: f['Notes'] || '',
    communityIds: Array.isArray(f['Communities']) ? f['Communities'] : [],
  };
}

export function normalizeCommunity(record) {
  const f = record.fields || {};
  return {
    id: record.id,
    name: f['Community Name'] || 'Trail Town',
    lat: toFiniteNumber(f['Latitude']),
    lng: toFiniteNumber(f['Longitude']),
    description: f['Description'] || f['Community Summary (AI)'] || '',
    niche: f['Niche Identity'] || '',
    trailReadyStatus: f['Trail Ready Status'] || '',
    website: f['Website'] || '',
    photo: extractImageUrl(f['Community Photo (AI)']),
    amenityIds: Array.isArray(f['Amenities']) ? f['Amenities'] : [],
  };
}

export function normalizeAmenity(record) {
  const f = record.fields || {};
  return {
    id: record.id,
    name: f['Amenity Name'] || 'Amenity',
    communityIds: Array.isArray(f['Linked Community']) ? f['Linked Community'] : [],
    category: f['Category'] || 'Other',
    address: f['Address'] || '',
    mapsUrl: f['Google Maps URL'] || '',
    phone: f['Phone'] || '',
    hours: f['Hours'] || '',
    verified: Boolean(f['Verified']),
    notes: f['Notes'] || '',
  };
}
