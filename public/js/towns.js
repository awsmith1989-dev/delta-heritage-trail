import { escapeHtml, escapeAttr } from './utils.js';
import { amenityIconsHtml, amenityListItemsHtml } from './amenity-icons.js';
import { locateOnTrail } from './trail-line.js';

export function renderTrailTowns(dataset) {
  const grid = document.getElementById('towns-grid');
  if (!grid) return;

  if (dataset.error) {
    grid.innerHTML = '<p class="towns-grid__message">We could not load trail towns right now. Please refresh to try again.</p>';
    return;
  }

  if (!dataset.communities.length) {
    grid.innerHTML = '<p class="towns-grid__message">Trail town information is coming soon.</p>';
    return;
  }

  grid.innerHTML = sortNorthToSouth(dataset.communities, dataset.trailLine)
    .map((community) => townCard(community, dataset.amenities))
    .join('');
}

// Trail order runs north (Lexa, mile 0) to south (Arkansas City), so sort by
// trail mile when the traced route is available, otherwise by latitude.
// Towns without coordinates go last.
function sortNorthToSouth(communities, trailLine) {
  const position = (c) => {
    if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) return Infinity;
    return trailLine ? locateOnTrail(trailLine, c.lng, c.lat).mile : -c.lat;
  };
  return communities
    .map((c) => ({ c, pos: position(c) }))
    .sort((a, b) => a.pos - b.pos)
    .map(({ c }) => c);
}

function townCard(community, amenities) {
  const badge = community.trailReadyStatus
    ? `<span class="town-card__badge town-card__badge--${slug(community.trailReadyStatus)}">${escapeHtml(community.trailReadyStatus)}</span>`
    : '';

  const communityAmenities = amenities.filter((a) => a.communityIds.includes(community.id));

  // Everything below the photo except the amenity icons is tucked into a
  // collapsed <details> so the photo leads; the icons stay in the summary
  // row as an at-a-glance view of what the town offers.
  const detailsHtml = [
    community.niche ? `<p class="town-card__niche">${escapeHtml(community.niche)}</p>` : '',
    community.description ? `<p>${escapeHtml(community.description)}</p>` : '',
    communityAmenities.length ? `<ul class="town-card__places">${amenityListItemsHtml(communityAmenities)}</ul>` : '',
    community.website ? `<a class="town-card__link" href="${escapeAttr(community.website)}" target="_blank" rel="noopener">Learn more &rarr;</a>` : '',
  ].join('');
  // Capped so the row stays on one line and every card's footer is the
  // same height; the full list is in Details.
  const iconsHtml = amenityIconsHtml(communityAmenities, { max: 4 });

  return `
    <article class="town-card">
      <div class="town-card__media" ${community.photo ? `style="background-image:url('${escapeAttr(community.photo)}')"` : ''}>
        ${!community.photo ? `<span class="town-card__initial">${escapeHtml(initials(community.name))}</span>` : ''}
        ${badge}
        <h3 class="town-card__name">${escapeHtml(community.name)}</h3>
      </div>
      ${detailsHtml
        ? `<details class="town-card__details">
            <summary class="town-card__summary">
              ${iconsHtml || '<span></span>'}
              <span class="town-card__toggle">Details</span>
            </summary>
            <div class="town-card__body">${detailsHtml}</div>
          </details>`
        : `<div class="town-card__summary">${iconsHtml}</div>`}
    </article>
  `;
}

function initials(name) {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}
