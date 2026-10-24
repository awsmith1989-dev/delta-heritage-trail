import { escapeHtml, escapeAttr } from './utils.js';

const ICON_BASE = '/img/amenity-icons';

const CATEGORY_ICONS = {
  accommodation: 'Accommodation.png',
  bike_rental: 'Bike_Rentals.png', // Airtable category is singular ("Bike Rental")
  bike_rentals: 'Bike_Rentals.png',
  bike_repair: 'Repair_Station.png', // closest match: no "Bike Repair"-named icon exists
  camping: 'Camping.png',
  food_and_beverage: 'Food_and_Beverage.png',
  point_of_interest: 'Point_of_Interest.png',
  public_park: 'Public_Park.png',
  rv_site: 'RV_Site.png',
  repair_station: 'Repair_Station.png',
  restrooms: 'Restrooms.png',
  trailhead: 'Trailhead.png',
  visitor_center: 'Visitor_Center.png',
  water: 'Water.png',
};

function normalizeCategory(category) {
  return String(category || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// "Additional Amenities" options are worded differently from Category values
// (and include a typo), so map them onto the Category wording to keep icons
// and labels consistent.
const AMENITY_ALIASES = {
  bathroom: 'Restrooms',
  bathrom: 'Restrooms',
  restroom: 'Restrooms',
  water_fountain: 'Water',
  bike_rentals: 'Bike Rental',
  bike_repair_station: 'Bike Repair',
  repair_station: 'Bike Repair',
};

function canonicalLabel(name) {
  return AMENITY_ALIASES[normalizeCategory(name)] || name;
}

// Everything a place offers: its own Category plus its Additional Amenities,
// deduplicated once aliases are applied.
function amenityFeatures(amenity) {
  const labels = [amenity.category, ...(amenity.additionalAmenities || [])]
    .filter(Boolean)
    .map(canonicalLabel);
  return [...new Set(labels)];
}

function iconFileFor(category) {
  return CATEGORY_ICONS[normalizeCategory(category)] || CATEGORY_ICONS.point_of_interest;
}

// Icons for the Points of Interest table's "Type" field. Types without
// their own artwork use the generic point of interest icon.
const POI_TYPE_ICONS = {
  bridge: 'Bridge_POI.png',
  scenic_overlook: 'Scenic_Overlook_POI.png',
  wildlife: 'Wildlife_POI.png',
};

export function poiIconUrlForType(type) {
  return `${ICON_BASE}/${POI_TYPE_ICONS[normalizeCategory(type)] || CATEGORY_ICONS.point_of_interest}`;
}

// Unlike iconFileFor(), this does not fall back to a default icon — it
// returns null when a category has no matching file, so callers can decide
// how to render amenities in categories we don't have artwork for yet.
export function amenityIconUrlForCategory(category) {
  const file = CATEGORY_ICONS[normalizeCategory(category)];
  return file ? `${ICON_BASE}/${file}` : null;
}

// One icon per distinct amenity across all the places given, counting each
// place's Additional Amenities, in first-seen order. Amenities without
// their own artwork share the generic icon, so they're merged into one chip
// whose label lists them all.
//
// With `max`, the row never exceeds that many chips: past the limit, the
// last chip becomes a "+N" count of the rest, keeping the row on one line.
export function amenityIconsHtml(amenities, { max = Infinity } = {}) {
  const labelsByIcon = new Map();
  amenities.flatMap(amenityFeatures).forEach((label) => {
    const file = iconFileFor(label);
    if (!labelsByIcon.has(file)) labelsByIcon.set(file, []);
    const labels = labelsByIcon.get(file);
    if (!labels.includes(label)) labels.push(label);
  });
  if (!labelsByIcon.size) return '';

  const entries = [...labelsByIcon];
  const shown = entries.length > max ? entries.slice(0, max - 1) : entries;
  const hidden = entries.slice(shown.length);

  const items = shown.map(([file, labels]) => {
    const label = labels.join(', ');
    return `<li class="amenity-icons__item" title="${escapeAttr(label)}">
        <img src="${ICON_BASE}/${file}" alt="${escapeAttr(label)}" width="20" height="20" loading="lazy" />
      </li>`;
  });
  if (hidden.length) {
    const label = hidden.flatMap(([, labels]) => labels).join(', ');
    items.push(
      `<li class="amenity-icons__item amenity-icons__item--more" title="${escapeAttr(label)}" aria-label="${escapeAttr(`Also: ${label}`)}">+${hidden.length}</li>`
    );
  }

  return `<ul class="amenity-icons">${items.join('')}</ul>`;
}

// The Airtable "Google Maps URL" when set, otherwise a Google Maps search
// for the place's GPS coordinates or address. Null if there's nothing to go on.
function amenityMapsUrl(amenity) {
  if (amenity.mapsUrl) return amenity.mapsUrl;
  let query = '';
  if (Number.isFinite(amenity.lat) && Number.isFinite(amenity.lng)) {
    query = `${amenity.lat},${amenity.lng}`;
  } else if (amenity.address) {
    query = `${amenity.name}, ${amenity.address}`;
  }
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
}

// List items for a set of places: the name (linked to Google Maps when
// possible), a short meta label, and the place's Additional Amenities.
// `metaFor` returns the meta label for a place; it defaults to its Category.
// Callers supply the surrounding <ul> and its class.
export function amenityListItemsHtml(amenities, { metaFor = (a) => a.category } = {}) {
  return amenities
    .map((amenity) => {
      const url = amenityMapsUrl(amenity);
      const name = url
        ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener">${escapeHtml(amenity.name)}</a>`
        : escapeHtml(amenity.name);
      const extras = amenityFeatures(amenity).filter((label) => label !== canonicalLabel(amenity.category));
      return `<li>
        <strong>${name}</strong><span>${escapeHtml(metaFor(amenity) || '')}</span>
        ${extras.length ? `<small class="amenity-extras">${escapeHtml(extras.join(' · '))}</small>` : ''}
      </li>`;
    })
    .join('');
}
