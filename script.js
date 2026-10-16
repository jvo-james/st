/* KNUST Shuttle — front-end demo tracker.
 * Shuttle positions are simulated in this standalone build. Replace the demo feed
 * in BUS_DATA with a trusted backend/GPS source to show live vehicle positions.
 */
(function () {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const appError = $('#appError');

  const iconSvg = {
    bus: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.2 2.6h9.6c2.2 0 3.2 1.4 3.2 3.5v11.3c0 1.1-.8 2-1.9 2h-.5v1.1a1.3 1.3 0 0 1-2.6 0v-1.1H9v1.1a1.3 1.3 0 0 1-2.6 0v-1.1h-.5c-1.1 0-1.9-.9-1.9-2V6.1c0-2.1 1-3.5 3.2-3.5Z" fill="currentColor"/><path d="M6.5 6.5c0-.7.5-1.2 1.2-1.2h8.6c.7 0 1.2.5 1.2 1.2v4H6.5v-4Z" fill="#0e2a24" opacity=".83"/><path d="M7 13h10v2.7H7z" fill="#fff" opacity=".95"/><circle cx="7.5" cy="17" r="1" fill="#142722"/><circle cx="16.5" cy="17" r="1" fill="#142722"/></svg>',
    stop: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.2" stroke="currentColor" stroke-width="1.8"/></svg>',
    landmark: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 9.5 12 4l8 5.5M6 10v8m4-8v8m4-8v8m4-8v8M4 20h16M3 10h18" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    users: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M16 5.5a3 3 0 0 1 0 5.8M17 13.5a4 4 0 0 1 3.5 4V19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
  };

  if (!window.L) {
    appError.hidden = false;
    appError.innerHTML = '<div><h2>The campus map could not load</h2><p>Check your internet connection and reload this page. The map uses Leaflet and OpenStreetMap tiles loaded online.</p></div>';
    return;
  }

  const COLORS = {
    green: { color: '#20846a', tint: '#e1f3e9' },
    blue: { color: '#4a7fd0', tint: '#e8efff' },
    amber: { color: '#c28c35', tint: '#fff1d7' },
    violet: { color: '#8768c6', tint: '#f0eaff' }
  };

  // OpenStreetMap/Mapcarta coordinates for mapped landmarks and bus stop locations.
  // Stops identified only by nearby features are explicitly marked approximate.
  const STOPS = [
    { id: 'conti', name: 'Conti Roundabout', lat: 6.67920, lng: -1.57083, type: 'stop', source: 'OpenStreetMap', accuracy: 'mapped', detail: 'A major campus interchange near Unity Hall and Paa Joe Stadium.', routes: ['green', 'blue', 'amber'] },
    { id: 'pentecost', name: 'Pentecost Bus Stop', lat: 6.67457, lng: -1.56755, type: 'stop', source: 'OpenStreetMap', accuracy: 'mapped', detail: 'Campus stop serving the academic and residential areas.', routes: ['green', 'blue', 'amber'] },
    { id: 'business', name: 'Business School / KSB Stop', lat: 6.66932, lng: -1.56716, type: 'stop', source: 'OpenStreetMap', accuracy: 'mapped', detail: 'The mapped Business School and KSB stop location on P.V. Obeng Avenue.', routes: ['green', 'blue'] },
    { id: 'brunei', name: 'Brunei Bus Stop', lat: 6.67115, lng: -1.57435, type: 'stop', source: 'OpenStreetMap nearby-feature estimate', accuracy: 'approximate', detail: 'Placement estimated from mapped nearby hostels and GUSSS Sports Complex; confirm exact boarding point on-site.', routes: ['green', 'amber'] },
    { id: 'ccb', name: 'CCB Bus Stop', lat: 6.67592, lng: -1.56522, type: 'stop', source: 'OpenStreetMap nearby-feature estimate', accuracy: 'approximate', detail: 'Approximate stop placement beside the mapped CCB Bush Canteen / FoSS Library area.', routes: ['blue', 'amber'] },
    { id: 'steps', name: 'Steps Bus Stop', lat: 6.67515, lng: -1.56570, type: 'stop', source: 'OpenStreetMap nearby-feature estimate', accuracy: 'approximate', detail: 'Approximate position within the mapped CCB / FoSS academic area.', routes: ['blue'] },
    { id: 'commercial', name: 'Commercial Area Shuttle Stop', lat: 6.68340, lng: -1.57566, type: 'stop', source: 'OpenStreetMap commercial-area centroid', accuracy: 'approximate', detail: 'Approximate pickup point within the Commercial Area. Use the basemap to confirm the exact boarding bay.', routes: ['blue', 'amber'] }
  ];

  const PLACES = [
    { id: 'botanical', name: 'KNUST Botanical Garden', lat: 6.68150, lng: -1.56570, type: 'landmark', source: 'OpenStreetMap', detail: 'The university botanical garden and green space.', accuracy: 'mapped' },
    { id: 'unity', name: 'Unity Hall', lat: 6.67953, lng: -1.57186, type: 'landmark', source: 'OpenStreetMap', detail: 'A well-known student residence close to Conti Roundabout.', accuracy: 'mapped' },
    { id: 'republic', name: 'Republic Hall', lat: 6.67852, lng: -1.57402, type: 'landmark', source: 'OpenStreetMap', detail: 'Student residence on the central-west side of campus.', accuracy: 'mapped' },
    { id: 'queens', name: 'Queen Elizabeth II Hall', lat: 6.67661, lng: -1.57446, type: 'landmark', source: 'OpenStreetMap', detail: 'Queen Elizabeth II Hall and the nearby Royal Parade Ground.', accuracy: 'mapped' },
    { id: 'great-hall', name: 'The Old Great Hall', lat: 6.68115, lng: -1.57413, type: 'landmark', source: 'OpenStreetMap', detail: 'The older Great Hall / central university landmark.', accuracy: 'mapped' },
    { id: 'library', name: 'KNUST Library Mall', lat: 6.67737, lng: -1.56627, type: 'landmark', source: 'OpenStreetMap', detail: 'A mapped campus library-area feature. Nearby library buildings are visible on the basemap.', accuracy: 'mapped' },
    { id: 'gusss', name: 'GUSSS Sports Complex', lat: 6.66958, lng: -1.57568, type: 'landmark', source: 'OpenStreetMap', detail: 'University sports facilities near Brunei Bus Stop.', accuracy: 'mapped' },
    { id: 'ccb-canteen', name: 'CCB Bush Canteen', lat: 6.67576, lng: -1.56490, type: 'landmark', source: 'OpenStreetMap', detail: 'A mapped food spot by Evans Anfom Auditorium and FoSS Library.', accuracy: 'mapped' }
  ];

  const featureById = new Map([...STOPS, ...PLACES].map(item => [item.id, item]));
  const ROUTES = {
    green: {
      id: 'green', name: 'Halls ↔ Academic Core', short: 'HALLS–CORE', color: COLORS.green.color, tint: COLORS.green.tint,
      description: 'Halls, Conti & academic stops', cycleMs: 900000,
      path: ['brunei', 'business', 'pentecost', 'library', 'conti', 'unity', 'republic', 'queens', 'brunei']
    },
    blue: {
      id: 'blue', name: 'Commercial ↔ Academic Loop', short: 'CAMPUS LOOP', color: COLORS.blue.color, tint: COLORS.blue.tint,
      description: 'Commercial Area, central campus & east', cycleMs: 1020000,
      path: ['commercial', 'great-hall', 'conti', 'botanical', 'library', 'pentecost', 'ccb', 'steps', 'commercial']
    },
    amber: {
      id: 'amber', name: 'Residence Connector', short: 'RESIDENCE', color: COLORS.amber.color, tint: COLORS.amber.tint,
      description: 'Residence areas, CCB & campus core', cycleMs: 960000,
      path: ['brunei', 'gusss', 'queens', 'republic', 'unity', 'conti', 'pentecost', 'ccb', 'brunei']
    }
  };

  const BUS_DATA = [
    { id: 'K-01', name: 'Shuttle K-01', routeId: 'green', occupancy: 12, capacity: 18, offset: 0.11, delay: 0 },
    { id: 'K-02', name: 'Shuttle K-02', routeId: 'blue', occupancy: 7, capacity: 18, offset: 0.42, delay: 0 },
    { id: 'K-03', name: 'Shuttle K-03', routeId: 'amber', occupancy: 15, capacity: 20, offset: 0.68, delay: 0 },
    { id: 'K-04', name: 'Shuttle K-04', routeId: 'green', occupancy: 4, capacity: 18, offset: 0.78, delay: 0 }
  ];

  const map = L.map('map', {
    zoomControl: false,
    preferCanvas: true,
    zoomSnap: 0.25,
    zoomDelta: 0.5,
    minZoom: 13,
    maxZoom: 19,
    wheelDebounceTime: 35,
    fadeAnimation: true,
    markerZoomAnimation: true
  });
  // CARTO Voyager is the primary street basemap. The standard OSM tile server
  // can reject direct file:// use in some browsers, so use independent style
  // endpoints and a bundled local schematic as the final fallback.
  const streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=cb1_4m0o_1_7bc2e168d25a26b3ddd79605', {
    maxZoom: 19,
    maxNativeZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    crossOrigin: true,
    keepBuffer: 2,
    updateWhenIdle: true,
    updateWhenZooming: false
  });
  const streetBackupLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=cb1_4m0o_1_7bc2e168d25a26b3ddd79605', {
    maxZoom: 19,
    subdomains: 'abcd',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    crossOrigin: true,
    keepBuffer: 2,
    updateWhenIdle: true
  });
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: 19,
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    crossOrigin: true
  });
  streetLayer.addTo(map);
  map.setView([6.6778, -1.5713], 15);

  const routeLayers = {};
  const routeOutlines = {};
  const stopMarkers = {};
  const placeMarkers = {};
  const busMarkers = {};
  const buses = BUS_DATA.map(data => {
    const route = ROUTES[data.routeId];
    const coordinates = route.path.map(key => {
      const feature = featureById.get(key);
      return [feature.lat, feature.lng];
    });
    const segmentMeters = [];
    let totalMeters = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const distance = haversine(coordinates[i], coordinates[i + 1]);
      segmentMeters.push(distance);
      totalMeters += distance;
    }
    return { ...data, route, coordinates, motionCoordinates: coordinates, geometryBoundaries: coordinates.map((_, i) => i), segmentMeters, totalMeters, cycleMs: route.cycleMs + data.offset * 12000, marker: null, currentLatLng: coordinates[0], nextFeatureId: route.path[1], segmentIndex: 0, progress: 0, heading: 0, trailLine: null, trailPoints: [], lastTrailAt: 0 };
  });

  let currentTab = 'shuttles';
  let searchTerm = '';
  let selectedBusId = 'K-01';
  let selectedFeatureId = null;
  let routesVisible = true;
  let satelliteOn = false;
  let usingBackupTiles = false;
  let userMarker = null;
  let userAccuracyCircle = null;
  let userLocation = null;
  let watchId = null;
  let followLocation = false;
  let toastTimeout = null;
  let searchFocusMarker = null;

  function haversine(a, b) {
    const toRad = n => n * Math.PI / 180;
    const [lat1, lng1] = a;
    const [lat2, lng2] = b;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  }

  function routeForBus(bus) { return ROUTES[bus.routeId]; }
  function getBus(id) { return buses.find(bus => bus.id === id); }
  function activeBus() { return getBus(selectedBusId) || buses[0]; }

  function busIconHtml(bus, selected = false, dimmed = false) {
    const route = routeForBus(bus);
    return `<div class="bus-map-icon${selected ? ' selected' : ''}${dimmed ? ' dimmed' : ''}" style="--bus-color:${route.color};--heading:${bus.heading || 0}deg"><span class="bus-halo"></span><span class="bus-shadow"></span><span class="bus-body">${iconSvg.bus}</span><span class="bus-route-chip">${route.short.split(' ')[0]}</span></div>`;
  }
  function stopIconHtml(stop, selected = false, dimmed = false) {
    return `<div class="stop-map-icon${selected ? ' selected' : ''}${stop.accuracy === 'approximate' ? ' approximate' : ''}" style="opacity:${dimmed ? '.22' : '1'}"><span class="stop-pin">${iconSvg.stop}</span></div>`;
  }
  function placeIconHtml(place, selected = false, dimmed = false) {
    return `<div class="landmark-map-icon${selected ? ' selected' : ''}" style="opacity:${dimmed ? '.18' : '1'}">${iconSvg.landmark}</div>`;
  }
  function busDivIcon(bus, selected = false, dimmed = false) {
    return L.divIcon({ className: 'marker-shell bus-marker-shell', html: busIconHtml(bus, selected, dimmed), iconSize: [44, 44], iconAnchor: [22, 22], popupAnchor: [0, -17] });
  }
  function stopDivIcon(stop, selected = false, dimmed = false) {
    return L.divIcon({ className: 'marker-shell stop-marker-shell', html: stopIconHtml(stop, selected, dimmed), iconSize: [26, 32], iconAnchor: [13, 30], popupAnchor: [0, -24] });
  }
  function placeDivIcon(place, selected = false, dimmed = false) {
    return L.divIcon({ className: 'marker-shell place-marker-shell', html: placeIconHtml(place, selected, dimmed), iconSize: [23, 23], iconAnchor: [11, 11], popupAnchor: [0, -12] });
  }

  // Hide Leaflet's default icon styling for our HTML markers.
  const markerStyle = document.createElement('style');
  markerStyle.textContent = '.marker-shell{background:transparent;border:0}.leaflet-marker-icon{outline:0}';
  document.head.appendChild(markerStyle);

  function makePopup(feature) {
    const kind = feature.type === 'stop' ? 'Campus bus stop' : 'Campus landmark';
    const accuracy = feature.accuracy === 'approximate' ? '<span class="popup-approx">Approximate placement — confirm locally</span>' : '';
    const action = feature.type === 'stop'
      ? `<button type="button" data-focus-feature="${escapeHtml(feature.id)}">View stop & arrivals</button>`
      : `<button type="button" data-focus-feature="${escapeHtml(feature.id)}">Focus landmark</button>`;
    return `<div class="map-popup"><span class="popup-eyebrow">${kind}</span><strong>${escapeHtml(feature.name)}</strong><p>${escapeHtml(feature.detail)}</p>${accuracy}${action}</div>`;
  }

  function setupMapFeatures() {
    for (const [id, route] of Object.entries(ROUTES)) {
      const latLngs = route.path.map(key => {
        const feature = featureById.get(key);
        return [feature.lat, feature.lng];
      });
      routeOutlines[id] = L.polyline(latLngs, {
        color: '#ffffff', weight: 10, opacity: 0.92, lineCap: 'round', lineJoin: 'round',
        interactive: false, className: `route-outline route-outline-${id}`
      }).addTo(map);
      routeLayers[id] = L.polyline(latLngs, {
        color: route.color, weight: 4.5, opacity: 0.64, lineCap: 'round', lineJoin: 'round',
        dashArray: '9 9', className: `route-line route-${id}`, interactive: true
      }).addTo(map);
      routeLayers[id].on('click', () => {
        selectBus(buses.find(bus => bus.routeId === id).id, false);
        showToast(`${route.name} · ${route.roadGeometry ? 'road-following demo corridor' : 'indicative demo corridor'}`);
      });
    }

    for (const stop of STOPS) {
      const marker = L.marker([stop.lat, stop.lng], { icon: stopDivIcon(stop), keyboard: true, title: stop.name, riseOnHover: true });
      marker.bindPopup(makePopup(stop), { closeButton: false, offset: [0, -5], autoPanPadding: [25, 25] });
      marker.on('click', () => { selectedFeatureId = stop.id; refreshFeatureMarkerStyles(); });
      marker.addTo(map);
      stopMarkers[stop.id] = marker;
    }

    for (const place of PLACES) {
      const marker = L.marker([place.lat, place.lng], { icon: placeDivIcon(place), keyboard: true, title: place.name, riseOnHover: true });
      marker.bindPopup(makePopup(place), { closeButton: false, offset: [0, -5], autoPanPadding: [25, 25] });
      marker.on('click', () => { selectedFeatureId = place.id; refreshFeatureMarkerStyles(); });
      marker.addTo(map);
      placeMarkers[place.id] = marker;
    }

    buses.forEach((bus, index) => {
      bus.marker = L.marker(bus.coordinates[0], { icon: busDivIcon(bus), keyboard: true, title: bus.name, zIndexOffset: 800 + index * 2, riseOnHover: true }).addTo(map);
      bus.marker.on('click', () => selectBus(bus.id, true));
      bus.marker.bindTooltip(`${bus.name} · ${routeForBus(bus).name}`, { direction: 'top', offset: [0, -22], opacity: .98, className: 'bus-tooltip' });
      bus.trailLine = L.polyline([], { color: routeForBus(bus).color, weight: 7, opacity: bus.id === selectedBusId ? .48 : 0, lineCap: 'round', lineJoin: 'round', interactive: false, className: 'bus-motion-trail' }).addTo(map);
    });

    updateRouteStyles();
    refreshFeatureMarkerStyles();
    refreshBusMarkerStyles();
  }

  function getBusMotion(bus, now) {
    const coordinates = bus.motionCoordinates || bus.coordinates;
    const boundaries = bus.geometryBoundaries || coordinates.map((_, i) => i);
    const legMeters = bus.segmentMeters;
    const elapsed = ((now + bus.delay) % bus.cycleMs + bus.cycleMs) % bus.cycleMs;
    const traveled = (elapsed / bus.cycleMs) * Math.max(bus.totalMeters, 1);
    let remaining = traveled;
    let legIndex = 0;
    while (legIndex < legMeters.length - 1 && remaining >= legMeters[legIndex]) {
      remaining -= legMeters[legIndex];
      legIndex++;
    }
    const legLength = Math.max(legMeters[legIndex] || 1, 1);
    const progress = Math.max(0, Math.min(1, remaining / legLength));
    const firstIndex = boundaries[legIndex] ?? legIndex;
    const lastIndex = boundaries[legIndex + 1] ?? (firstIndex + 1);
    const targetDistance = remaining;
    let walked = 0;
    let latLng = coordinates[Math.min(firstIndex, coordinates.length - 1)];
    let previous = latLng;
    let next = coordinates[Math.min(firstIndex + 1, coordinates.length - 1)] || previous;
    for (let i = firstIndex; i < lastIndex; i++) {
      const a = coordinates[i];
      const b = coordinates[i + 1] || a;
      const length = haversine(a, b);
      previous = a; next = b;
      if (walked + length >= targetDistance || i === lastIndex - 1) {
        const segmentProgress = length > 0 ? Math.max(0, Math.min(1, (targetDistance - walked) / length)) : 0;
        latLng = [a[0] + (b[0] - a[0]) * segmentProgress, a[1] + (b[1] - a[1]) * segmentProgress];
        break;
      }
      walked += length;
    }
    const dLng = (next[1] - previous[1]) * Math.cos(latLng[0] * Math.PI / 180);
    const dLat = next[0] - previous[0];
    const bearing = (Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360;
    const nextFeatureId = bus.route.path[legIndex + 1] || bus.route.path[0];
    const remainingInLeg = Math.max(0, legLength * (1 - progress));
    const effectiveSpeed = Math.max(bus.totalMeters / (bus.cycleMs / 1000), 0.8);
    const etaMin = Math.max(1, Math.ceil(remainingInLeg / effectiveSpeed / 60));
    return { latLng, segmentIndex: legIndex, progress, nextFeatureId, etaMin, bearing };
  }

  let lastCardRefresh = 0;
  function animateBuses(now = performance.now()) {
    buses.forEach(bus => {
      const motion = getBusMotion(bus, now + bus.offset * bus.cycleMs);
      bus.currentLatLng = motion.latLng;
      bus.segmentIndex = motion.segmentIndex;
      bus.progress = motion.progress;
      bus.nextFeatureId = motion.nextFeatureId;
      bus.etaMin = motion.etaMin;
      bus.heading = motion.bearing;
      bus.marker.setLatLng(motion.latLng);
      const markerElement = bus.marker.getElement();
      const body = markerElement && markerElement.querySelector('.bus-body');
      if (body) body.style.setProperty('--heading', `${bus.heading}deg`);
      if (now - bus.lastTrailAt > 420) {
        bus.trailPoints.push(motion.latLng);
        if (bus.trailPoints.length > 18) bus.trailPoints.shift();
        bus.lastTrailAt = now;
        if (bus.trailLine) bus.trailLine.setLatLngs(bus.trailPoints);
      }
      if (bus.trailLine) bus.trailLine.setStyle({ opacity: bus.id === selectedBusId && routesVisible ? .5 : (bus.id === selectedBusId ? .34 : 0) });
    });
    if (now - lastCardRefresh > 900) {
      updateSelectedCard();
      lastCardRefresh = now;
    }
    window.setTimeout(() => window.requestAnimationFrame(animateBuses), 30);
  }

  function configureBusRoadGeometry(route) {
    if (!route.roadGeometry || !route.roadBoundaries) return;
    route.roadGeometry = route.roadGeometry.filter(point => Array.isArray(point) && Number.isFinite(point[0]) && Number.isFinite(point[1]));
    if (route.roadGeometry.length < 3) return;
    const legMeters = [];
    for (let leg = 0; leg < route.roadBoundaries.length - 1; leg++) {
      let length = 0;
      for (let i = route.roadBoundaries[leg]; i < route.roadBoundaries[leg + 1]; i++) {
        if (route.roadGeometry[i + 1]) length += haversine(route.roadGeometry[i], route.roadGeometry[i + 1]);
      }
      legMeters.push(Math.max(length, 1));
    }
    buses.filter(bus => bus.routeId === route.id).forEach(bus => {
      bus.motionCoordinates = route.roadGeometry;
      bus.geometryBoundaries = route.roadBoundaries;
      bus.segmentMeters = legMeters.slice();
      bus.totalMeters = legMeters.reduce((sum, value) => sum + value, 0);
      bus.trailPoints = [];
      if (bus.trailLine) bus.trailLine.setLatLngs([]);
    });
    if (routeLayers[route.id]) routeLayers[route.id].setLatLngs(route.roadGeometry);
    if (routeOutlines[route.id]) routeOutlines[route.id].setLatLngs(route.roadGeometry);
    updateRouteStyles();
  }

  async function loadRoadFollowingGeometry(route) {
    const points = route.path.map(id => featureById.get(id)).filter(Boolean);
    if (points.length < 3) return;
    const coordinates = points.map(point => `${point.lng},${point.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) throw new Error('Road routing service unavailable');
      const data = await response.json();
      const routeData = data.routes && data.routes[0];
      const rawGeometry = routeData && routeData.geometry && routeData.geometry.coordinates;
      if (!rawGeometry || rawGeometry.length < 3) throw new Error('No road geometry returned');
      route.roadGeometry = rawGeometry.map(([lng, lat]) => [lat, lng]);
      const snappedWaypoints = (data.waypoints || []).map(item => item.location ? [item.location[1], item.location[0]] : null);
      const boundaries = [0];
      let lowerBound = 0;
      for (let waypointIndex = 1; waypointIndex < points.length; waypointIndex++) {
        const target = snappedWaypoints[waypointIndex] || [points[waypointIndex].lat, points[waypointIndex].lng];
        const maxIndex = route.roadGeometry.length - (points.length - waypointIndex - 1) - 1;
        let nearestIndex = Math.min(lowerBound + 1, maxIndex);
        let nearestDistance = Infinity;
        for (let i = lowerBound + 1; i <= maxIndex; i++) {
          const distance = haversine(route.roadGeometry[i], target);
          if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = i; }
        }
        boundaries.push(nearestIndex);
        lowerBound = nearestIndex;
      }
      if (boundaries.length !== points.length || boundaries.some((value, index) => index && value <= boundaries[index - 1])) throw new Error('Road waypoint matching failed');
      route.roadBoundaries = boundaries;
      configureBusRoadGeometry(route);
      routeLayers[route.id]?.setLatLngs(route.roadGeometry);
      routeOutlines[route.id]?.setLatLngs(route.roadGeometry);
      showToast(`${route.name} · road-following movement enabled`, 3200);
    } catch (error) {
      // Network routing is optional: retain the clearly labeled demo corridor.
      route.roadGeometry = null;
      route.roadBoundaries = null;
    }
  }

  function updateRouteStyles() {
    Object.entries(routeLayers).forEach(([id, layer]) => {
      const selected = selectedBusId && getBus(selectedBusId)?.routeId === id;
      layer.setStyle({
        opacity: routesVisible ? (selected ? 0.98 : (selectedBusId ? 0.42 : 0.64)) : 0,
        weight: selected ? 5.5 : 3.5,
        dashArray: selected ? null : '9 10'
      });
      const outline = routeOutlines[id];
      if (outline) outline.setStyle({ opacity: routesVisible ? (selected ? 0.98 : 0.74) : 0, weight: selected ? 10 : 7 });
    });
  }

  function getFeatureSearchText(item) {
    return `${item.name} ${item.detail || ''} ${item.type || ''}`.toLowerCase();
  }
  function matchesSearch(text) { return !searchTerm || text.toLowerCase().includes(searchTerm); }

  function refreshBusMarkerStyles() {
    buses.forEach(bus => {
      const matches = matchesSearch(`${bus.id} ${bus.name} ${bus.route.name} ${bus.route.description}`);
      bus.marker.setIcon(busDivIcon(bus, bus.id === selectedBusId, !matches));
      bus.marker.setOpacity(matches ? 1 : 0.16);
      bus.marker.setZIndexOffset((bus.id === selectedBusId ? 1200 : 800) + BUS_DATA.findIndex(item => item.id === bus.id));
    });
  }

  function refreshFeatureMarkerStyles() {
    STOPS.forEach(stop => {
      const matches = matchesSearch(getFeatureSearchText(stop));
      stopMarkers[stop.id].setIcon(stopDivIcon(stop, stop.id === selectedFeatureId, !matches));
      stopMarkers[stop.id].setOpacity(matches ? 1 : 0.15);
    });
    PLACES.forEach(place => {
      const matches = matchesSearch(getFeatureSearchText(place));
      placeMarkers[place.id].setIcon(placeDivIcon(place, place.id === selectedFeatureId, !matches));
      placeMarkers[place.id].setOpacity(matches ? 1 : 0.15);
    });
  }

  function renderBusCard(bus) {
    const route = routeForBus(bus);
    const percent = Math.round(bus.occupancy / bus.capacity * 100);
    const crowded = percent >= 75;
    const occupancyColor = crowded ? '#d69a39' : route.color;
    return `<button class="bus-card${bus.id === selectedBusId ? ' selected' : ''}" data-bus-id="${bus.id}" style="--route-color:${route.color};--route-tint:${route.tint}" type="button" aria-pressed="${bus.id === selectedBusId}">
      <div class="bus-card-top"><span class="bus-mini-icon">${iconSvg.bus}</span><div class="bus-card-main"><div class="bus-card-title-row"><span class="bus-card-title">${bus.name}</span></div><div class="bus-card-subtitle">${escapeHtml(route.name)}</div></div><span class="card-chevron"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div>
      <div class="bus-card-bottom"><span class="bus-info-pair">${iconSvg.clock}<span>${escapeHtml(bus.nextFeatureId ? featureById.get(bus.nextFeatureId)?.name || 'Next stop' : 'On route')}</span></span><span class="bus-route-tag">${route.short}</span><span class="bus-info-pair">${iconSvg.users}<span>${bus.occupancy}/${bus.capacity}</span><i class="occupancy-track"><i class="occupancy-fill" style="width:${percent}%;background:${occupancyColor};display:block"></i></i></span></div>
    </button>`;
  }

  function nearestStopTo(location) {
    if (!location) return null;
    let best = null;
    STOPS.forEach(stop => {
      const distance = haversine(location, [stop.lat, stop.lng]);
      if (!best || distance < best.distance) best = { stop, distance };
    });
    return best;
  }

  function distanceLabel(meters) {
    if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  }

  function estimateStopArrivals(stop) {
    return buses.map(bus => ({ bus, meters: haversine(bus.currentLatLng, [stop.lat, stop.lng]) }))
      .sort((a, b) => a.meters - b.meters)
      .slice(0, 1)[0];
  }

  function renderPlaceCard(feature) {
    const isStop = feature.type === 'stop';
    const distance = userLocation ? distanceLabel(haversine(userLocation, [feature.lat, feature.lng])) : null;
    const closestBus = isStop ? estimateStopArrivals(feature) : null;
    const meta = isStop
      ? (closestBus ? `${closestBus.bus.etaMin || 2} min demo ETA · ${closestBus.bus.name}` : 'Mapped boarding point')
      : 'Campus landmark';
    const accuracyBadge = feature.accuracy === 'approximate' ? '<span class="approx-tag">Approx.</span>' : '';
    return `<button class="place-card${feature.id === selectedFeatureId ? ' selected' : ''}" data-feature-id="${feature.id}" type="button" aria-pressed="${feature.id === selectedFeatureId}">
      <span class="place-card-icon${isStop ? ' stop' : ''}">${isStop ? iconSvg.stop : iconSvg.landmark}</span><span class="place-card-main"><span class="place-card-title">${escapeHtml(feature.name)}</span><span class="place-card-desc">${escapeHtml(feature.detail)}</span></span><span class="place-card-tail">${distance ? `<span>${distance} away</span>` : accuracyBadge}<span>${isStop ? 'Bus stop' : 'Landmark'}</span></span>
    </button>`;
  }

  function renderContent() {
    const content = $('#contentList');
    if (currentTab === 'shuttles') {
      const shown = buses.filter(bus => matchesSearch(`${bus.id} ${bus.name} ${bus.route.name} ${bus.route.description}`));
      content.innerHTML = `<div class="list-heading"><h2>Shuttles around campus</h2><span>${shown.length} found</span></div>${shown.length ? shown.map(renderBusCard).join('') : emptyState('No shuttle found', 'Try a shuttle number or route name.')}`;
    } else {
      const combined = [...STOPS, ...PLACES].filter(feature => matchesSearch(getFeatureSearchText(feature)));
      const stops = combined.filter(feature => feature.type === 'stop');
      const places = combined.filter(feature => feature.type === 'landmark');
      content.innerHTML = `<div class="list-heading"><h2>Stops & campus places</h2><span>${combined.length} found</span></div>${stops.length ? `<div class="list-section-label">Boarding stops · ${stops.length}</div>${stops.map(renderPlaceCard).join('')}` : ''}${places.length ? `<div class="list-section-label">Campus landmarks · ${places.length}</div>${places.map(renderPlaceCard).join('')}` : ''}${combined.length ? '' : emptyState('No place found', 'Try “Conti”, “Botanical Garden” or “Brunei”.')}`;
    }
    const busCountText = String(buses.length).padStart(2, '0');
    const stopCountText = String(STOPS.length).padStart(2, '0');
    $('#activeBusCount').textContent = busCountText;
    $('#stopCount').textContent = stopCountText;
    $('#routeCount').textContent = String(Object.keys(ROUTES).length).padStart(2, '0');
    $('#shuttlesTabCount').textContent = busCountText;
    $('#stopsTabCount').textContent = String(STOPS.length + PLACES.length).padStart(2, '0');
  }

  function emptyState(title, description) {
    return `<div class="empty-state">${iconSvg.search}<strong>${escapeHtml(title)}</strong><span>${escapeHtml(description)}</span></div>`;
  }

  function selectBus(id, pan = true) {
    const bus = getBus(id);
    if (!bus) return;
    selectedBusId = id;
    selectedFeatureId = null;
    $('#selectedCard').classList.remove('hidden');
    refreshBusMarkerStyles();
    refreshFeatureMarkerStyles();
    updateRouteStyles();
    renderContent();
    updateSelectedCard();
    if (pan) {
      map.flyTo(bus.currentLatLng || bus.coordinates[0], Math.max(map.getZoom(), 16), { duration: .65 });
      bus.marker.openTooltip();
    }
    if (window.innerWidth <= 820) closeMobilePanel();
  }

  function selectFeature(id, pan = true) {
    const feature = featureById.get(id);
    if (!feature) return;
    selectedFeatureId = id;
    $('#selectedCard').classList.add('hidden');
    refreshFeatureMarkerStyles();
    renderContent();
    if (pan) {
      map.flyTo([feature.lat, feature.lng], Math.max(map.getZoom(), 16), { duration: .6 });
      const marker = stopMarkers[id] || placeMarkers[id];
      if (marker) marker.openPopup();
    }
    if (window.innerWidth <= 820) closeMobilePanel();
  }

  function updateSelectedCard() {
    const bus = activeBus();
    const route = routeForBus(bus);
    const next = featureById.get(bus.nextFeatureId) || STOPS[0];
    const card = $('#selectedCard');
    card.style.setProperty('--selected-color', route.color);
    card.style.setProperty('--selected-tint', route.tint);
    $('#selectedBusName').textContent = bus.name;
    $('#selectedRouteName').textContent = route.name;
    $('#selectedNextStop').textContent = next.name;
    $('#selectedEta').textContent = `${bus.etaMin || 1} min`;
    $('#selectedCapacity').textContent = `${bus.occupancy} / ${bus.capacity}`;
    $('#mapStatus').textContent = `${buses.length} shuttles moving`;
  }

  function setTab(tab) {
    currentTab = tab;
    $('#shuttlesTab').classList.toggle('active', tab === 'shuttles');
    $('#stopsTab').classList.toggle('active', tab === 'stops');
    $('#shuttlesTab').setAttribute('aria-selected', String(tab === 'shuttles'));
    $('#stopsTab').setAttribute('aria-selected', String(tab === 'stops'));
    renderContent();
    if (window.innerWidth <= 820) $('#sidebar').classList.add('mobile-open');
  }

  function showToast(message, duration = 3000) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(toastTimeout);
    toastTimeout = window.setTimeout(() => toast.classList.remove('show'), duration);
  }

  function fitCampus() {
    const bounds = L.latLngBounds([]);
    [...STOPS, ...PLACES].forEach(feature => bounds.extend([feature.lat, feature.lng]));
    const leftPad = window.innerWidth > 1100 ? 390 : (window.innerWidth > 820 ? 350 : 22);
    const rightPad = window.innerWidth > 1100 ? 350 : (window.innerWidth > 820 ? 305 : 25);
    map.fitBounds(bounds.pad(.14), { paddingTopLeft: [leftPad, 112], paddingBottomRight: [rightPad, 112], maxZoom: 15.75, animate: true, duration: .6 });
  }

  function updateSearch() {
    searchTerm = $('#globalSearch').value.trim().toLowerCase();
    renderContent();
    refreshBusMarkerStyles();
    refreshFeatureMarkerStyles();
  }

  function toggleRoutes() {
    routesVisible = !routesVisible;
    Object.entries(routeLayers).forEach(([id, layer]) => {
      const outline = routeOutlines[id];
      if (routesVisible) {
        if (outline) outline.addTo(map);
        layer.addTo(map);
      } else {
        map.removeLayer(layer);
        if (outline) map.removeLayer(outline);
      }
    });
    $('#routeToggle').classList.toggle('is-on', routesVisible);
    $('#routeToggle').setAttribute('aria-pressed', String(routesVisible));
    updateRouteStyles();
    showToast(routesVisible ? 'Indicative campus route corridors shown' : 'Route corridors hidden');
  }

  function toggleBaseLayer() {
    satelliteOn = !satelliteOn;
    if (fallbackActivated) {
      map.getContainer().classList.toggle('satellite-mode', satelliteOn);
      $('#layerToggle').classList.toggle('is-on', satelliteOn);
      $('#layerToggle span').textContent = satelliteOn ? 'Light mode' : 'Dark mode';
      showToast(satelliteOn ? 'Contrast map style enabled' : 'Campus map style restored');
      return;
    }
    if (satelliteOn) {
      map.removeLayer(streetLayer);
      map.removeLayer(streetBackupLayer);
      satelliteLayer.addTo(map);
      $('#layerToggle').classList.add('is-on');
      $('#layerToggle span').textContent = 'Streets';
      showToast('Satellite imagery enabled');
    } else {
      map.removeLayer(satelliteLayer);
      (usingBackupTiles ? streetBackupLayer : streetLayer).addTo(map);
      $('#layerToggle').classList.remove('is-on');
      $('#layerToggle span').textContent = 'Satellite';
      showToast('Street map enabled');
    }
  }

  function updateUserLocation(position, center = false) {
    const hadUserLocation = Boolean(userLocation);
    const { latitude, longitude, accuracy } = position.coords;
    userLocation = [latitude, longitude];
    if (!userMarker) {
      const userIcon = L.divIcon({ className: 'marker-shell user-marker-shell', html: '<div class="user-map-icon"><span></span></div>', iconSize: [34, 34], iconAnchor: [17, 17] });
      userMarker = L.marker(userLocation, { icon: userIcon, title: 'Your current location', zIndexOffset: 1800, keyboard: true }).addTo(map);
      userMarker.bindPopup('<div class="map-popup"><span class="popup-eyebrow">Your location</span><strong>You are here</strong><p>Blue dot shows the location shared by your device.</p></div>', { closeButton: false });
    } else {
      userMarker.setLatLng(userLocation);
    }
    if (!userAccuracyCircle) {
      userAccuracyCircle = L.circle(userLocation, { radius: Math.min(accuracy || 30, 500), weight: 1, color: '#3989f0', opacity: .55, fillColor: '#3989f0', fillOpacity: .08, interactive: false }).addTo(map);
    } else {
      userAccuracyCircle.setLatLng(userLocation).setRadius(Math.min(accuracy || 30, 500));
    }
    const nearest = nearestStopTo(userLocation);
    if (center) map.flyTo(userLocation, Math.max(map.getZoom(), 16), { duration: .65 });
    if (nearest && (center || !hadUserLocation)) showToast(`Location found · nearest mapped stop: ${nearest.stop.name} (${distanceLabel(nearest.distance)})`, 4300);
    if (currentTab === 'stops') renderContent();
    if (followLocation && !center) map.panTo(userLocation, { animate: true, duration: .4 });
  }

  function geolocationError(error) {
    let message = 'Could not get your location.';
    if (error && error.code === 1) message = 'Location permission was denied. Allow location access in your browser to show your position.';
    else if (error && error.code === 2) message = 'Your device could not determine a location. Try again outdoors or check device location settings.';
    else if (error && error.code === 3) message = 'Location request timed out. Please try again.';
    showToast(message, 5000);
  }

  function locateOnce() {
    if (!('geolocation' in navigator)) {
      showToast('This browser does not support location services.', 4200);
      return;
    }
    $('#locateButton').classList.add('active');
    navigator.geolocation.getCurrentPosition(
      position => { $('#locateButton').classList.remove('active'); updateUserLocation(position, true); },
      error => { $('#locateButton').classList.remove('active'); geolocationError(error); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  }

  function toggleFollowLocation() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
      followLocation = false;
      $('#followButton').classList.remove('active');
      $('#followButton').setAttribute('aria-pressed', 'false');
      $('#followButton').title = 'Follow my location';
      showToast('Live location follow paused');
      return;
    }
    if (!('geolocation' in navigator)) {
      showToast('This browser does not support location services.', 4200);
      return;
    }
    followLocation = true;
    $('#followButton').classList.add('active');
    $('#followButton').setAttribute('aria-pressed', 'true');
    $('#followButton').title = 'Stop following my location';
    showToast('Requesting location permission…');
    watchId = navigator.geolocation.watchPosition(
      position => updateUserLocation(position, !userLocation),
      error => {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        watchId = null;
        followLocation = false;
        $('#followButton').classList.remove('active');
        $('#followButton').setAttribute('aria-pressed', 'false');
        geolocationError(error);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  }

  function closeMobilePanel() {
    $('#sidebar').classList.remove('mobile-open');
    window.setTimeout(() => map.invalidateSize({ pan: false }), 280);
  }

  function openMobilePanel() {
    $('#sidebar').classList.add('mobile-open');
    window.setTimeout(() => map.invalidateSize({ pan: false }), 280);
  }

  function updateClock() {
    const time = new Intl.DateTimeFormat('en-GH', { timeZone: 'Africa/Accra', hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
    $('#clockTime').textContent = `${time} · GMT`;
  }


  // Keep a bundled geographic campus schematic ready for tile failures. It
  // normally sits below the map tiles; when tiles fail, it is promoted above
  // the tile pane (but below routes and markers) so 403/error pages can never
  // cover the campus map.
  const fallbackSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  fallbackSvg.setAttribute('class', 'map-fallback-underlay');
  fallbackSvg.setAttribute('aria-hidden', 'true');
  Object.assign(fallbackSvg.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '150', pointerEvents: 'none', display: 'block' });
  map.getContainer().appendChild(fallbackSvg);
  let fallbackTilesActive = true;
  let fallbackActivated = false;
  let fallbackNoticeShown = false;
  function svgPath(points) {
    return points.map((point, index) => {
      const pixel = map.latLngToContainerPoint(point);
      return `${index ? 'L' : 'M'}${pixel.x.toFixed(1)},${pixel.y.toFixed(1)}`;
    }).join(' ');
  }
  function svgRoad(points, major = false) {
    const d = svgPath(points);
    return `<path d="${d}" fill="none" stroke="${major ? '#c9cfc9' : '#d4dbd5'}" stroke-width="${major ? 19 : 12}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${major ? '#fffdf4' : '#ffffff'}" stroke-width="${major ? 14 : 8}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  function renderFallbackSchematic() {
    if (!fallbackTilesActive) return;
    const size = map.getSize();
    fallbackSvg.setAttribute('width', size.x); fallbackSvg.setAttribute('height', size.y);
    fallbackSvg.setAttribute('viewBox', `0 0 ${size.x} ${size.y}`);
    const park = (north, west, south, east, fill) => {
      const points = [[north, west], [north, east], [south, east], [south, west]];
      return `<polygon points="${points.map(point => { const p = map.latLngToContainerPoint(point); return `${p.x},${p.y}`; }).join(' ')}" fill="${fill}"/>`;
    };
    const placeLabel = (id, label, dx = 0, dy = -17) => {
      const f = featureById.get(id); if (!f) return '';
      const p = map.latLngToContainerPoint([f.lat, f.lng]);
      const width = Math.max(48, label.length * 6.2 + 18);
      return `<g transform="translate(${(p.x + dx).toFixed(1)} ${(p.y + dy).toFixed(1)})"><rect x="${-width / 2}" y="-13" width="${width}" height="25" rx="7" fill="#ffffff" fill-opacity=".92" stroke="#d9e3da"/><text x="0" y="3" fill="#405b4d" text-anchor="middle" font-size="10" font-family="Arial,sans-serif" font-weight="700">${escapeHtml(label)}</text></g>`;
    };
    let art = `<rect width="${size.x}" height="${size.y}" fill="#edf2e9"/>`;
    art += park(6.6843, -1.5690, 6.6788, -1.5628, '#d4e8d0');
    art += park(6.6722, -1.5795, 6.6675, -1.5727, '#d7e7cf');
    art += park(6.6845, -1.5800, 6.6815, -1.5753, '#dbe9d3');
    const roads = [
      { ids: ['commercial','great-hall','conti','unity','botanical'], major: true },
      { ids: ['business','pentecost','library','ccb-canteen','ccb','steps','botanical'], major: false },
      { ids: ['gusss','queens','republic','unity','conti'], major: false },
      { ids: ['brunei','business','pentecost','ccb','brunei'], major: false },
      { ids: ['great-hall','republic','queens','gusss'], major: false },
      { ids: ['commercial','botanical','ccb','pentecost'], major: false }
    ];
    roads.forEach(road => {
      const points = road.ids.map(id => featureById.get(id)).filter(Boolean).map(f => [f.lat, f.lng]);
      if (points.length > 1) art += svgRoad(points, road.major);
    });
    // Block-like campus footprints are only a fallback cartographic sketch;
    // markers remain anchored to the real lat/lon points above.
    PLACES.forEach((place, index) => {
      const point = map.latLngToContainerPoint([place.lat, place.lng]);
      const w = index % 2 ? 25 : 31, h = index % 3 ? 18 : 22;
      art += `<rect x="${(point.x - w/2).toFixed(1)}" y="${(point.y - h/2).toFixed(1)}" width="${w}" height="${h}" rx="3" fill="${index === 0 ? '#a9d0a7' : '#e0d9cb'}" stroke="#ffffff" stroke-width="2" opacity=".95"/>`;
    });
    art += placeLabel('unity', 'Unity Hall', 0, -27);
    art += placeLabel('republic', 'Republic Hall', -16, -24);
    art += placeLabel('queens', 'Queen Elizabeth II Hall', 45, 14);
    art += placeLabel('great-hall', 'Old Great Hall', -6, -25);
    art += placeLabel('botanical', 'Botanical Garden', 0, -24);
    art += placeLabel('ccb-canteen', 'CCB Bush Canteen', 18, 24);
    art += placeLabel('gusss', 'GUSSS Sports Complex', 0, 28);
    art += `<g transform="translate(22 ${size.y - 22})"><rect x="0" y="-25" width="248" height="25" rx="7" fill="#18372f" fill-opacity=".9"/><text x="12" y="-9" fill="#ffffff" font-size="10" font-family="Arial,sans-serif" font-weight="700">CAMPUS SCHEMATIC · MAP TILES UNAVAILABLE</text></g>`;
    fallbackSvg.innerHTML = art;
  }
  function activateTileFallback() {
    if (fallbackActivated) return;
    fallbackActivated = true;
    fallbackTilesActive = true;
    // Stop broken tile images from remaining visible behind the schematic.
    [streetLayer, streetBackupLayer, satelliteLayer].forEach(layer => {
      if (map.hasLayer(layer)) map.removeLayer(layer);
    });
    // The SVG is a background sibling beneath Leaflet's route/marker panes.
    fallbackSvg.style.display = 'block';
    map.getContainer().classList.add('offline-map-mode');
    $('#layerToggle span').textContent = 'Dark mode';
    $('.map-attribution-note').textContent = 'Campus schematic · indicative roads and routes';
    renderFallbackSchematic();
    if (!fallbackNoticeShown) {
      fallbackNoticeShown = true;
      showToast('Street map unavailable. Showing the built-in campus map instead.', 5000);
    }
  }
  let tileSuccess = false;
  let streetLoads = 0;
  let streetErrors = 0;
  let backupLoads = 0;
  let backupErrors = 0;
  function noteTileSuccess(source) {
    if (fallbackActivated) return;
    if (source === 'street') streetLoads++;
    else backupLoads++;
    const usable = source === 'street' ? streetLoads >= 4 : backupLoads >= 4;
    if (usable) {
      tileSuccess = true;
      fallbackTilesActive = false;
      fallbackSvg.style.display = 'none';
      map.getContainer().classList.remove('offline-map-mode');
      $('.map-attribution-note').textContent = 'Map data © OpenStreetMap contributors · CARTO';
    }
  }
  function switchToBackupTiles() {
    if (fallbackActivated || tileSuccess || map.hasLayer(streetBackupLayer)) return;
    if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
    usingBackupTiles = true;
    streetBackupLayer.addTo(map);
  }
  streetLayer.on('tileload', () => noteTileSuccess('street'));
  streetLayer.on('tileerror', () => {
    streetErrors++;
    if (!tileSuccess && streetErrors >= 4) switchToBackupTiles();
  });
  streetBackupLayer.on('tileload', () => { usingBackupTiles = true; noteTileSuccess('backup'); });
  streetBackupLayer.on('tileerror', () => {
    backupErrors++;
    usingBackupTiles = true;
    if (!tileSuccess && backupErrors >= 4) activateTileFallback();
  });
  // Never leave a wall of broken tile errors on screen while waiting for a
  // provider. Try the backup briefly, then use the fully bundled schematic.
  window.setTimeout(() => {
    if (tileSuccess || fallbackActivated) return;
    switchToBackupTiles();
    window.setTimeout(() => {
      if (!tileSuccess && !fallbackActivated && backupLoads < 4) activateTileFallback();
    }, 1500);
  }, 2200);
  map.on('move zoom resize', renderFallbackSchematic);
  renderFallbackSchematic();

  // UI events
  $('#shuttlesTab').addEventListener('click', () => setTab('shuttles'));
  $('#stopsTab').addEventListener('click', () => setTab('stops'));
  $('#globalSearch').addEventListener('input', updateSearch);
  $('#globalSearch').addEventListener('keydown', event => {
    if (event.key === 'Escape') { $('#globalSearch').value = ''; updateSearch(); $('#globalSearch').blur(); }
  });
  $('#routeToggle').addEventListener('click', toggleRoutes);
  $('#layerToggle').addEventListener('click', toggleBaseLayer);
  $('#locateButton').addEventListener('click', locateOnce);
  $('#followButton').addEventListener('click', toggleFollowLocation);
  $('#zoomInButton').addEventListener('click', () => map.zoomIn());
  $('#zoomOutButton').addEventListener('click', () => map.zoomOut());
  $('#fitMapButton').addEventListener('click', fitCampus);
  $('#centerSelectedButton').addEventListener('click', () => {
    const bus = activeBus();
    map.flyTo(bus.currentLatLng, Math.max(map.getZoom(), 16.5), { duration: .5 });
    bus.marker.openTooltip();
  });
  $('#selectedClose').addEventListener('click', () => $('#selectedCard').classList.add('hidden'));
  $('#mobilePanelToggle').addEventListener('click', () => {
    if ($('#sidebar').classList.contains('mobile-open')) closeMobilePanel();
    else openMobilePanel();
  });

  $('#contentList').addEventListener('click', event => {
    const busCard = event.target.closest('[data-bus-id]');
    if (busCard) { selectBus(busCard.dataset.busId, true); return; }
    const featureCard = event.target.closest('[data-feature-id]');
    if (featureCard) { selectFeature(featureCard.dataset.featureId, true); }
  });
  document.addEventListener('click', event => {
    const popupButton = event.target.closest('[data-focus-feature]');
    if (popupButton) selectFeature(popupButton.dataset.focusFeature, false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName) && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); $('#globalSearch').focus();
    }
    if (event.key === 'Escape' && window.innerWidth <= 820) closeMobilePanel();
  });
  window.addEventListener('resize', () => map.invalidateSize({ pan: false }));
  window.addEventListener('pagehide', () => { if (watchId !== null) navigator.geolocation.clearWatch(watchId); });

  setupMapFeatures();
  renderContent();
  $('#stopCount').textContent = String(STOPS.length).padStart(2, '0');
  $('#stopsTabCount').textContent = String(STOPS.length + PLACES.length).padStart(2, '0');
  $('#shuttlesTabCount').textContent = String(buses.length).padStart(2, '0');
  updateSelectedCard();
  updateClock();
  window.setInterval(updateClock, 30000);
  window.requestAnimationFrame(animateBuses);
  window.setTimeout(fitCampus, 250);
  ROUTES && Object.values(ROUTES).forEach(route => loadRoadFollowingGeometry(route));

  // A stop popup button and a sidebar card both focus the same feature; no hidden APIs required.
  $('#selectedCard').classList.remove('hidden');
})();
