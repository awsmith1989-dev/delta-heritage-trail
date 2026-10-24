import { escapeHtml, escapeAttr } from './utils.js';

// The section (and its nav links) stay hidden until there's at least one
// published resource with a link, rather than showing an empty state.
export function renderResources(resources) {
  const section = document.getElementById('resources');
  const grid = document.getElementById('resources-grid');
  if (!section || !grid) return;

  const linked = resources.filter((r) => r.name && r.url).sort(compareResources);
  if (!linked.length) {
    document.querySelectorAll('a[href="#resources"]').forEach((link) => link.remove());
    return;
  }

  grid.innerHTML = linked.map(resourceCard).join('');
  section.hidden = false;
}

// Sort Order ascending, then unnumbered resources alphabetically.
function compareResources(a, b) {
  if (a.sortOrder != null && b.sortOrder != null) return a.sortOrder - b.sortOrder;
  if (a.sortOrder != null) return -1;
  if (b.sortOrder != null) return 1;
  return a.name.localeCompare(b.name);
}

function resourceCard(resource) {
  return `
    <a class="resource-card" href="${escapeAttr(resource.url)}" target="_blank" rel="noopener">
      ${resource.image ? `<div class="resource-card__logo"><img src="${escapeAttr(resource.image)}" alt="" loading="lazy" /></div>` : ''}
      <div class="resource-card__body">
        <h3>${escapeHtml(resource.name)}</h3>
        ${resource.description ? `<p>${escapeHtml(resource.description)}</p>` : ''}
        <span class="resource-card__host">${escapeHtml(hostname(resource.url))} &nearr;</span>
      </div>
    </a>
  `;
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'Visit website';
  }
}
