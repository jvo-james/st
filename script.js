/* KNUST Shuttle client
 * The default vehicle feed is a smooth, local movement model so every interaction
 * can be exercised without GPS hardware. A WebSocket feed can be supplied with
 * ?feed=wss://your-service.example/vehicles and is consumed using the schema in README.md.
 */
(() => {
  'use strict';

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const GEOFENCE_METERS = 30;
  const TELEMETRY_INTERVAL = 3000;
  const CAMPUS_CENTER = [6.6778, -1.5708];
  const COLORS = {
    green: '#168467', blue: '#4778f5', orange: '#ed9347', violet: '#9a6de1',
    available: '#15936a', full: '#d94848'
  };
  // Slim top-down vehicle artwork. Its front points north (0deg), matching compass bearings.
  const busSvg = (status = 'available') => {
    const color = status === 'full' ? '#9b4545' : '#176a51';
    return `<svg viewBox="0 0 36 62" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="6.2" y="1.6" width="23.6" height="58.8" rx="8.1" fill="#fff" stroke="#fff" stroke-width="1.8"/>
      <rect x="8" y="3.2" width="20" height="55.6" rx="6.4" fill="${color}" stroke="#143f32" stroke-width=".8"/>
      <path d="M10.2 10.3c0-2 1.2-3.4 3.2-3.4h9.2c2 0 3.2 1.4 3.2 3.4v8.1H10.2z" fill="#b8d9d0" stroke="#f8fffc" stroke-width="1.2"/>
      <path d="M10.3 22.1h15.4v17.1H10.3z" fill="#e8f0eb" stroke="#f8fffc" stroke-width="1.1"/>
      <path d="M17.95 22.5v16.3" stroke="#a9bdb3" stroke-width="1.1"/>
      <path d="M11.2 42.1h13.6v6.3c0 1.2-.9 2.1-2.1 2.1h-9.4c-1.2 0-2.1-.9-2.1-2.1z" fill="#12392e"/>
      <path d="M5.1 13.2h2.8v8.1H5.1m23 0h2.8v-8.1h-2.8M5.1 41.7h2.8v7.7H5.1m23 0h2.8v-7.7h-2.8" fill="#24362f"/>
      <path d="M12 3.4h4m4 0h4" stroke="#f6fff9" stroke-width="1.4" stroke-linecap="round"/>
      <rect x="10.6" y="53" width="3.6" height="2.4" rx=".7" fill="#eaffb9"/><rect x="22" y="53" width="3.6" height="2.4" rx=".7" fill="#eaffb9"/>
    </svg>`;
  };
  const pinSvg = `<svg viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 36S3.3 22 3.3 14.8a12.7 12.7 0 1 1 25.4 0C28.7 22 16 36 16 36Z" fill="#fff" stroke="#fff" stroke-width="3"/><path d="M16 34S4.9 21.8 4.9 14.8a11.1 11.1 0 1 1 22.2 0C27.1 21.8 16 34 16 34Z" fill="#2879f6"/><circle cx="16" cy="14.5" r="4.8" fill="#fff"/><circle cx="16" cy="14.5" r="2.1" fill="#2879f6"/></svg>`;
  const buildingSvg = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 9 9-5 9 5M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18M2.5 10h19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const searchSvg = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const map = window.L ? L.map('map', {
    zoomControl: false, attributionControl: true, preferCanvas: true,
    zoomSnap: .25, zoomDelta: .5, minZoom: 12, maxZoom: 19,
    zoomAnimation: true, markerZoomAnimation: true, fadeAnimation: true
  }).setView(CAMPUS_CENTER, 15.0) : null;

  const STOPS = [
    { id:'conti', name:'Unity Hall (Conti) Roundabout Stop', short:'Conti Roundabout', lat:6.67920, lng:-1.57083, description:'Main interchange beside Unity Hall and Paa Joe Stadium.' },
    { id:'library', name:'Library / Great Hall Junction Stop', short:'Library / Great Hall Junction', lat:6.68065, lng:-1.57275, description:'Central campus junction serving the Library and Great Hall area.' },
    { id:'science', name:'Science / Engineering Lane Stop', short:'Science / Engineering Lane', lat:6.67231, lng:-1.56841, description:'Checkpoint for the Science and Engineering corridor.' },
    { id:'commercial', name:'KNUST Jubilee Mall / Commercial Area Stop', short:'Commercial Area', lat:6.68280, lng:-1.57691, description:'Commercial-area shuttle bay beside the Jubilee Mall and campus post-office area.' },
    { id:'trinity', name:'Trinity Bus Stop', short:'Trinity', lat:6.67605, lng:-1.56880, description:'Residential and academic connector checkpoint.' },
    { id:'ayeduase', name:'Ayeduase Gate Terminal', short:'Ayeduase Gate', lat:6.67566, lng:-1.56361, description:'Terminal at the Ayeduase Gate entrance.' },
    { id:'kotei', name:'Kotei Bus Stop (AstroTurf)', short:'Kotei AstroTurf', lat:6.66447, lng:-1.55892, description:'Kotei Road pickup within a short walk of the AstroTurf pitch.' },
    { id:'boadi', name:'Boadi Market Stop', short:'Boadi Market', lat:6.67531, lng:-1.54210, description:'Market-side checkpoint east of the main campus.' },
    { id:'brunei', name:'Brunei Complex / New Site Stop', short:'Brunei / New Site', lat:6.67090, lng:-1.57415, description:'New Site pickup serving the Brunei Complex and nearby halls.' },
    { id:'republic', name:'Independence / Republic Hall Stops', short:'Independence / Republic Halls', lat:6.67852, lng:-1.57402, description:'Residence-area checkpoints around Republic and Independence Halls.' }
  ];
  const PLACES = [
    { id:'unityHall', name:'Unity Hall', lat:6.67953, lng:-1.57186, description:'Student residence near Conti Roundabout.' },
    { id:'greatHall', name:'The Old Great Hall', lat:6.68115, lng:-1.57413, description:'Central university landmark.' },
    { id:'jubilee', name:'KNUST Jubilee Mall', lat:6.68254, lng:-1.57566, description:'University shopping and commercial centre.' },
    { id:'republicHall', name:'Republic Hall', lat:6.67852, lng:-1.57402, description:'Student residence near the Royal Parade Ground.' },
    { id:'independenceHall', name:'Independence Hall', lat:6.67642, lng:-1.57228, description:'Student residence in the halls area.' },
    { id:'botanical', name:'KNUST Botanical Garden', lat:6.68150, lng:-1.56570, description:'University botanical garden and green space.' },
    { id:'astro', name:'Kotei AstroTurf', lat:6.66257, lng:-1.56056, description:'Sports pitch near Kotei.' },
    { id:'boadiMarket', name:'Boadi Market', lat:6.67531, lng:-1.54210, description:'Market checkpoint east of campus.' }
  ];
  const STOP_BY_ID = new Map(STOPS.map(s => [s.id, s]));
  const PLACE_BY_ID = new Map(PLACES.map(p => [p.id, p]));
  const ROUTES = {
    ayeduase: { id:'ayeduase', name:'Ayeduase Route', color:COLORS.blue, cycleMs:840000, stopIds:['conti','trinity','science','ayeduase','conti'] },
    kotei: { id:'kotei', name:'Kotei Route', color:COLORS.orange, cycleMs:1320000, stopIds:['library','science','ayeduase','kotei','boadi','kotei','science','conti','library'] },
    halls: { id:'halls', name:'Brunei / Halls Route', color:COLORS.green, cycleMs:960000, stopIds:['brunei','republic','conti','library','trinity','brunei'] },
    academic: { id:'academic', name:'Academic Loop', color:COLORS.violet, cycleMs:780000, stopIds:['conti','library','science','trinity','commercial','library','conti'] }
  };
  const BUSES = [
    { id:'K-01', name:'Shuttle K-01', routeId:'halls', occupancy:8, capacity:18, offset:.10, driver:'Kwame Asare', plate:'AS 2145-24' },
    { id:'K-02', name:'Shuttle K-02', routeId:'ayeduase', occupancy:18, capacity:18, offset:.49, driver:'Abdul Rahman', plate:'AS 6082-23' },
    { id:'K-03', name:'Shuttle K-03', routeId:'kotei', occupancy:12, capacity:20, offset:.72, driver:'Samuel Osei', plate:'AS 9314-24' },
    { id:'K-04', name:'Shuttle K-04', routeId:'academic', occupancy:4, capacity:18, offset:.34, driver:'Nana Boateng', plate:'AS 1207-25' }
  ].map(b => ({ ...b, currentLatLng:null, heading:0, marker:null, trail:null, lastGeoStopIds:new Set(), external:false, telemetryAt:0 }));

  const $toast = $('#toast');
  let toastTimeout = null;
  let streetLayer = null, satelliteLayer = null, fallbackLayer = null;
  let activeMapLayer = 'street';
  let tileErrorCount = 0, tileLoadCount = 0, satelliteTileErrors = 0, satelliteTileLoads = 0, switchedToFallback = false;
  let routeLayers = {}, routeOutlines = {}, routeGeometryReady = false;
  let approachLine = null, approachOutline = null, approachTargetMarker = null;
  let approachCoords = [], approachTarget = null, approachDistanceMeters = null;
  let approachRequestAt = 0, approachRequestStart = null, approachRequestTarget = null;
  let lastApproachPaint = 0;
  let stopMarkers = {}, stopLabelMarkers = {}, placeMarkers = {}, busMarkers = {};
  let fallbackUserNode = null;
  let routeVisibility = false;
  let activeRoute = 'all';
  let trackingBusId = null;
  let lastTrackMapTick = 0;
  let sheetState = 'collapsed';
  let selectedBusId = 'K-01';
  let selectedStopId = null;
  let screenMode = 'home';
  let userLatLng = null, userMarker = null, userAccuracyCircle = null, geolocationWatch = null;
  let followingUser = false;
  let alerts = new Set();
  let alertedPairs = new Set();
  let lastTelemetryUpdate = 0;
  let fallbackProject = null;
  let fallbackSvg = null;
  let fallbackView = { x:0, y:0, w:1100, h:820 };
  let fallbackBusNodes = {};
  let fallbackRouteNodes = {};
  let fallbackDrag = null;
  let lastUiRefresh = 0;
  let externalSocket = null;
  let toastTimer = null;
  let useOSRMGeometry = false;
  let routeMeta = {};
  let lastNearestId = 'conti';

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function showToast(message, duration = 2800) {
    $toast.textContent = message;
    $toast.classList.add('is-visible');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => $toast.classList.remove('is-visible'), duration);
  }
  function haversine(a,b) {
    const rad = n => n * Math.PI / 180;
    const dLat = rad(b[0]-a[0]), dLng = rad(b[1]-a[1]);
    const h = Math.sin(dLat/2)**2 + Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(dLng/2)**2;
    return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function bearing(a,b) {
    const rad = n => n * Math.PI / 180, deg = n => n * 180 / Math.PI;
    const y = Math.sin(rad(b[1]-a[1])) * Math.cos(rad(b[0]));
    const x = Math.cos(rad(a[0])) * Math.sin(rad(b[0])) - Math.sin(rad(a[0])) * Math.cos(rad(b[0])) * Math.cos(rad(b[1]-a[1]));
    return (deg(Math.atan2(y,x)) + 360) % 360;
  }
  function distanceLabel(m) { return m < 1000 ? `${Math.max(10,Math.round(m/10)*10)} m away` : `${(m/1000).toFixed(1)} km away`; }
  function etaLabel(minutes) { return minutes <= 1 ? '1 min' : `${Math.round(minutes)} min`; }
  function routeOf(bus) { return ROUTES[bus.routeId]; }
  function busStatus(bus) { return bus.occupancy >= bus.capacity ? 'full' : 'available'; }
  function freeSeats(bus) { return Math.max(0,bus.capacity-bus.occupancy); }
  function busIconHtml(bus, selected=false) {
    const status=busStatus(bus),rot=Number.isFinite(bus.heading)?bus.heading:0;
    const mins=userLatLng?etaFromBusToUser(bus):nextStopInfo(bus).eta;
    const eta=Number.isFinite(mins)?`${Math.max(1,Math.round(mins))} min`:'—';
    return `<div class="bus-marker${selected?' is-selected':''}" data-bus-marker="${bus.id}" style="--heading:${rot}deg" aria-label="${escapeHtml(bus.name)}, ${status==='full'?'full':`${freeSeats(bus)} seats available`}"><span class="bus-vehicle">${busSvg(status)}</span><span class="bus-label">${eta}</span></div>`;
  }
  function stopIconHtml() { return `<div class="stop-pin-marker">${pinSvg}</div>`; }
  function pointIconHtml(place) { return `<div class="map-point-label">${escapeHtml(place.name)}</div>`; }
  function busDivIcon(bus, selected=false) {
    return L.divIcon({ className:'bus-marker-shell', html:busIconHtml(bus,selected), iconSize:[22,38], iconAnchor:[11,19] });
  }
  function stopDivIcon(size=30) { return L.divIcon({ className:'stop-marker-shell', html:stopIconHtml(), iconSize:[size,size], iconAnchor:[size/2,size-1] }); }
  function stopLabelIcon(stop) { return L.divIcon({className:'stop-label-marker-shell',html:`<div class="stop-name-label">${escapeHtml(stop.short)}</div>`,iconSize:[145,20],iconAnchor:[0,10]}); }
  function placeDivIcon(place) { return L.divIcon({ className:'stop-label-marker', html:pointIconHtml(place), iconSize:[140,22], iconAnchor:[0,0] }); }

  function startMap() {
    if (!map) return;
    streetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains:'abcd', maxZoom:19, maxNativeZoom:19, keepBuffer:3, updateWhenIdle:true, updateWhenZooming:false,
      attribution:'&copy; OpenStreetMap contributors &copy; CARTO'
    });
    streetLayer.on('tileerror', () => {
      tileErrorCount++;
      if (((tileErrorCount >= 7 && tileLoadCount === 0) || (tileErrorCount >= 15 && tileErrorCount/(tileErrorCount+tileLoadCount) > .7)) && !switchedToFallback) activateMapFallback();
    });
    streetLayer.on('tileload', () => { tileLoadCount++; });
    streetLayer.addTo(map);
    satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom:19, attribution:'Imagery &copy; Esri and its data providers'
    });
    satelliteLayer.on('tileload', () => { satelliteTileLoads++; });
    satelliteLayer.on('tileerror', () => {
      satelliteTileErrors++;
      if (activeMapLayer === 'satellite' && satelliteTileErrors >= 7 && satelliteTileLoads === 0) activateMapFallback();
    });
    map.setView(CAMPUS_CENTER, 15.0);
    setTimeout(() => { if (!tileLoadCount && tileErrorCount > 1 && !switchedToFallback) activateMapFallback(); }, 6500);
    map.on('zoomend', updatePlaceLabels);
  }
  function activateMapFallback() {
    if (!map) return;
    if (switchedToFallback && fallbackLayer && map.hasLayer(fallbackLayer)) return;
    switchedToFallback = true;
    if (activeMapLayer === 'satellite') {
      activeMapLayer = 'street';
      if($('#mapStyleToggle')){$('#mapStyleToggle').setAttribute('aria-pressed','false');$('#mapStyleToggle').querySelector('span').textContent='Satellite';}
      if($('#mapAttribution'))$('#mapAttribution').innerHTML='Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · &copy; <a href="https://carto.com/attributions/" target="_blank" rel="noopener">CARTO</a>';
    }
    if (streetLayer && map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
    if (satelliteLayer && map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
    fallbackLayer = L.imageOverlay('campus-fallback.svg', [[6.694,-1.583],[6.655,-1.535]], {opacity:1, interactive:false, alt:'Stylised KNUST campus street map'}).addTo(map);
    $('#mapActivity').textContent = 'Campus map';
    if($('#mapAttribution'))$('#mapAttribution').innerHTML='Campus schematic · checkpoint locations based on mapped features';
    showToast('Showing the campus map', 3000);
  }
  function removeMapFallback() {
    if (!map || !fallbackLayer) return;
    map.removeLayer(fallbackLayer); fallbackLayer = null; switchedToFallback = false;
    if (activeMapLayer === 'street' && streetLayer && !map.hasLayer(streetLayer)) streetLayer.addTo(map);
  }
  function switchMapStyle() {
    if (!map) { showToast('Satellite imagery needs an internet connection.'); return; }
    if (activeMapLayer === 'street') {
      activeMapLayer = 'satellite';
      if (map.hasLayer(streetLayer)) map.removeLayer(streetLayer);
      if (fallbackLayer && map.hasLayer(fallbackLayer)) map.removeLayer(fallbackLayer);
      if (map.hasLayer(satelliteLayer) === false) satelliteLayer.addTo(map);
      if($('#mapStyleToggle')){$('#mapStyleToggle').setAttribute('aria-pressed','true');$('#mapStyleToggle').querySelector('span').textContent='Street map';}
      if($('#mapAttribution'))$('#mapAttribution').innerHTML='Imagery &copy; <a href="https://www.esri.com/en-us/legal/terms/full-master-agreement" target="_blank" rel="noopener">Esri and its data providers</a>';
    } else {
      activeMapLayer = 'street';
      if (map.hasLayer(satelliteLayer)) map.removeLayer(satelliteLayer);
      if (switchedToFallback) {
        fallbackLayer = L.imageOverlay('campus-fallback.svg', [[6.694,-1.583],[6.655,-1.535]], {opacity:1, interactive:false}).addTo(map);
      } else if (!map.hasLayer(streetLayer)) streetLayer.addTo(map);
      if($('#mapAttribution'))$('#mapAttribution').innerHTML=switchedToFallback?'Campus schematic · checkpoint locations based on mapped features':'Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> · &copy; <a href="https://carto.com/attributions/" target="_blank" rel="noopener">CARTO</a>';
      if($('#mapStyleToggle')){$('#mapStyleToggle').setAttribute('aria-pressed','false');$('#mapStyleToggle').querySelector('span').textContent='Satellite';}
    }
  }

  function routeWaypoints(route) { return route.stopIds.map(id => { const s=STOP_BY_ID.get(id); return [s.lat,s.lng]; }); }
  function cumulativeGeometry(coords) {
    const cumulative=[0]; let total=0;
    for(let i=1;i<coords.length;i++){total+=haversine(coords[i-1],coords[i]); cumulative.push(total);}
    return { cumulative,total };
  }
  function closestRouteOffset(route, stopId, startIndex=0) {
    const stop=STOP_BY_ID.get(stopId), coords=route.geometry; let best=Infinity,bestIndex=startIndex;
    for(let i=startIndex;i<coords.length;i++){
      const d=haversine(coords[i],[stop.lat,stop.lng]);
      if(d<best){best=d;bestIndex=i;}
      // Once the route has already passed the closest point by a good margin, don't scan too far.
      if(i>bestIndex+100 && best<16) break;
    }
    return { index:bestIndex, distance:best, meters:route.cumulative[bestIndex] || 0 };
  }
  function buildRouteMeta(route) {
    const geometry=cumulativeGeometry(route.geometry);
    route.cumulative=geometry.cumulative; route.totalMeters=geometry.total;
    route.nodes=[]; let lastIndex=0;
    route.stopIds.forEach((id, i) => {
      let nearest;
      if(i===0) nearest={index:0,meters:0,distance:0};
      else nearest=closestRouteOffset(route,id,Math.max(0,lastIndex));
      lastIndex=nearest.index;
      route.nodes.push({ id, meters:nearest.meters, index:nearest.index, snapDistance:nearest.distance });
    });
    // Unique checkpoints used for alerts/timelines, retaining their natural route sequence.
    route.stopOrder=[];
    route.stopIds.forEach(id => { if(route.stopOrder[route.stopOrder.length-1]!==id) route.stopOrder.push(id); });
    if(route.stopOrder.length>1 && route.stopOrder[0]===route.stopOrder[route.stopOrder.length-1]) route.stopOrder.pop();
    routeGeometryReady=true;
  }
  async function loadRoadGeometry() {
    const entries=Object.values(ROUTES);
    await Promise.all(entries.map(async route => {
      const pts=routeWaypoints(route).map(([lat,lng])=>`${lng},${lat}`).join(';');
      const url=`https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson&steps=false&continue_straight=true`;
      try {
        const response=await fetch(url,{mode:'cors',cache:'no-store'});
        if(!response.ok) throw new Error('Routing service unavailable');
        const data=await response.json();
        if(data.code!=='Ok'||!data.routes?.[0]?.geometry?.coordinates?.length) throw new Error('No road geometry');
        route.geometry=data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);
        route.roadGeometry=true; useOSRMGeometry=true;
      } catch(e) {
        route.geometry=routeWaypoints(route);
        route.roadGeometry=false;
      }
      buildRouteMeta(route);
    }));
    drawRouteLayers();
    BUSES.forEach(bus => { if(bus.marker) updateBusPosition(bus, performance.now(), true); });
    if(trackingBusId){const tracked=BUSES.find(bus=>bus.id===trackingBusId);if(tracked)updateApproachRoute(tracked,true);}
    if(activeRoute!=='all') focusRoute(activeRoute,false);
  }
  function drawRouteLayers() {
    if(!map) return;
    Object.values(routeLayers).forEach(layer=>map.removeLayer(layer));
    Object.values(routeOutlines).forEach(layer=>map.removeLayer(layer));
    routeLayers={}; routeOutlines={};
    Object.values(ROUTES).forEach(route => {
      routeOutlines[route.id]=L.polyline(route.geometry,{color:'#ffffff',weight:9,opacity:0,interactive:false,lineCap:'round',lineJoin:'round',className:`route-outline route-outline-${route.id}`}).addTo(map);
      routeLayers[route.id]=L.polyline(route.geometry,{color:route.color,weight:4,opacity:0,interactive:false,lineCap:'round',lineJoin:'round',className:`route-line route-${route.id}`}).addTo(map);
      styleRoute(route.id);
    });
  }
  function styleRoute(routeId) {
    const route=ROUTES[routeId];
    const tracked=trackingBusId ? BUSES.find(bus=>bus.id===trackingBusId) : null;
    const visible=!!tracked && tracked.routeId===routeId;
    if(routeLayers[routeId]) routeLayers[routeId].setStyle({opacity:visible?.18:0,weight:visible?4:0,dashArray:null});
    if(routeOutlines[routeId]) routeOutlines[routeId].setStyle({opacity:visible?.50:0,weight:visible?8:0});
  }
  function renderRouteVisibility() {
    Object.keys(ROUTES).forEach(styleRoute);
    if(!map) updateFallbackRouteStyles();
  }
  function updateFallbackRouteStyles() {
    Object.values(ROUTES).forEach(route=>{
      const pair=fallbackRouteNodes[route.id];if(!pair)return;
      const tracked=trackingBusId ? BUSES.find(bus=>bus.id===trackingBusId) : null;
      const visible=!!tracked && tracked.routeId===route.id;
      pair.outline.setAttribute('opacity',visible?'0.96':'0');
      pair.line.setAttribute('opacity',visible?'0.92':'0');
      pair.line.setAttribute('stroke-width',visible?'5':'0');
    });
  }

  function addMapMarkers() {
    if(!map) { initLocalFallback(); return; }
    // Boarding checkpoints stay in routing/ETA calculations, but their pins are intentionally not drawn.
    STOPS.forEach(stop => { /* kept as geographic data, not a visual marker */ });
    PLACES.forEach(place=>{
      const marker=L.marker([place.lat,place.lng],{icon:placeDivIcon(place),keyboard:false,interactive:false,zIndexOffset:50,opacity:0});
      marker.addTo(map); placeMarkers[place.id]=marker;
    });
    BUSES.forEach(bus=>{
      bus.currentLatLng=routePositionAt(routeOf(bus),routeOf(bus).totalMeters*(bus.offset||0));
      bus.marker=L.marker([bus.currentLatLng.lat,bus.currentLatLng.lng],{icon:busDivIcon(bus,bus.id===selectedBusId),keyboard:true,title:`${bus.name} · ${busStatus(bus)==='full'?'Full':'Seats available'}`,zIndexOffset:bus.id===selectedBusId?1500:1000,riseOnHover:true});
      bus.marker.on('click',()=>openBusDetail(bus.id)); bus.marker.addTo(map); busMarkers[bus.id]=bus.marker;
    });
    userAccuracyCircle=L.circle(CAMPUS_CENTER,{radius:10,color:'#2879f6',weight:1,opacity:0,fillOpacity:0,interactive:false}).addTo(map);
    userMarker=L.marker(CAMPUS_CENTER,{icon:L.divIcon({className:'user-location-shell',html:'<div class="user-location-marker"><span></span></div>',iconSize:[26,26],iconAnchor:[13,13]}),opacity:0,interactive:false,zIndexOffset:1800}).addTo(map);
    updatePlaceLabels();
    renderRouteVisibility();
  }
  function updatePlaceLabels() {
    if(!map) return;
    const zoom=map.getZoom();
    Object.entries(placeMarkers).forEach(([id,marker])=>{
      marker.setOpacity(zoom >= 14.7 ? 1 : 0);
      const el=marker.getElement(); if(el) el.style.pointerEvents='none';
    });
  }
  function routePositionAt(route, meters) {
    if(!route || !route.geometry?.length) return {lat:CAMPUS_CENTER[0],lng:CAMPUS_CENTER[1],heading:0,meters:0};
    const total=route.totalMeters||cumulativeGeometry(route.geometry).total;
    if(total<=0) return {lat:route.geometry[0][0],lng:route.geometry[0][1],heading:0,meters:0};
    const cum=route.cumulative || cumulativeGeometry(route.geometry).cumulative;
    const rawAt = distance => {
      distance=((distance%total)+total)%total;
      let lo=0,hi=cum.length-1;
      while(lo<hi){const mid=Math.floor((lo+hi)/2);if(cum[mid]<distance)lo=mid+1;else hi=mid;}
      const i=Math.max(1,lo),d0=cum[i-1],d1=cum[i],t=d1===d0?0:(distance-d0)/(d1-d0);
      const a=route.geometry[i-1],b=route.geometry[i];
      return {lat:a[0]+(b[0]-a[0])*t,lng:a[1]+(b[1]-a[1])*t};
    };
    const normalized=((meters%total)+total)%total, pos=rawAt(normalized);
    // Look a little behind and ahead so the bus eases through route corners instead of snapping.
    const before=rawAt(normalized-7),after=rawAt(normalized+17);
    return { ...pos, heading:bearing([before.lat,before.lng],[after.lat,after.lng]), meters:normalized };
  }
  function interpolateHeading(from,to,t) {
    const delta=((to-from+540)%360)-180;
    return ((from+delta*t)%360+360)%360;
  }
  function interpolateLatLng(from,to,t) {
    return {lat:from[0]+(to[0]-from[0])*t,lng:from[1]+(to[1]-from[1])*t};
  }
  function routeSliceForward(route,startMeters,deltaMeters) {
    if(!route?.geometry?.length)return [];
    const total=route.totalMeters||cumulativeGeometry(route.geometry).total;
    const cumulative=route.cumulative||cumulativeGeometry(route.geometry).cumulative;
    const end=startMeters+Math.max(0,deltaMeters);
    const coords=[],start=routePositionAt(route,startMeters),finish=routePositionAt(route,end);
    coords.push([start.lat,start.lng]);
    for(let lap=0;lap<=1;lap++){
      for(let i=1;i<route.geometry.length;i++){
        const d=(cumulative[i]||0)+lap*total;
        if(d>startMeters+1 && d<end-1) coords.push(route.geometry[i]);
      }
    }
    const last=coords[coords.length-1];
    if(!last||Math.abs(last[0]-finish.lat)>1e-7||Math.abs(last[1]-finish.lng)>1e-7)coords.push([finish.lat,finish.lng]);
    return coords;
  }
  function pickupTargetFor(bus) {
    if(userLatLng) return {lat:userLatLng.lat,lng:userLatLng.lng,name:'Your current location',kind:'YOUR PICKUP POINT',source:'user'};
    const next=nextStopInfo(bus);
    const stop=next?.stop || STOP_BY_ID.get(routeOf(bus).stopIds[0]);
    return {lat:stop.lat,lng:stop.lng,name:stop.short,kind:'NEXT CHECKPOINT',source:'stop',stopId:stop.id};
  }
  function ensureApproachLayers() {
    if(!map)return;
    if(!approachOutline)approachOutline=L.polyline([],{color:'#ffffff',weight:10,opacity:.98,interactive:false,lineCap:'round',lineJoin:'round',className:'approach-route-outline'}).addTo(map);
    if(!approachLine)approachLine=L.polyline([],{color:'#20b982',weight:5.5,opacity:1,interactive:false,lineCap:'round',lineJoin:'round',className:'approach-route-line'}).addTo(map);
  }
  function clearApproachRoute() {
    if(map){if(approachLine)map.removeLayer(approachLine);if(approachOutline)map.removeLayer(approachOutline);if(approachTargetMarker)map.removeLayer(approachTargetMarker);}
    approachLine=null;approachOutline=null;approachTargetMarker=null;approachCoords=[];approachTarget=null;approachDistanceMeters=null;approachRequestAt=0;approachRequestStart=null;approachRequestTarget=null;
  }
  function paintApproachStart(bus,pos,now=performance.now()) {
    if(!map||trackingBusId!==bus.id||!approachCoords?.length||now-lastApproachPaint<100)return;
    lastApproachPaint=now;
    approachCoords[0]=[pos.lat,pos.lng];
    if(approachLine)approachLine.setLatLngs(approachCoords);
    if(approachOutline)approachOutline.setLatLngs(approachCoords);
  }
  function setApproachGeometry(coords,target,distanceMeters) {
    if(!map||!coords?.length)return;
    ensureApproachLayers();
    approachCoords=coords.filter(pair=>Array.isArray(pair)&&Number.isFinite(pair[0])&&Number.isFinite(pair[1]));
    approachTarget=target;
    approachDistanceMeters=Number.isFinite(distanceMeters)?distanceMeters:null;
    approachOutline.setLatLngs(approachCoords);approachLine.setLatLngs(approachCoords);
    if(target?.source==='stop'){
      if(!approachTargetMarker)approachTargetMarker=L.circleMarker([target.lat,target.lng],{radius:6,color:'#ffffff',weight:3,fillColor:'#176a51',fillOpacity:1,interactive:false,className:'pickup-target-marker'}).addTo(map);
      else approachTargetMarker.setLatLng([target.lat,target.lng]);
    }else if(approachTargetMarker){map.removeLayer(approachTargetMarker);approachTargetMarker=null;}
    const bus=BUSES.find(item=>item.id===trackingBusId);
    if(bus){
      const fallbackEta=etaFromBusToUser(bus);
      const minutes=Number.isFinite(approachDistanceMeters)?Math.max(1,Math.ceil(approachDistanceMeters/250)):(fallbackEta??Math.max(1,Math.round(nextStopInfo(bus).eta)));
      const etaText=`${minutes} min away`;
      const etaEl=$('#heroEta');if(etaEl)etaEl.textContent=etaText;
      const toYou=$('#busEtaToYou');if(toYou)toYou.textContent=etaText;
    }
  }
  async function updateApproachRoute(bus,force=false) {
    if(!bus||trackingBusId!==bus.id)return;
    const target=pickupTargetFor(bus),p=bus.currentLatLng||currentBusPosition(bus),now=performance.now();
    if($('#pickupKind'))$('#pickupKind').textContent=target.kind;
    if($('#pickupTargetName'))$('#pickupTargetName').textContent=target.name;
    if($('#pickupTargetHelp'))$('#pickupTargetHelp').textContent=target.source==='user'?'Route and ETA update as your shuttle moves':'Using the next checkpoint as a pickup target';
    if($('#heroRouteLabel'))$('#heroRouteLabel').textContent=`${bus.name} · ${routeOf(bus).name}`;
    if(!map){
      const next=nextStopInfo(bus),route=routeOf(bus),start=bus.external&&Number.isFinite(bus.distance)?bus.distance:busDistance(bus,now);
      approachCoords=routeSliceForward(route,start,next.distance||0);approachDistanceMeters=next.distance||null;return;
    }
    // With no GPS permission, draw the actual segment of this shuttle's mapped route to its next checkpoint.
    if(target.source==='stop'){
      const next=nextStopInfo(bus),route=routeOf(bus),start=bus.external&&Number.isFinite(bus.distance)?bus.distance:busDistance(bus,now);
      const coords=routeSliceForward(route,start,next.distance||0);
      setApproachGeometry(coords,target,next.distance||haversine([p.lat,p.lng],[target.lat,target.lng])*1.25);
      approachRequestAt=now;
      return;
    }
    const previousTarget=approachRequestTarget;
    const movedTarget=!previousTarget||haversine(previousTarget,[target.lat,target.lng])>55;
    const movedBus=!approachRequestStart||haversine(approachRequestStart,[p.lat,p.lng])>55;
    const shouldFetch=force||!approachCoords.length||movedTarget||(movedBus&&now-approachRequestAt>12000);
    if(!shouldFetch){if(approachTargetMarker){approachTargetMarker.setLatLng([target.lat,target.lng]);}return;}
    approachRequestAt=now;approachRequestStart=[p.lat,p.lng];approachRequestTarget=[target.lat,target.lng];
    const route=routeOf(bus),start=bus.external&&Number.isFinite(bus.distance)?bus.distance:busDistance(bus,now),next=nextStopInfo(bus);
    const fallback=()=>{
      const coords=routeSliceForward(route,start,next.distance||0);
      const last=coords[coords.length-1];
      if(last&&haversine(last,[target.lat,target.lng])>2)coords.push([target.lat,target.lng]);
      const distance=(next.distance||haversine([p.lat,p.lng],last||[target.lat,target.lng]))+haversine(last||[target.lat,target.lng],[target.lat,target.lng]);
      setApproachGeometry(coords.length>1?coords:[[p.lat,p.lng],[target.lat,target.lng]],target,distance*1.15);
    };
    try{
      const url=`https://router.project-osrm.org/route/v1/driving/${p.lng},${p.lat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=false`;
      const response=await fetch(url,{mode:'cors',cache:'no-store',signal:AbortSignal.timeout?AbortSignal.timeout(8000):undefined});
      if(!response.ok)throw new Error('Route service unavailable');
      const data=await response.json();
      if(data.code!=='Ok'||!data.routes?.[0]?.geometry?.coordinates?.length)throw new Error('No route geometry');
      // Ignore a late response for a vehicle which is no longer selected.
      if(trackingBusId!==bus.id)return;
      const coords=data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]);
      setApproachGeometry(coords,target,Number(data.routes[0].distance)||haversine([p.lat,p.lng],[target.lat,target.lng])*1.3);
    }catch(e){if(trackingBusId===bus.id)fallback();}
  }

  function busDistance(bus, now=performance.now()) {
    const route=routeOf(bus), elapsed=(now-(bus.startedAt ??= now));
    return (((elapsed+bus.offset*route.cycleMs)%route.cycleMs)/route.cycleMs)*(route.totalMeters||1);
  }
  function projectRouteMeters(route, latlng) {
    const coords=route.geometry||[];const cum=route.cumulative||[];let best=Infinity,at=0;
    for(let i=0;i<coords.length;i++){
      const d=haversine(coords[i],latlng);
      if(d<best){best=d;at=cum[i]||0;}
    }
    return at;
  }
  function currentBusPosition(bus, now=performance.now()) {
    if(bus.external && bus.externalLatLng) {
      const from=bus.externalFrom||bus.externalLatLng,to=bus.externalLatLng;
      const duration=Math.max(900,Math.min(5000,bus.externalDuration||3000));
      const t=bus.externalStart?Math.max(0,Math.min(1,(now-bus.externalStart)/duration)):1;
      const point=interpolateLatLng(from,to,t);
      const targetHeading=Number.isFinite(bus.externalTargetHeading)?bus.externalTargetHeading:(bus.heading||0);
      const heading=interpolateHeading(Number.isFinite(bus.externalFromHeading)?bus.externalFromHeading:(bus.heading||0),targetHeading,t);
      return {...point,heading,meters:projectRouteMeters(routeOf(bus),[point.lat,point.lng])};
    }
    const route=routeOf(bus); return routePositionAt(route,busDistance(bus,now));
  }
  function updateBusPosition(bus, now=performance.now(), force=false) {
    const pos=currentBusPosition(bus,now);
    bus.currentLatLng={lat:pos.lat,lng:pos.lng}; bus.heading=pos.heading;
    if(!bus.marker){
      if(!map && fallbackProject){const node=fallbackBusNodes[bus.id];if(node){const [x,y]=fallbackProject(pos.lat,pos.lng);node.setAttribute('transform',`translate(${x} ${y}) rotate(${pos.heading}) scale(.55)`);node.setAttribute('opacity',!trackingBusId||bus.id===trackingBusId?'1':'0');node.style.pointerEvents=!trackingBusId||bus.id===trackingBusId?'auto':'none';}}
      return;
    }
    bus.marker.setLatLng([pos.lat,pos.lng]);
    const selected=bus.id===selectedBusId, status=busStatus(bus);
    if(bus.renderedStatus!==status || bus.renderedSelected!==selected || force){
      bus.marker.setIcon(busDivIcon(bus,selected));bus.renderedStatus=status;bus.renderedSelected=selected;
      bus.marker.setZIndexOffset(selected?1800:1000);
    }
    const el=bus.marker.getElement();
    if(el){const inner=el.querySelector('.bus-marker');if(inner){inner.style.setProperty('--heading',`${pos.heading}deg`);inner.classList.toggle('is-selected',selected);const label=inner.querySelector('.bus-label');if(label){const mins=userLatLng?etaFromBusToUser(bus):nextStopInfo(bus,now).eta;label.textContent=Number.isFinite(mins)?`${Math.max(1,Math.round(mins))} min`:'—';}}}
    if(trackingBusId===bus.id) paintApproachStart(bus,pos,now);
    const shown=!trackingBusId||bus.id===trackingBusId;
    bus.marker.setOpacity(shown?1:0);
    if(el) el.style.pointerEvents=shown?'auto':'none';
    if(force) bus.marker.update();
  }
  function nextStopInfo(bus, now=performance.now()) {
    const route=routeOf(bus), distance=bus.external && Number.isFinite(bus.distance) ? bus.distance : busDistance(bus,now);
    const nodes=route.nodes||[];
    if(!nodes.length) return {stop:STOP_BY_ID.get(route.stopOrder?.[0]||route.stopIds[0]),eta:4,distance:0,index:0};
    const total=route.totalMeters||1;
    let candidate=null, candidateDelta=Infinity;
    nodes.forEach((node,i)=>{
      if(i===nodes.length-1 && node.id===nodes[0].id) return;
      let delta=(node.meters-distance+total)%total;
      if(delta<16) delta=total;
      if(delta<candidateDelta){candidateDelta=delta;candidate={...node,index:i};}
    });
    const speed=total/(route.cycleMs/3600000); // metres/hour
    const mins=speed>0?candidateDelta/speed*60:4;
    return {stop:STOP_BY_ID.get(candidate.id),eta:Math.max(.5,mins),distance:candidateDelta,index:candidate.index,node:candidate};
  }
  function etaToStop(bus, stopId, now=performance.now()) {
    const route=routeOf(bus), stop=STOP_BY_ID.get(stopId);
    if(!stop) return Infinity;
    const nodes=route.nodes||[];
    const targetIndices=nodes.map((n,i)=>n.id===stopId?i:-1).filter(i=>i>=0);
    if(!targetIndices.length) return Infinity;
    const total=route.totalMeters||1;
    const curr=bus.external && Number.isFinite(bus.distance) ? bus.distance : busDistance(bus,now);
    let delta=Infinity;
    targetIndices.forEach(i=>{let d=(nodes[i].meters-curr+total)%total;if(d<16)d=total;delta=Math.min(delta,d);});
    const metersPerHour=total/(route.cycleMs/3600000);
    return metersPerHour>0?Math.max(.4,delta/metersPerHour*60):Infinity;
  }
  function nextStopsFor(bus,count=5,now=performance.now()) {
    const route=routeOf(bus), nodes=route.nodes||[];
    if(nodes.length<2)return [];
    const total=route.totalMeters||1, curr=bus.external && Number.isFinite(bus.distance)?bus.distance:busDistance(bus,now);
    const actual=nodes.filter((n,i)=>!(i===nodes.length-1&&n.id===nodes[0].id));
    const list=actual.map((node,index)=>({node,index,delta:(node.meters-curr+total)%total})).filter(x=>x.delta>5).sort((a,b)=>a.delta-b.delta);
    const uniq=[];const seenDistance=new Set();
    for(const x of list){const key=`${x.node.id}-${Math.round(x.delta/10)}`;if(seenDistance.has(key))continue;seenDistance.add(key);if(uniq.length<count)uniq.push(x);}
    if(uniq.length<count){actual.forEach((node,index)=>{if(uniq.length<count)uniq.push({node,index,delta:total/actual.length*(uniq.length+1)});});}
    const metersPerHour=total/(route.cycleMs/3600000);
    return uniq.slice(0,count).map((x,i)=>({stop:STOP_BY_ID.get(x.node.id),eta:Math.max(.5,x.delta/(metersPerHour||1)*60),meters:x.delta,index:x.index,isNext:i===0})).filter(x=>x.stop);
  }

  function renderHomeBusList() {
    const list=$('#homeBusList');
    const ordered=[...BUSES].sort((a,b)=>{
      const ta=etaToStop(a,nearestStop()?.id),tb=etaToStop(b,nearestStop()?.id);
      return ta-tb;
    });
    list.innerHTML=ordered.map(bus=>{
      const route=routeOf(bus),next=nextStopInfo(bus),eta=etaToStop(bus,nearestStop()?.id);
      return `<button class="home-bus-card" type="button" data-open-bus="${bus.id}">
        <span class="mini-bus-icon">${busSvg(busStatus(bus))}</span><span class="home-bus-main"><strong>${escapeHtml(bus.name)}</strong><span>${escapeHtml(route.name)} · ${busStatus(bus)==='full'?'Full':'Seats available'}</span></span><span class="home-bus-eta"><strong>${Number.isFinite(eta)?etaLabel(eta):etaLabel(next.eta)}</strong><span>${Number.isFinite(eta)?'to your stop':'next stop'}</span></span>
      </button>`;
    }).join('');
    list.querySelectorAll('[data-open-bus]').forEach(btn=>btn.addEventListener('click',()=>openBusDetail(btn.dataset.openBus)));
    $('#mapActivity').textContent=`${BUSES.length} shuttles on the map`;
    if($('#shuttleCountSummary')) $('#shuttleCountSummary').textContent=`${BUSES.length} shuttles on the map`;
    if($('#seatCountSummary')) $('#seatCountSummary').textContent=`${BUSES.filter(b=>busStatus(b)!=='full').length} with seats`;
  }
  function renderQuickCheckpoints() {
    $('#quickCheckpoints').innerHTML=STOPS.map(stop=>`<button type="button" class="quick-checkpoint" data-open-stop="${stop.id}">${escapeHtml(stop.short)}</button>`).join('');
    $$('#quickCheckpoints [data-open-stop]').forEach(btn=>btn.addEventListener('click',()=>openStopDetail(btn.dataset.openStop)));
  }
  function nearestStop() { return STOP_BY_ID.get(lastNearestId)||STOP_BY_ID.get('conti'); }
  function findNearestStop() {
    const from=userLatLng?[userLatLng.lat,userLatLng.lng]:CAMPUS_CENTER;
    let nearest=STOPS[0],dist=Infinity;
    STOPS.forEach(stop=>{const d=haversine(from,[stop.lat,stop.lng]);if(d<dist){dist=d;nearest=stop;}});
    lastNearestId=nearest.id;
    if($('#shuttleCountSummary')) $('#shuttleCountSummary').textContent=`${BUSES.length} shuttles on the map`;
    if($('#seatCountSummary')) $('#seatCountSummary').textContent=`${BUSES.filter(b=>busStatus(b)!=='full').length} with seats`;
    $('#nearestStopName').textContent=nearest.short;
    $('#nearestDistance').textContent=userLatLng?distanceLabel(dist):'Campus centre · enable location for a closer match';
    const candidates=BUSES.map(bus=>({bus,eta:etaToStop(bus,nearest.id)})).filter(x=>Number.isFinite(x.eta)).sort((a,b)=>a.eta-b.eta);
    const next=candidates[0];
    if(next){
      $('#nearestEta').textContent=String(Math.max(1,Math.round(next.eta)));
      $('#nearestMessage').textContent=`Next shuttle arriving at ${nearest.short} in ${Math.max(1,Math.round(next.eta))} min.`;
      $('#nearestRouteSwatch').style.background=routeOf(next.bus).color;
      $('#nearestBell').classList.toggle('is-active',alerts.has(nearest.id));
      $('#nearestBell').setAttribute('aria-label',alerts.has(nearest.id)?'Turn off checkpoint alert':'Notify me about this checkpoint');
    } else {
      $('#nearestEta').textContent='—';$('#nearestMessage').textContent=`Check the route list for the next shuttle at ${nearest.short}.`;
    }
    renderHomeBusList();
  }

  function setActiveRoute(routeId, fit=true) {
    if(routeId!=='all'&&!ROUTES[routeId]) return;
    activeRoute=routeId;
    $$('#routeChips [data-route]').forEach(btn=>{
      const active=btn.dataset.route===routeId;btn.classList.toggle('is-active',active);btn.setAttribute('aria-pressed',String(active));
    });
    renderRouteVisibility();
    BUSES.forEach(bus=>updateBusPosition(bus,performance.now()));
    if(fit) focusRoute(routeId,true);
  }
  function focusRoute(routeId,animate=true) {
    if(!map){
      if(!fallbackSvg)return;
      const latlngs=routeId==='all'?STOPS.map(s=>[s.lat,s.lng]):(ROUTES[routeId]?.geometry||routeWaypoints(ROUTES[routeId]||ROUTES.ayeduase));
      fitFallbackToPoints(latlngs);
      return;
    }
    if(routeId==='all'){
      const pts=STOPS.map(s=>[s.lat,s.lng]);const bounds=L.latLngBounds(pts);
      map.fitBounds(bounds,{paddingTopLeft:[25,64],paddingBottomRight:[35,window.innerWidth<=760?250:70],maxZoom:window.innerWidth<=760?14.1:15.6,animate});
    } else {
      const route=ROUTES[routeId];if(!route)return;
      const points=(route.geometry||routeWaypoints(route)).map(p=>L.latLng(p[0],p[1]));
      map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[55,75],paddingBottomRight:[80,window.innerWidth<=760?255:65],maxZoom:16.3,animate});
    }
  }
  function updateSelectionVisuals() {
    BUSES.forEach(bus=>{
      if(bus.marker){bus.marker.setIcon(busDivIcon(bus,bus.id===selectedBusId));bus.marker.setZIndexOffset(bus.id===selectedBusId?1800:1000);bus.renderedStatus=busStatus(bus);bus.renderedSelected=bus.id===selectedBusId;}
      else if(fallbackBusNodes[bus.id]) fallbackBusNodes[bus.id].classList.toggle('is-selected',bus.id===selectedBusId);
    });
  }

  function setFallbackView(view) {
    if(!fallbackSvg)return;
    const aspect=1100/820;
    const w=Math.max(250,Math.min(1350,view.w));
    const h=w/aspect;
    fallbackView={x:view.cx-w/2,y:view.cy-h/2,w,h};
    fallbackSvg.setAttribute('viewBox',`${fallbackView.x} ${fallbackView.y} ${fallbackView.w} ${fallbackView.h}`);
  }
  function fitFallbackToPoints(latlngs) {
    if(!fallbackSvg||!latlngs?.length)return;
    const pts=latlngs.map(([lat,lng])=>fallbackProject(lat,lng));
    let minX=Math.min(...pts.map(p=>p[0])),maxX=Math.max(...pts.map(p=>p[0]));
    let minY=Math.min(...pts.map(p=>p[1])),maxY=Math.max(...pts.map(p=>p[1]));
    let w=Math.max(maxX-minX,260),h=Math.max(maxY-minY,200);
    const aspect=1100/820;
    if(w/h<aspect)w=h*aspect;else h=w/aspect;
    w=Math.min(1250,Math.max(340,w*1.32));h=w/aspect;
    setFallbackView({cx:(minX+maxX)/2,cy:(minY+maxY)/2,w,h});
  }
  function focusFallbackAt(lat,lng,width=420) {
    if(!fallbackSvg||!fallbackProject)return;
    const [x,y]=fallbackProject(lat,lng);
    setFallbackView({cx:x,cy:y,w:width});
  }
  function zoomFallback(factor) {
    if(!fallbackSvg)return;
    setFallbackView({cx:fallbackView.x+fallbackView.w/2,cy:fallbackView.y+fallbackView.h/2,w:fallbackView.w*factor});
  }

  function openBusDetail(id) {
    const bus=BUSES.find(b=>b.id===id);if(!bus)return;
    screenMode='bus';selectedBusId=bus.id;selectedStopId=null;
    trackingBusId=bus.id;routeVisibility=true;
    $('#sheetHome').hidden=true;$('#sheetDetail').hidden=false;
    $('#busDetailView').hidden=false;$('#stopDetailView').hidden=true;
    $('#detailEyebrow').textContent='SHUTTLE TRACKING';
    $('#detailTitle').textContent=bus.name;
    $('#detailSubtitle').textContent=`${routeOf(bus).name} · Approaching pickup`;
    $('#detailBell').style.visibility='hidden';
    updateSelectionVisuals();renderBusDetail();
    setSheetState('detail');
    Object.keys(ROUTES).forEach(styleRoute);
    updateApproachRoute(bus,true);
    focusTrackedVehicles(true);lastTrackMapTick=performance.now();
  }
  function nearestMappedPlace(lat,lng) {
    const all=[...PLACES.map(place=>({name:place.name,lat:place.lat,lng:place.lng})),...STOPS.map(stop=>({name:stop.short,lat:stop.lat,lng:stop.lng}))];
    let best=all[0],dBest=Infinity;
    all.forEach(item=>{const d=haversine([lat,lng],[item.lat,item.lng]);if(d<dBest){dBest=d;best=item;}});
    return {name:best.name,distance:dBest};
  }
  function etaFromBusToUser(bus) {
    if(!userLatLng)return null;
    const pos=bus.currentLatLng||currentBusPosition(bus);
    const direct=haversine([pos.lat,pos.lng],[userLatLng.lat,userLatLng.lng])*1.28;
    let remaining=direct;
    if(trackingBusId===bus.id&&Number.isFinite(approachDistanceMeters)&&approachRequestStart){
      const travelled=haversine(approachRequestStart,[pos.lat,pos.lng]);
      remaining=Math.max(direct,approachDistanceMeters-travelled);
    }
    return Math.max(1,Math.ceil(remaining/250));
  }

  function renderBusDetail() {
    const bus=BUSES.find(b=>b.id===selectedBusId);if(!bus)return;
    const route=routeOf(bus),status=busStatus(bus),free=freeSeats(bus),next=nextStopInfo(bus);
    $('#detailBusIcon').innerHTML=busSvg(status);
    $('#detailBusName').textContent=bus.name;$('#detailBusPlate').textContent=bus.plate;
    $('#quickVehiclePlate').textContent=bus.plate;
    const pos=bus.currentLatLng||currentBusPosition(bus),near=nearestMappedPlace(pos.lat,pos.lng);
    $('#busLiveLocation').textContent=near.distance<500?`Near ${near.name}`:`Around ${near.name}`;
    const userEta=etaFromBusToUser(bus);
    const eta=userEta===null?next.eta:userEta;
    const etaText=`${Math.max(1,Math.round(eta))} min away`;
    $('#busEtaToYou').textContent=etaText;
    if($('#heroEta'))$('#heroEta').textContent=etaText;
    if($('#heroRouteLabel'))$('#heroRouteLabel').textContent=`${bus.name} · ${route.name}`;
    if($('#pickupKind'))$('#pickupKind').textContent=userLatLng?'YOUR PICKUP POINT':'NEXT CHECKPOINT';
    if($('#pickupTargetName'))$('#pickupTargetName').textContent=userLatLng?'Your current location':(next.stop?.short||'Next checkpoint');
    if($('#pickupTargetHelp'))$('#pickupTargetHelp').textContent=userLatLng?'Route and ETA update as your shuttle moves':'Allow location access to estimate arrival to you';
    $('#busFeedStatus').textContent=bus.external&&Date.now()-bus.telemetryAt<12000?'Location connected':'Demo route movement';
    $('#centerSelected').innerHTML=(trackingBusId===bus.id?'Recenter shuttle':'Track this shuttle')+' <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v3m0 15v3m-10.5-10.5h3m15 0h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    $('#centerSelected').classList.toggle('is-active',trackingBusId===bus.id);
    $('#seatStatus').classList.toggle('is-full',status==='full');
    $('#seatStatus').innerHTML=`<i></i><span>${status==='full'?'Full shuttle':'Seats available'}</span>`;
    $('#occupancyLabel').textContent=`${bus.occupancy} of ${bus.capacity} seats`;
    $('#occupancyFill').style.width=`${Math.min(100,bus.occupancy/bus.capacity*100)}%`;
    $('#occupancyFill').classList.toggle('is-full',status==='full');
    $('#occupancyFootText').textContent=status==='full'?'No seats available':`${free} ${free===1?'seat':'seats'} available`;
    if($('#rideSeatsLeft'))$('#rideSeatsLeft').textContent=status==='full'?'Full':`${free} available`;
    $('#occupancyPercent').textContent=`${Math.round(bus.occupancy/bus.capacity*100)}% full`;
    $('#driverName').textContent=bus.driver;$('#driverInitials').textContent=bus.driver.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase();$('#vehiclePlate').textContent=bus.plate;
    $('#detailRouteDot').style.background=route.color;
    $('#checkpointTimeline').innerHTML=nextStopsFor(bus,6).map((item,i)=>`<div class="timeline-stop ${i===0?'is-next':''} ${i>0?'is-upcoming':''}"><span class="timeline-node">${i===0?'•':''}</span><span class="timeline-stop-copy"><strong>${escapeHtml(item.stop.short)}</strong><small>${i===0?'Next checkpoint':route.name}</small></span><span class="timeline-time">${etaLabel(item.eta)}</span></div>`).join('');
    $('#mapActivity').textContent=`${BUSES.length} shuttles on the move`;
  }
  function openStopDetail(id) {
    const stop=STOP_BY_ID.get(id);if(!stop)return;
    screenMode='stop';selectedStopId=id;trackingBusId=null;routeVisibility=false;clearApproachRoute();Object.keys(ROUTES).forEach(styleRoute);
    $('#sheetHome').hidden=true;$('#sheetDetail').hidden=false;
    $('#busDetailView').hidden=true;$('#stopDetailView').hidden=false;
    $('#detailEyebrow').textContent='CHECKPOINT';$('#detailTitle').textContent=stop.short;
    const routeCount=Object.values(ROUTES).filter(r=>r.stopOrder?.includes(id)||r.stopIds.includes(id)).length;
    $('#detailSubtitle').textContent=`${routeCount} ${routeCount===1?'route':'routes'} serve this checkpoint`;
    $('#detailBell').style.visibility='visible';$('#detailBell').classList.toggle('is-active',alerts.has(id));
    $('#stopAlertButton').classList.toggle('is-active',alerts.has(id));
    $('#stopDetailName').textContent=stop.name;$('#stopDetailDescription').textContent=stop.description;
    renderStopArrivals();
    setSheetState('detail');
    if(map)map.panTo([stop.lat,stop.lng],{animate:true,duration:.45});else focusFallbackAt(stop.lat,stop.lng,390);
  }
  function renderStopArrivals() {
    const stop=STOP_BY_ID.get(selectedStopId);if(!stop)return;
    const arrivals=BUSES.map(bus=>({bus,eta:etaToStop(bus,stop.id)})).filter(x=>Number.isFinite(x.eta)).sort((a,b)=>a.eta-b.eta);
    $('#stopArrivalCount').textContent=arrivals.length?`${arrivals.length} shuttle${arrivals.length===1?'':'s'} on this route`:'No scheduled shuttles';
    $('#stopArrivalsList').innerHTML=arrivals.length?arrivals.slice(0,4).map(({bus,eta})=>`<button class="stop-arrival-card" type="button" data-open-bus="${bus.id}"><span class="mini-bus-icon">${busSvg(busStatus(bus))}</span><span class="stop-arrival-main"><strong>${escapeHtml(bus.name)} · ${escapeHtml(routeOf(bus).name)}</strong><small>${busStatus(bus)==='full'?'Full shuttle':`${freeSeats(bus)} seats available`}</small></span><span class="arrival-badge ${busStatus(bus)==='full'?'is-full':''}">${etaLabel(eta)}</span></button>`).join(''):'<div class="search-empty">No shuttle currently follows this checkpoint. Try another route.</div>';
    $$('#stopArrivalsList [data-open-bus]').forEach(btn=>btn.addEventListener('click',()=>openBusDetail(btn.dataset.openBus)));
    $('#stopAlertButton').classList.toggle('is-active',alerts.has(stop.id));$('#stopAlertButton').querySelector('span').textContent=alerts.has(stop.id)?'Alert on':'Alert me';
  }
  function closeDetail() {
    screenMode='home';selectedStopId=null;trackingBusId=null;routeVisibility=false;
    $('#sheetHome').hidden=false;$('#sheetDetail').hidden=true;
    clearApproachRoute();Object.keys(ROUTES).forEach(styleRoute);
    setSheetState('collapsed');
    updateSelectionVisuals();findNearestStop();
  }
  let suppressSheetClick = false;
  function setSheetState(state) {
    const sheet=$('#bottomSheet');
    sheetState=state;
    sheet.classList.toggle('is-collapsed',state==='collapsed');
    sheet.classList.toggle('is-raised',state==='raised');
    sheet.classList.toggle('is-detail',state==='detail');
    sheet.classList.toggle('is-expanded',state==='expanded');
    sheet.style.height='';sheet.style.transition='';
    $('#sheetHandle').setAttribute('aria-expanded',String(state!=='collapsed'));
    $('#sheetHandle').setAttribute('aria-label',state==='collapsed'?'Open shuttle details':'Swipe down to collapse, swipe up to expand');
    $('#sheetHandle').querySelector('span').setAttribute('aria-hidden','true');
    if(state==='raised'||state==='expanded') renderHomeBusList();
    if(state==='detail' && screenMode==='bus') renderBusDetail();
    if(map) setTimeout(()=>map.invalidateSize({pan:false}),300);
  }
  function setSheetExpanded(expanded) { setSheetState(expanded?'expanded':'collapsed'); }
  function toggleSheet() {
    if(suppressSheetClick){suppressSheetClick=false;return;}
    if(sheetState==='collapsed')setSheetState(screenMode==='bus'?'detail':'raised');
    else if(sheetState==='raised'||sheetState==='detail')setSheetState('expanded');
    else setSheetState('collapsed');
  }
  function bindSheetSwipe() {
    const sheet=$('#bottomSheet');
    let startY=null,startX=null,startHeight=0,lastY=0,lastTime=0,dragging=false,pointerId=null;
    const interactive='button,a,input,select,textarea,[role="button"],[data-no-sheet-drag]';
    sheet.addEventListener('pointerdown',event=>{
      if(event.button!==undefined&&event.button!==0)return;
      // Controls retain their click behaviour; the rest of the sheet can be dragged, not only the handle.
      if(event.target.closest(interactive)&&!event.target.closest('#sheetHandle'))return;
      if(event.target.closest('.sheet-expanded-content'))return; // preserve scrolling through long lists
      startY=event.clientY;startX=event.clientX;lastY=startY;lastTime=performance.now();
      startHeight=sheet.getBoundingClientRect().height;dragging=true;pointerId=event.pointerId;
      sheet.classList.add('is-dragging');sheet.style.transition='none';
      try{sheet.setPointerCapture(event.pointerId);}catch(e){}
    });
    sheet.addEventListener('pointermove',event=>{
      if(!dragging||startY===null||event.pointerId!==pointerId)return;
      const totalDy=startY-event.clientY,totalDx=event.clientX-startX;
      if(Math.abs(totalDx)>Math.abs(totalDy)*1.3){return;}
      const parentHeight=sheet.parentElement?.clientHeight||window.innerHeight;
      const maxHeight=Math.max(180,parentHeight-14);
      const minHeight=56;
      const next=Math.max(minHeight,Math.min(maxHeight,startHeight+totalDy));
      sheet.style.height=`${next}px`;
      lastY=event.clientY;lastTime=performance.now();
      if(Math.abs(totalDy)>5&&event.cancelable)event.preventDefault();
    });
    const finish=event=>{
      if(!dragging||startY===null||event.pointerId!==pointerId)return;
      const dy=startY-event.clientY,current=sheet.getBoundingClientRect().height;
      const velocity=(event.clientY-lastY)/Math.max(1,performance.now()-lastTime);
      dragging=false;startY=null;pointerId=null;sheet.classList.remove('is-dragging');sheet.style.transition='';
      if(Math.abs(dy)<10&&Math.abs(velocity)<.22){sheet.style.height='';return;}
      suppressSheetClick=true;
      const up=dy>45||velocity<-.42,down=dy< -45||velocity>.42;
      if(up){
        if(sheetState==='collapsed')setSheetState(screenMode==='bus'?'detail':'raised');
        else if(sheetState==='raised'||sheetState==='detail')setSheetState('expanded');
        else setSheetState('expanded');
      }else if(down){
        if(sheetState==='expanded')setSheetState(screenMode==='bus'?'detail':'raised');
        else setSheetState('collapsed');
      }else{
        const h=sheet.getBoundingClientRect().height;
        const parentHeight=sheet.parentElement?.clientHeight||window.innerHeight;
        const collapsed=64, intermediate=screenMode==='bus'?Math.min(parentHeight*.48,440):Math.min(parentHeight*.34,300);
        const expanded=Math.min(parentHeight*.78,680);
        const snaps=[{state:'collapsed',height:collapsed},{state:screenMode==='bus'?'detail':'raised',height:intermediate},{state:'expanded',height:expanded}];
        snaps.sort((a,b)=>Math.abs(a.height-h)-Math.abs(b.height-h));setSheetState(snaps[0].state);
      }
      window.setTimeout(()=>{suppressSheetClick=false;},260);
    };
    sheet.addEventListener('pointerup',finish);sheet.addEventListener('pointercancel',finish);
    $('#sheetHandle').addEventListener('click',toggleSheet);
    // Keyboard users can operate the same three sheet positions.
    $('#sheetHandle').addEventListener('keydown',event=>{
      if(event.key==='ArrowUp'){event.preventDefault();setSheetState('expanded');}
      if(event.key==='ArrowDown'){event.preventDefault();setSheetState('collapsed');}
      if(event.key==='Enter'||event.key===' '){event.preventDefault();toggleSheet();}
    });
  }

  function updateLocation(lat,lng,accuracy=20) {
    userLatLng={lat,lng,accuracy};
    if(!map){if(fallbackUserNode&&fallbackProject){const [x,y]=fallbackProject(lat,lng);fallbackUserNode.setAttribute('transform',`translate(${x} ${y})`);fallbackUserNode.setAttribute('opacity','1');}if(followingUser)focusFallbackAt(lat,lng,360);findNearestStop();return;}
    userMarker.setLatLng([lat,lng]);userMarker.setOpacity(1);
    userAccuracyCircle.setLatLng([lat,lng]);userAccuracyCircle.setRadius(Math.min(Math.max(accuracy||20,15),180));userAccuracyCircle.setStyle({color:'#2879f6',weight:1,opacity:.45,fillColor:'#2879f6',fillOpacity:.07});
    findNearestStop();
    if(trackingBusId){const tracked=BUSES.find(b=>b.id===trackingBusId);if(tracked)updateApproachRoute(tracked,false);}
    if(followingUser)map.panTo([lat,lng],{animate:true,duration:.35});
  }
  function requestLocation(follow=false, quiet=false) {
    if(!navigator.geolocation){if(!quiet)showToast('Location is not available in this browser.');return;}
    followingUser=follow;
    const locateButtons=[$('#locateButton'),$('#locateTop')];locateButtons.forEach(b=>b.classList.add('is-active'));
    navigator.geolocation.getCurrentPosition(pos=>{
      const firstFix = !userLatLng;
      updateLocation(pos.coords.latitude,pos.coords.longitude,pos.coords.accuracy);
      if(map && (follow || (quiet && firstFix)))map.setView([pos.coords.latitude,pos.coords.longitude],16,{animate:true});
      else if(!map && fallbackSvg && (follow || (quiet && firstFix)))focusFallbackAt(pos.coords.latitude,pos.coords.longitude,360);
      if(!quiet)showToast('Your location is on the map.');
      if(geolocationWatch===null){geolocationWatch=navigator.geolocation.watchPosition(p=>updateLocation(p.coords.latitude,p.coords.longitude,p.coords.accuracy),()=>{}, {enableHighAccuracy:true,maximumAge:4000,timeout:12000});}
      locateButtons.forEach(b=>b.classList.remove('is-active'));
    },err=>{
      locateButtons.forEach(b=>b.classList.remove('is-active'));
      if(!quiet){showToast(err.code===1?'Allow location access to find your nearest checkpoint.':'Could not get your location. Check your phone GPS and try again.');}
    },{enableHighAccuracy:true,maximumAge:5000,timeout:12000});
  }
  function centerSelected() {
    const bus=BUSES.find(b=>b.id===selectedBusId);if(!bus)return;
    trackingBusId=bus.id;routeVisibility=true;
    Object.keys(ROUTES).forEach(styleRoute);updateSelectionVisuals();
    updateApproachRoute(bus,true);focusTrackedVehicles(true);lastTrackMapTick=performance.now();
    renderBusDetail();setSheetState('detail');
    showToast(`Following ${bus.name}`);
  }

  function focusTrackedVehicles(animate=false) {
    if(!trackingBusId)return;
    const bus=BUSES.find(item=>item.id===trackingBusId);if(!bus)return;
    const p=bus.currentLatLng||currentBusPosition(bus), target=pickupTargetFor(bus);
    if(map){
      const points=[[p.lat,p.lng],[target.lat,target.lng]];
      if(points.every(pair=>pair.every(Number.isFinite))){
        map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[38,64],paddingBottomRight:[38,window.innerWidth<=760?Math.min(360,window.innerHeight*.44):90],maxZoom:17,animate});
      } else map.setView([p.lat,p.lng],Math.max(map.getZoom(),16.2),{animate});
    }else if(fallbackSvg){fitFallbackToPoints([[p.lat,p.lng],[target.lat,target.lng]]);}
  }
  function keepTrackedBusInView() {
    if(!map||!trackingBusId)return;
    const bus=BUSES.find(item=>item.id===trackingBusId);if(!bus?.currentLatLng)return;
    const p=map.latLngToContainerPoint([bus.currentLatLng.lat,bus.currentLatLng.lng]),size=map.getSize();
    const sheetHeight=$('#bottomSheet').getBoundingClientRect().height;
    const safeBottom=Math.max(100,sheetHeight+28),top=56,left=42,right=size.x-42,bottom=size.y-safeBottom;
    let targetX=p.x,targetY=p.y;
    if(p.x<left)targetX=left+20;else if(p.x>right)targetX=right-20;
    if(p.y<top)targetY=top+26;else if(p.y>bottom)targetY=Math.max(top+40,bottom-24);
    if(Math.abs(targetX-p.x)>2||Math.abs(targetY-p.y)>2){
      map.panBy([p.x-targetX,p.y-targetY],{animate:true,duration:.42,easeLinearity:.28,noMoveStart:true});
    }
  }

  async function toggleAlert(stopId) {
    if(!stopId)return;
    if(alerts.has(stopId)){alerts.delete(stopId);BUSES.forEach(bus=>alertedPairs.delete(`${bus.id}:${stopId}`));showToast(`Arrival alert turned off for ${STOP_BY_ID.get(stopId).short}.`);}
    else {
      alerts.add(stopId);
      if('Notification' in window && Notification.permission==='default'){
        try{await Notification.requestPermission();}catch(e){}
      }
      if('Notification' in window && Notification.permission==='granted')showToast(`You'll be notified two checkpoints before ${STOP_BY_ID.get(stopId).short}.`);
      else showToast('Arrival reminder saved while this page is open. Allow notifications for a system alert.');
    }
    $('#nearestBell').classList.toggle('is-active',alerts.has(lastNearestId));
    $('#detailBell').classList.toggle('is-active',screenMode==='stop'&&alerts.has(selectedStopId));
    if(screenMode==='stop')renderStopArrivals();
  }
  function triggerNotification(bus, targetStop) {
    const pair=`${bus.id}:${targetStop.id}`;
    if(alertedPairs.has(pair))return;
    alertedPairs.add(pair);
    const message=`${bus.name} is about two checkpoints away from ${targetStop.short}.`;
    if('Notification' in window && Notification.permission==='granted'){
      try{new Notification('KNUST Shuttle arrival alert',{body:message,icon:'favicon.svg',tag:pair,renotify:false});}catch(e){showToast(message);}
    } else showToast(message,4200);
  }
  function checkGeofences(bus) {
    const pos=bus.currentLatLng;if(!pos)return;
    const nowInside=new Set();
    STOPS.forEach(stop=>{const d=haversine([pos.lat,pos.lng],[stop.lat,stop.lng]);if(d<=GEOFENCE_METERS)nowInside.add(stop.id);});
    const justEntered=[...nowInside].filter(id=>!bus.lastGeoStopIds.has(id));
    bus.lastGeoStopIds=nowInside;
    if(!justEntered.length)return;
    const route=routeOf(bus), order=route.stopOrder||[];
    justEntered.forEach(currentId=>{
      // Stop-arrival events are local until a vehicle backend is connected.
      bus.lastArrival={stopId:currentId,at:Date.now()};
      alerts.forEach(targetId=>{
        const targetIndex=order.indexOf(targetId), currentIndex=order.indexOf(currentId);
        if(targetIndex<0||currentIndex<0||targetId===currentId)return;
        const stepsAway=(targetIndex-currentIndex+order.length)%order.length;
        if(stepsAway===2)triggerNotification(bus,STOP_BY_ID.get(targetId));
      });
    });
  }
  function updateTelemetry(now) {
    BUSES.forEach(bus=>{
      if(bus.external && Date.now()-bus.telemetryAt>15000)bus.external=false;
      if(bus.external && bus.externalLatLng){bus.currentLatLng={lat:bus.externalLatLng[0],lng:bus.externalLatLng[1]};bus.distance=projectRouteMeters(routeOf(bus),bus.externalLatLng);}
      else {
        const pos=currentBusPosition(bus,now);bus.currentLatLng={lat:pos.lat,lng:pos.lng};bus.heading=pos.heading;bus.distance=pos.meters;
      }
      checkGeofences(bus);
    });
    lastTelemetryUpdate=now;$('#lastUpdate').textContent='Updated just now';
    findNearestStop();
    if(screenMode==='bus')renderBusDetail(); else if(screenMode==='stop')renderStopArrivals();
  }
  function animationFrame(now) {
    BUSES.forEach(bus=>updateBusPosition(bus,now));
    if(trackingBusId && now-lastTrackMapTick>850){keepTrackedBusInView();lastTrackMapTick=now;}
    if(trackingBusId && userLatLng && now-approachRequestAt>12000){const tracked=BUSES.find(b=>b.id===trackingBusId);if(tracked)updateApproachRoute(tracked,false);}
    if(trackingBusId && !userLatLng && now-approachRequestAt>2200){const tracked=BUSES.find(b=>b.id===trackingBusId);if(tracked)updateApproachRoute(tracked,false);}
    if(!lastTelemetryUpdate || now-lastTelemetryUpdate>=TELEMETRY_INTERVAL) updateTelemetry(now);
    requestAnimationFrame(animationFrame);
  }

  function connectExternalFeed() {
    const params=new URLSearchParams(location.search), feed=params.get('feed');
    if(!feed)return;
    try {
      externalSocket=new WebSocket(feed);
      externalSocket.addEventListener('open',()=>showToast('Shuttle network connected.'));
      externalSocket.addEventListener('message',event=>{
        try {
          const parsed=JSON.parse(event.data), records=Array.isArray(parsed)?parsed:(Array.isArray(parsed.vehicles)?parsed.vehicles:[parsed]);
          records.forEach(record=>{
            const id=record.busId||record.id||record.vehicleId;
            const bus=BUSES.find(b=>b.id===id);if(!bus)return;
            const lat=Number(record.lat??record.latitude),lng=Number(record.lng??record.lon??record.longitude);
            if(!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat > 90||lng < -180||lng > 180)return;
            const now=performance.now(),previous=currentBusPosition(bus,now),reportedHeading=Number(record.heading??record.bearing);
            bus.externalFrom=[previous.lat,previous.lng];bus.externalFromHeading=previous.heading||bus.heading||0;
            bus.externalLatLng=[lat,lng];bus.externalTargetHeading=Number.isFinite(reportedHeading)?((reportedHeading%360)+360)%360:bearing([previous.lat,previous.lng],[lat,lng]);
            bus.externalStart=now;bus.externalDuration=3000;bus.external=true;bus.telemetryAt=Date.now();
            if(Number.isFinite(Number(record.capacity)))bus.capacity=Math.max(1,Math.min(100,Math.round(Number(record.capacity))));
            if(Number.isFinite(Number(record.occupancy)))bus.occupancy=Math.min(bus.capacity,Math.max(0,Math.round(Number(record.occupancy))));
            if(Number.isFinite(Number(record.speed)))bus.speed=Number(record.speed);
            bus.lastNetworkTimestamp=record.timestamp||Date.now();
          });
        } catch(e) { console.warn('Unrecognised shuttle telemetry message',e); }
      });
      externalSocket.addEventListener('error',()=>showToast('Shuttle network is unavailable. Showing route movement.'));
      externalSocket.addEventListener('close',()=>{BUSES.forEach(bus=>bus.external=false);});
    } catch(e) { console.warn('Could not open vehicle feed',e); }
  }

  function toggleSearch(show) {
    const panel=$('#searchPanel'),open=show??panel.hidden;
    panel.hidden=!open;
    if(open){$('#globalSearch').focus();renderSearchResults('');}else{$('#globalSearch').value='';}
  }
  function renderSearchResults(term) {
    const q=term.trim().toLowerCase();const items=[];
    BUSES.forEach(bus=>{if(!q||`${bus.name} ${bus.id} ${routeOf(bus).name}`.toLowerCase().includes(q))items.push({type:'bus',id:bus.id,title:bus.name,subtitle:routeOf(bus).name,icon:busSvg(busStatus(bus))});});
    STOPS.forEach(stop=>{if(!q||`${stop.name} ${stop.short}`.toLowerCase().includes(q))items.push({type:'stop',id:stop.id,title:stop.short,subtitle:'Checkpoint',icon:pinSvg});});
    PLACES.forEach(place=>{if(!q||place.name.toLowerCase().includes(q))items.push({type:'place',id:place.id,title:place.name,subtitle:'Campus landmark',icon:buildingSvg});});
    const shown=items.slice(0,14);
    $('#searchResults').innerHTML=shown.length?shown.map(item=>`<button type="button" class="search-result" data-search-type="${item.type}" data-search-id="${item.id}"><span class="search-result-icon">${item.icon}</span><span class="search-result-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.subtitle)}</small></span></button>`).join(''):`<div class="search-empty">No shuttles or checkpoints found.</div>`;
    $$('#searchResults [data-search-id]').forEach(btn=>btn.addEventListener('click',()=>{
      const type=btn.dataset.searchType,id=btn.dataset.searchId;toggleSearch(false);
      if(type==='bus')openBusDetail(id);else if(type==='stop')openStopDetail(id);else{const place=PLACE_BY_ID.get(id);if(place){if(map)map.setView([place.lat,place.lng],17,{animate:true});else focusFallbackAt(place.lat,place.lng,330);}showToast(place?.name||'Campus landmark');}
    }));
  }
  function initHelp() {
    const dialog=$('#helpDialog');
    $('#helpButton').addEventListener('click',()=>dialog.hidden=false);
    $('#helpClose').addEventListener('click',()=>dialog.hidden=true);$('#helpDone').addEventListener('click',()=>dialog.hidden=true);
    dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.hidden=true;});
  }

  function initLocalFallback() {
    // Self-contained, interactive campus schematic if Leaflet cannot load.
    // Its projected bounds match the bundled background so markers land on the map.
    const holder=$('#localMapFallback');holder.hidden=false;$('#map').style.display='none';
    const width=1100,height=820,bounds={north:6.693,south:6.655,west:-1.583,east:-1.535};
    const point=(lat,lng)=>[((lng-bounds.west)/(bounds.east-bounds.west))*width,((bounds.north-lat)/(bounds.north-bounds.south))*height];
    const routeSvg=Object.values(ROUTES).map(route=>{
      const points=route.geometry.map(([lat,lng])=>point(lat,lng).join(',')).join(' ');
      return `<g data-fallback-route="${route.id}"><polyline class="fallback-route-outline" points="${points}"/><polyline class="fallback-route-line" data-fallback-route-line="${route.id}" points="${points}" stroke="${route.color}"/></g>`;
    }).join('');
    const stopSvg='';
    const busGroup=BUSES.map(bus=>{const pos=currentBusPosition(bus,performance.now());const [x,y]=point(pos.lat,pos.lng);return `<g class="local-fallback-bus" data-open-bus="${bus.id}" data-bus-pos="${bus.id}" transform="translate(${x} ${y}) rotate(${pos.heading}) scale(.55)" role="button" tabindex="0" aria-label="${escapeHtml(bus.name)}">${busSvg(busStatus(bus)).replace('<svg viewBox="0 0 36 62"','<svg x="-18" y="-31" width="36" height="62" viewBox="0 0 36 62"')}<title>${escapeHtml(bus.name)}</title></g>`;}).join('');
    const [ux,uy]=point(CAMPUS_CENTER[0],CAMPUS_CENTER[1]);
    fallbackProject=point;
    holder.innerHTML=`<svg id="fallbackSvg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid slice" role="application" aria-label="Interactive schematic map of KNUST"><image href="campus-fallback.svg" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none"/><g class="fallback-route-layer">${routeSvg}</g><g class="fallback-shuttle-layer">${stopSvg}${busGroup}<g id="fallbackUserMarker" opacity="0" transform="translate(${ux} ${uy})"><circle class="fallback-user-pulse" r="18" fill="#2879f6" opacity=".18"/><circle r="10" fill="#fff"/><circle r="7" fill="#2879f6" stroke="#fff" stroke-width="2"/></g></g></svg>`;
    fallbackSvg=holder.querySelector('#fallbackSvg');
    Object.values(ROUTES).forEach(route=>{const line=fallbackSvg.querySelector(`[data-fallback-route-line="${route.id}"]`);const outline=fallbackSvg.querySelector(`[data-fallback-route="${route.id}"] .fallback-route-outline`);fallbackRouteNodes[route.id]={line,outline};});
    holder.querySelectorAll('[data-open-stop]').forEach(el=>{
      const activate=()=>openStopDetail(el.dataset.openStop);
      el.addEventListener('click',activate);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
    });
    holder.querySelectorAll('[data-open-bus]').forEach(el=>{
      const activate=()=>openBusDetail(el.dataset.openBus);
      el.addEventListener('click',activate);el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();activate();}});
    });
    holder.querySelectorAll('[data-bus-pos]').forEach(el=>fallbackBusNodes[el.dataset.busPos]=el);
    fallbackUserNode=holder.querySelector('#fallbackUserMarker');
    fallbackSvg.addEventListener('wheel',event=>{event.preventDefault();zoomFallback(event.deltaY<0?.82:1.22);},{passive:false});
    fallbackSvg.addEventListener('pointerdown',event=>{
      if(event.target.closest('[data-open-stop],[data-open-bus]'))return;
      fallbackDrag={x:event.clientX,y:event.clientY,view:{...fallbackView},moved:false};
      try{fallbackSvg.setPointerCapture(event.pointerId);}catch(e){}
    });
    fallbackSvg.addEventListener('pointermove',event=>{
      if(!fallbackDrag)return;
      const rect=fallbackSvg.getBoundingClientRect();
      const dx=(event.clientX-fallbackDrag.x)*fallbackDrag.view.w/rect.width;
      const dy=(event.clientY-fallbackDrag.y)*fallbackDrag.view.h/rect.height;
      if(Math.abs(dx)+Math.abs(dy)>3)fallbackDrag.moved=true;
      fallbackView={...fallbackDrag.view,x:fallbackDrag.view.x-dx,y:fallbackDrag.view.y-dy};
      fallbackSvg.setAttribute('viewBox',`${fallbackView.x} ${fallbackView.y} ${fallbackView.w} ${fallbackView.h}`);
    });
    const endFallbackDrag=()=>{fallbackDrag=null;};
    fallbackSvg.addEventListener('pointerup',endFallbackDrag);fallbackSvg.addEventListener('pointercancel',endFallbackDrag);
    updateFallbackRouteStyles();
    renderQuickCheckpoints();renderHomeBusList();findNearestStop();
    $('#mapActivity').textContent='Campus map';
    if($('#mapAttribution'))$('#mapAttribution').innerHTML='Campus schematic · checkpoint locations based on mapped features';
  }

  function bindEvents() {
    // Map gestures are intentionally uncluttered; native trackpad/touch zoom remains available.
    $('#zoomIn').addEventListener('click',()=>map?map.zoomIn():zoomFallback(.78));$('#zoomOut').addEventListener('click',()=>map?map.zoomOut():zoomFallback(1.28));
    $('#fitCampus').addEventListener('click',()=>{if(map)map.setView(CAMPUS_CENTER,15,{animate:true});else focusFallbackAt(CAMPUS_CENTER[0],CAMPUS_CENTER[1],620);});
    $('#locateButton').addEventListener('click',()=>requestLocation(true));
    const pickupLocate=$('#pickupLocate');if(pickupLocate)pickupLocate.addEventListener('click',()=>requestLocation(true));
    $('#nearestBell').addEventListener('click',()=>toggleAlert(lastNearestId));
    bindSheetSwipe();
    $('#detailBack').addEventListener('click',closeDetail);
    $('#centerSelected').addEventListener('click',centerSelected);
    $('#locateTop').addEventListener('click',()=>requestLocation(true));
    $('#detailBell').addEventListener('click',()=>toggleAlert(selectedStopId));
    $('#stopAlertButton').addEventListener('click',()=>toggleAlert(selectedStopId));
    $('#viewAllBuses').addEventListener('click',()=>setSheetState('expanded'));
    const searchToggle=$('#searchToggle');if(searchToggle)searchToggle.addEventListener('click',()=>toggleSearch());
    $('#searchClose').addEventListener('click',()=>toggleSearch(false));
    $('#globalSearch').addEventListener('input',e=>renderSearchResults(e.target.value));
    document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#helpDialog').hidden=true;if(screenMode!=='home')closeDetail();}});
    initHelp();
  }

  function boot() {
    startMap();
    // A local route model is always available; road-snapped geometry improves it when online.
    Object.values(ROUTES).forEach(route=>{route.geometry=routeWaypoints(route);buildRouteMeta(route);});
    if(map){
      // Route geometry first uses the road network; if online routing is unavailable,
      // checkpoint-to-checkpoint lines remain interactive and vehicle movement still works.
      drawRouteLayers();addMapMarkers();
      loadRoadGeometry().then(()=>{drawRouteLayers();BusesReposition();}).catch(()=>{});
      function BusesReposition(){BUSES.forEach(bus=>updateBusPosition(bus,performance.now(),true));}
    } else initLocalFallback();
    bindEvents();renderQuickCheckpoints();findNearestStop();
    connectExternalFeed();
    const clock=()=>{const fresh=BUSES.some(bus=>bus.external&&Date.now()-bus.telemetryAt<12000);$('#lastUpdate').textContent=fresh?'Live location updates':'Simulated route movement';};clock();setInterval(clock,3000);
    // Open the selected shuttle by default so the route/ETA experience is immediately visible.
    openBusDetail(selectedBusId);
    if(navigator.geolocation){setTimeout(()=>requestLocation(false,true),1200);}
    requestAnimationFrame(animationFrame);
    if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
  boot();
})();
