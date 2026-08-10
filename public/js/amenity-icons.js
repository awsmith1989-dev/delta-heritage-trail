import { escapeAttr } from './utils.js';

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

function iconFileFor(category) {
  return CATEGORY_ICONS[normalizeCategory(category)] || CATEGORY_ICONS.point_of_interest;
}

// Unlike iconFileFor(), this does not fall back to a default icon — it
// returns null when a category has no matching file, so callers can decide
// how to render amenities in categories we don't have artwork for yet.
export function amenityIconUrlForCategory(category) {
  const file = CATEGORY_ICONS[normalizeCategory(category)];
  return file ? `${ICON_BASE}/${file}` : null;
}

// One icon per distinct category present, in first-seen order.
export function amenityIconsHtml(amenities) {
  if (!amenities.length) return '';

  const seen = new Set();
  const items = [];
  amenities.forEach((amenity) => {
    const key = normalizeCategory(amenity.category);
    if (seen.has(key)) return;
    seen.add(key);
    const label = amenity.category || 'Amenity';
    items.push(
      `<li class="amenity-icons__item" title="${escapeAttr(label)}">
        <img src="${ICON_BASE}/${iconFileFor(label)}" alt="${escapeAttr(label)}" width="20" height="20" loading="lazy" />
      </li>`
    );
  });

  return `<ul class="amenity-icons">${items.join('')}</ul>`;
}
