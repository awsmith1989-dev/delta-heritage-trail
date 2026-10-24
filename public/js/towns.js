import { escapeHtml, escapeAttr } from './utils.js';
import { amenityIconsHtml, amenityListItemsHtml } from './amenity-icons.js';

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

  grid.innerHTML = dataset.communities
    .map((community) => townCard(community, dataset.amenities))
    .join('');
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
  const iconsHtml = amenityIconsHtml(communityAmenities);

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
        : iconsHtml ? `<div class="town-card__summary">${iconsHtml}</div>` : ''}
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
