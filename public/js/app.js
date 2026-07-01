import { getMapboxToken, getTrailSegments, getCommunities, getAmenities } from './data.js';
import { normalizeSegment, normalizeCommunity, normalizeAmenity } from './normalize.js';
import { initMap } from './map.js';
import { renderTrailTowns } from './towns.js';
import { renderStats } from './stats.js';

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();
  setupSmoothScroll();
  setupHeroToggle();
  setYear();

  const [dataset, mapboxToken] = await Promise.all([loadTrailData(), loadMapboxToken()]);

  initMap(dataset, mapboxToken);
  renderTrailTowns(dataset);
  renderStats(dataset);
});

async function loadTrailData() {
  try {
    const [segmentRecords, communityRecords, amenityRecords] = await Promise.all([
      getTrailSegments(),
      getCommunities(),
      getAmenities(),
    ]);

    return {
      segments: segmentRecords.map(normalizeSegment),
      communities: communityRecords.map(normalizeCommunity),
      amenities: amenityRecords.map(normalizeAmenity),
      error: null,
    };
  } catch (err) {
    console.error('Failed to load trail data', err);
    return { segments: [], communities: [], amenities: [], error: err };
  }
}

async function loadMapboxToken() {
  try {
    return await getMapboxToken();
  } catch (err) {
    console.error('Failed to load Mapbox token', err);
    return null;
  }
}

function setupNav() {
  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.classList.toggle('is-open', isOpen);
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.classList.remove('is-open');
    });
  });
}

function setupSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href').slice(1);
      const target = document.getElementById(id);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });
}

function setupHeroToggle() {
  const overlay = document.getElementById('map-hero-overlay');
  const toggle = document.getElementById('map-hero-toggle');
  if (!overlay || !toggle) return;

  toggle.addEventListener('click', () => {
    const collapsed = overlay.classList.toggle('is-collapsed');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', collapsed ? 'Show trail info' : 'Minimize trail info');
    toggle.innerHTML = collapsed ? '&plus;' : '&minus;';
  });
}

function setYear() {
  const el = document.getElementById('current-year');
  if (el) el.textContent = String(new Date().getFullYear());
}
