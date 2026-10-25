import { escapeAttr } from './utils.js';

// "Our Favorite Routes" cards. Each Card Image is a finished design with the
// title, route, and blurb baked in, so the card is just the image linking
// out to its blog post; the text lives in alt text for screen readers.
//
// Like resources, the section (and its nav links) stay hidden until at least
// one route is ready to show.
export function renderFavoriteRoutes(routes) {
  const section = document.getElementById('routes');
  const grid = document.getElementById('routes-grid');
  if (!section || !grid) return;

  const ready = routes.filter((r) => r.url && r.image);
  if (!ready.length) {
    document.querySelectorAll('a[href="#routes"]').forEach((link) => link.remove());
    return;
  }

  grid.innerHTML = ready.map(routeCard).join('');
  section.hidden = false;
}

function routeCard(route) {
  const label = [route.title, route.name].filter(Boolean).join(': ') || 'Favorite route';
  return `
    <a class="route-card" href="${escapeAttr(route.url)}" target="_blank" rel="noopener">
      <img src="${escapeAttr(route.image)}" alt="${escapeAttr(label)}" loading="lazy" />
    </a>
  `;
}
