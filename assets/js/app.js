const DATA_URL = 'data/monasteries.json';
let DATA = [];

// Load JSON data
async function loadData() {
  if (DATA.length) return DATA;
  const res = await fetch(DATA_URL, { cache: "no-cache" });
  DATA = await res.json();
  return DATA;
}

// Highlight helper
function highlight(text, query) {
  if (!query) return text;
  const regex = new RegExp(`(${query})`, 'gi');
  return text.replace(regex, `<mark>$1</mark>`);
}

// Render Explore page
async function renderExplore() {
  await loadData();
  const grid = document.getElementById('explore-list');
  if (!grid) return;

  const q = (document.getElementById('q')?.value || '').toLowerCase();
  const dist = document.getElementById('district')?.value || '';
  const trad = document.getElementById('tradition')?.value || '';

  grid.innerHTML = '';

  let results = DATA.filter(it => {
    const t = (it.name + ' ' + it.notes).toLowerCase();
    if (q && !t.includes(q)) return false;
    if (dist && it.district !== dist) return false;
    if (trad && it.tradition !== trad) return false;
    return true;
  });

  if (!results.length) {
    grid.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted)">No monasteries found matching your filters.</div>`;
    return;
  }

  results.forEach(it => {
    const el = document.createElement('div');
    el.className = 'card fade-in';
    el.innerHTML = `
      <img src="${it.images[0]}" alt="${it.name}" loading="lazy"/>
      <div class="card-body">
        <h3 style="margin:0">${highlight(it.name, q)}</h3>
        <div class="meta">${it.district} • ${it.tradition}</div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="openModal(${it.id})">View</button>
          <a class="btn btn-soft" href="map.html" onclick="localStorage.setItem('focus_marker', ${it.id})">Open on Map</a>
          <a class="btn btn-soft" href="view360.html?id=${it.id}">360° View</a>
        </div>
      </div>`;
    grid.appendChild(el);
  });

  // Populate filters
  const dSel = document.getElementById('district');
  const tSel = document.getElementById('tradition');
  if (dSel && dSel.options.length <= 1) {
    [...new Set(DATA.map(d => d.district))].sort().forEach(d => dSel.add(new Option(d, d)));
  }
  if (tSel && tSel.options.length <= 1) {
    [...new Set(DATA.map(d => d.tradition))].sort().forEach(t => tSel.add(new Option(t, t)));
  }
}

// Modal logic
let CURRENT = null;
function openModal(id) {
  CURRENT = DATA.find(x => x.id === id);
  if (!CURRENT) return;

  document.getElementById('modal-title').textContent = CURRENT.name;
  document.getElementById('modal-meta').textContent = `${CURRENT.district} • ${CURRENT.tradition} • ${CURRENT.access || 'N/A'}`;
  document.getElementById('modal-notes').textContent = CURRENT.notes || '';
  document.getElementById('modal-image').src = CURRENT.images[0];

  const thumbs = document.getElementById('modal-thumbs');
  thumbs.innerHTML = '';
  (CURRENT.images || []).forEach(src => {
    const t = document.createElement('img');
    t.src = src;
    t.loading = 'lazy';
    t.addEventListener('click', () => document.getElementById('modal-image').src = src);
    thumbs.appendChild(t);
  });

  // Directions & 360
  const dir = document.getElementById('modal-directions');
  if (dir && CURRENT.lat && CURRENT.lng) dir.href = `https://www.google.com/maps?q=${CURRENT.lat},${CURRENT.lng}`;

  const v360 = document.getElementById('modal-360');
  if (v360) v360.href = `view360.html?id=${id}`;

  document.getElementById('modal').classList.add('show');
}

function closeModal() {
  document.getElementById('modal')?.classList.remove('show');
}

// Render featured monasteries
async function renderFeatured() {
  await loadData();
  const feat = document.getElementById('featured');
  if (!feat) return;

  DATA.slice(0, 8).forEach(it => {
    const c = document.createElement('div');
    c.className = 'card fade-in';
    c.innerHTML = `
      <img src="${it.images[0]}" alt="${it.name}"/>
      <div class="card-body">
        <h3 style="margin:0">${it.name}</h3>
        <div class="meta">${it.district} • ${it.tradition}</div>
        <div style="margin-top:10px">
          <button class="btn btn-primary" onclick="openModal(${it.id})">Quick View</button>
          <a class="btn btn-soft" href="view360.html?id=${it.id}">360°</a>
        </div>
      </div>`;
    feat.appendChild(c);
  });
}

// Initialize Leaflet map
async function initMap() {
  await loadData();
  if (!window.L || !document.getElementById('main-map')) return;

  const map = L.map('main-map').setView([27.33, 88.45], 9);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

  const markers = {};
  DATA.forEach(it => {
    if (!it.lat || !it.lng) return;
    const m = L.marker([it.lat, it.lng]).addTo(map);
    m.bindPopup(`<strong>${it.name}</strong><br>${it.district}`);
    m.on('click', () => openModal(it.id));
    markers[it.id] = m;
  });

  const focus = localStorage.getItem('focus_marker');
  if (focus) {
    const id = Number(focus);
    localStorage.removeItem('focus_marker');
    if (markers[id]) {
      map.setView(markers[id].getLatLng(), 12);
      markers[id].openPopup();
      openModal(id);
    }
  }
}

// Initialize 360° viewer
async function init360() {
  await loadData();
  const url = new URL(location.href);
  const id = Number(url.searchParams.get('id'));
  const it = DATA.find(x => x.id === id) || DATA[0];

  document.getElementById('m-name').textContent = it.name;
  document.getElementById('m-meta').textContent = `${it.district} • ${it.tradition}`;

  if (it.pano) {
    pannellum.viewer('pano', {
      type: 'equirectangular',
      panorama: it.pano,
      autoLoad: true,
      autoRotate: -2,
      compass: false,
      showFullscreenCtrl: true,
      showControls: true
    });
  } else {
    document.getElementById('pano').innerHTML = `<div style="padding:30px;text-align:center;color:var(--muted)">360° view not available yet for this monastery.</div>`;
  }

  const gallery = document.getElementById('m-gallery');
  gallery.innerHTML = '';
  (it.images || []).forEach(src => {
    const img = document.createElement('img');
    img.src = src;
    img.alt = it.name;
    img.loading = 'lazy';
    gallery.appendChild(img);
  });
}

// DOM ready
document.addEventListener('DOMContentLoaded', () => {
  renderFeatured();
  
  if (document.getElementById('explore-list')) {
    renderExplore();
    document.getElementById('q')?.addEventListener('input', () => setTimeout(renderExplore, 220));
    document.getElementById('district')?.addEventListener('change', renderExplore);
    document.getElementById('tradition')?.addEventListener('change', renderExplore);
  }

  if (document.getElementById('main-map')) initMap();
  if (document.getElementById('pano')) init360();

  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal')?.addEventListener('click', e => {
    if (e.target.id === 'modal') closeModal();
  });
});
