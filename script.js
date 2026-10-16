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
  // Browser-side CARTO Basemaps key. Restrict allowed websites in the CARTO dashboard.
  const CARTO_BASEMAP_KEY = 'cb1_4m0o_1_7bc2e168d25a26b3ddd79605';
  const CAMPUS_CENTER = [6.6778, -1.5708];
  const COLORS = {
    green: '#168467', blue: '#4778f5', orange: '#ed9347', violet: '#9a6de1',
    available: '#15936a', full: '#d94848'
  };
  // Slim top-down vehicle artwork. Its front points north (0deg), matching compass bearings.
  const busSvg = (status = 'available', serviceColor = null) => {
    const color = status === 'full' ? '#a64a4a' : (serviceColor || '#176a51');
    return `<svg viewBox="0 0 40 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12.5 2.7h15C32.3 2.7 35 6 35 11.2v37.4c0 5.1-2.5 8.7-7.4 8.7h-15C7.7 57.3 5 53.7 5 48.6V11.2C5 6 7.7 2.7 12.5 2.7Z" fill="${color}" stroke="none"/>
      <path d="M10.2 11.2c0-2 1.3-3.4 3.2-3.4h13.2c1.9 0 3.2 1.4 3.2 3.4v8.4H10.2v-8.4Z" fill="#14382F"/>
      <path d="M10.2 22h19.6v14.2H10.2z" fill="#f7fbf6"/>
      <path d="M12.3 24.3h4.4v4.1h-4.4zM18 24.3h4v4.1h-4zM23.3 24.3h4.3v4.1h-4.3zM12.3 30h4.4v4.1h-4.4zM18 30h4v4.1h-4zM23.3 30h4.3v4.1h-4.3z" fill="${color}" opacity=".38"/>
      <path d="M10.4 39h19.2m-17.4 4h15.6m-15.6 3.1h15.6" stroke="#11372D" stroke-width="1.5" stroke-linecap="round" opacity=".9"/>
      <path d="M5.5 15v6m29-6v6M5.5 39v6m29-6v6" stroke="#263D35" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M13 3.8v2.4m14-2.4v2.4" stroke="#f7fff7" stroke-width="1.3" stroke-linecap="round"/>
      <path d="M12.3 52.8h3.2m9 0h3.2" stroke="#e8ffe9" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  };
  const pinSvg = `<svg viewBox="0 0 32 38" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M16 36S3.3 22 3.3 14.8a12.7 12.7 0 1 1 25.4 0C28.7 22 16 36 16 36Z" fill="#fff" stroke="#fff" stroke-width="3"/><path d="M16 34S4.9 21.8 4.9 14.8a11.1 11.1 0 1 1 22.2 0C27.1 21.8 16 34 16 34Z" fill="#2879f6"/><circle cx="16" cy="14.5" r="4.8" fill="#fff"/><circle cx="16" cy="14.5" r="2.1" fill="#2879f6"/></svg>`;
  const buildingSvg = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 9 9-5 9 5M5 10v8m4-8v8m6-8v8m4-8v8M3 20h18M2.5 10h19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const searchSvg = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.7" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4.2 4.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
  const map = window.L ? L.map('map', {
    zoomControl: false, attributionControl: true, preferCanvas: true,
    zoomSnap: .5, zoomDelta: .5, minZoom: 12, maxZoom: 19,
    wheelDebounceTime: 60, wheelPxPerZoomLevel: 90, inertia: true, inertiaDeceleration: 2400,
    zoomAnimation: true, markerZoomAnimation: true, fadeAnimation: false
  }).setView(CAMPUS_CENTER, 15.0) : null;

  // Confirmed stop order comes from the shuttle routes supplied by the project owner.
  // Other named stops found in public campus mapping are included as provisional map/search pins
  // until the exact bay coordinates and route sequences are checked on campus.
  const STOPS = [
    { id:'commercial', name:'Commercial Area Bus Stop', short:'Commercial Area', lat:6.68280, lng:-1.57691, description:'Commercial-area shuttle and taxi station.', confidence:'owner-route' },
    { id:'conti', name:'Conti Bus Stop', short:'Conti Bus Stop', lat:6.67920, lng:-1.57083, description:'Conti / Continental Roundabout checkpoint.', confidence:'owner-route' },
    { id:'science', name:'College of Science Bus Stop', short:'College of Science', lat:6.67231, lng:-1.56841, description:'College of Science checkpoint. Exact bus-bay position should be verified on campus.', confidence:'owner-route', coordinateApproximate:true },
    { id:'ksb', name:'KSB Bus Stop', short:'KSB', lat:6.66931, lng:-1.56722, description:'Mapped KSB bus stop on P. V. Obeng Avenue.', confidence:'openstreetmap' },
    { id:'caselyHayford', name:'Casely Hayford Bus Stop', short:'Casely Hayford', lat:6.67470, lng:-1.57070, description:'Casely Hayford checkpoint. Pin is approximate and should be confirmed on campus.', confidence:'candidate', coordinateApproximate:true },
    { id:'prempeh', name:'Prempeh II Library Bus Stop', short:'Prempeh Library', lat:6.675076, lng:-1.5729718, description:'Prempeh II Library area. Pin follows publicly mapped library coordinates, not a surveyed bus-bay coordinate.', confidence:'openstreetmap', coordinateApproximate:true },
    { id:'brunei', name:'Brunei Bus Stop', short:'Brunei', lat:6.67075, lng:-1.57455, description:'Brunei hostel-area shuttle checkpoint; bus-bay position approximate.', confidence:'candidate', coordinateApproximate:true },
    { id:'gaza', name:'Gaza Area Checkpoint', short:'Gaza', lat:6.67650, lng:-1.56000, description:'Gaza-area destination reported by the project owner; map pin is approximate pending field verification.', confidence:'candidate', coordinateApproximate:true },
    { id:'medicalVillage', name:'Medical Village Checkpoint', short:'Medical Village', lat:6.67380, lng:-1.54630, description:'Medical Village / Boadi-side destination candidate. Exact shuttle stop and bay must be verified.', confidence:'candidate', coordinateApproximate:true },
    { id:'pentecoste', name:'Pentecoste Bus Stop', short:'Pentecoste', lat:6.67940, lng:-1.56780, description:'Public campus bus-stop name; approximate pin pending local verification.', confidence:'candidate', coordinateApproximate:true },
    { id:'ccb', name:'CCB Bus Stop', short:'CCB', lat:6.67690, lng:-1.56880, description:'Public campus bus-stop name; approximate pin pending local verification.', confidence:'candidate', coordinateApproximate:true },
    { id:'steps', name:'Steps Bus Stop', short:'Steps', lat:6.67820, lng:-1.56900, description:'Also mapped as KNUST Stairs Bus Stop; approximate pin pending local verification.', confidence:'candidate', coordinateApproximate:true },
    { id:'ahinsan', name:'Ahinsan Bus Stop', short:'Ahinsan', lat:6.67240, lng:-1.57910, description:'Public campus bus-stop name; approximate pin pending local verification.', confidence:'candidate', coordinateApproximate:true },
    { id:'bomsoGate', name:'Bomso Gate Bus Stop', short:'Bomso Gate', lat:6.66650, lng:-1.57940, description:'Public campus bus-stop name; approximate pin pending local verification.', confidence:'candidate', coordinateApproximate:true },
    { id:'boadi', name:'Boadi Market Stop', short:'Boadi Market', lat:6.67531, lng:-1.54210, description:'Boadi-side landmark; not a confirmed Medical Village shuttle bay.', confidence:'candidate', coordinateApproximate:true },
    { id:'ayeduase', name:'Ayeduase Gate', short:'Ayeduase Gate', lat:6.67566, lng:-1.56361, description:'Campus gate-area landmark; route service needs confirmation.', confidence:'candidate', coordinateApproximate:true },
    { id:'kotei', name:'Kotei Bus Stop', short:'Kotei', lat:6.66447, lng:-1.55892, description:'Kotei-side checkpoint candidate; route service needs confirmation.', confidence:'candidate', coordinateApproximate:true },
    { id:'trinity', name:'Trinity Bus Stop', short:'Trinity', lat:6.67605, lng:-1.56880, description:'Existing prototype checkpoint; exact stop location and route need field verification.', confidence:'candidate', coordinateApproximate:true }
  ];
  const PLACES = [
    { id:'unityHall', name:'Unity Hall', lat:6.67953, lng:-1.57186, description:'Student residence near Conti Roundabout.' },
    { id:'greatHall', name:'The Old Great Hall', lat:6.68115, lng:-1.57413, description:'Central university landmark.' },
    { id:'jubilee', name:'KNUST Jubilee Mall', lat:6.68254, lng:-1.57566, description:'University shopping and commercial centre.' },
    { id:'republicHall', name:'Republic Hall', lat:6.67852, lng:-1.57402, description:'Student residence near the Royal Parade Ground.' },
    { id:'independenceHall', name:'Independence Hall', lat:6.67642, lng:-1.57228, description:'Student residence in the halls area.' },
    { id:'botanical', name:'KNUST Botanical Garden', lat:6.68150, lng:-1.56570, description:'University botanical garden and green space.' },
    { id:'astro', name:'Kotei AstroTurf', lat:6.66257, lng:-1.56056, description:'Sports pitch near Kotei.' },
    { id:'boadiMarket', name:'Boadi Market', lat:6.67531, lng:-1.54210, description:'Market checkpoint east of campus.' },
    { id:'medical', name:'Medical Village', lat:6.67380, lng:-1.54630, description:'Medical Village area; precise pin needs confirmation.' }
  ];
  const STOP_BY_ID = new Map(STOPS.map(s => [s.id, s]));
  const PLACE_BY_ID = new Map(PLACES.map(p => [p.id, p]));

  function makeServiceRoute({id,name,color,cycleMs,outboundStopIds,returnStopIds,outboundDirection=null,returnDirection=null,provisional=false,plannerEnabled=true}) {
    // Composite route follows the actual outbound checkpoints then the different return checkpoints.
    const stopIds = [...outboundStopIds, ...returnStopIds.slice(1)];
    return {
      id,name,color,cycleMs,outboundStopIds:[...outboundStopIds],returnStopIds:[...returnStopIds],stopIds,
      outboundDirection,returnDirection,provisional,plannerEnabled,geometry:null,cumulative:null,totalMeters:0,nodes:[],stopOrder:[],
      outboundEndMeters:0,roadGeometry:false
    };
  }
  const ROUTES = {
    commercialKsb: makeServiceRoute({
      id:'commercialKsb', name:'Commercial Area ↔ KSB', color:COLORS.green, cycleMs:900000,
      outboundStopIds:['commercial','conti','science','ksb'],
      returnStopIds:['ksb','caselyHayford','conti','commercial'],
      outboundDirection:'Towards KSB', returnDirection:'Towards Commercial Area'
    }),
    bruneiKsb: makeServiceRoute({
      id:'bruneiKsb', name:'Brunei ↔ KSB', color:COLORS.blue, cycleMs:960000,
      outboundStopIds:['brunei','prempeh','science','ksb'],
      returnStopIds:['ksb','caselyHayford','prempeh','brunei'],
      outboundDirection:'Towards KSB', returnDirection:'Towards Brunei'
    }),
    scienceGaza: makeServiceRoute({
      id:'scienceGaza', name:'College of Science ↔ Gaza', color:COLORS.violet, cycleMs:780000,
      outboundStopIds:['science','gaza'], returnStopIds:['gaza','science'], outboundDirection:'Towards Gaza', returnDirection:'Towards College of Science', provisional:true, plannerEnabled:true
    }),
    bruneiMedical: makeServiceRoute({
      id:'bruneiMedical', name:'Brunei ↔ Medical Village', color:COLORS.orange, cycleMs:1080000,
      outboundStopIds:['brunei','medicalVillage'], returnStopIds:['medicalVillage','brunei'],
      outboundDirection:'Towards Medical Village', returnDirection:'Towards Brunei', provisional:true, plannerEnabled:true
    }),
    scienceMedical: makeServiceRoute({
      id:'scienceMedical', name:'College of Science ↔ Medical Village', color:'#d66c9c', cycleMs:1020000,
      outboundStopIds:['science','medicalVillage'], returnStopIds:['medicalVillage','science'],
      outboundDirection:'Towards Medical Village', returnDirection:'Towards College of Science', provisional:true, plannerEnabled:true
    })
  };
  // The Brunei–Medical Village endpoint service is included provisionally because campus transport
  // reporting mentions the connection; intermediate stops and exact operating pattern are not confirmed.
  const BUSES = [
    { id:'K-01', name:'Shuttle K-01', routeId:'bruneiKsb', offset:.10 },
    { id:'K-02', name:'Shuttle K-02', routeId:'commercialKsb', offset:.66 },
    { id:'K-03', name:'Shuttle K-03', routeId:'commercialKsb', offset:.30 },
    { id:'K-04', name:'Shuttle K-04', routeId:'scienceGaza', offset:.54 },
    { id:'K-05', name:'Shuttle K-05', routeId:'bruneiKsb', offset:.72 },
    { id:'K-06', name:'Shuttle K-06', routeId:'bruneiMedical', offset:.38 },
    { id:'K-07', name:'Shuttle K-07', routeId:'scienceMedical', offset:.18 }
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
  let approachEtaMinutes = null;
  let approachPatternKey = '';
  let approachPatternAnchor = null;
  let approachPatternBuildAt = 0;
  let stopMarkers = {}, stopLabelMarkers = {}, placeMarkers = {}, busMarkers = {};
  let fallbackUserNode = null;
  let routeVisibility = false;
  let activeRoute = 'all';
  let trackingBusId = null;
  let lastTrackMapTick = 0;
  let lastFollowPanAt = 0;
  let followSelectedBus = false;
  let mapReadyForMotion = false;
  let plannedTripActive = false;
  let tripPickupId = 'conti';
  let tripDestinationId = 'ksb';
  let selectedServicePattern = 'all';
  let sheetState = 'collapsed';
  let selectedBusId = null;
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
  function busStatus(bus) { return 'available'; }
  function freeSeats(bus) { return null; }
  function busIconHtml(bus, selected=false) {
    const rot=Number.isFinite(bus.heading)?bus.heading:0;
    const mins=nextStopInfo(bus).eta;
    const eta=Number.isFinite(mins)?`${Math.max(1,Math.round(mins))} min`:'—';
    return `<div class="bus-marker${selected?' is-selected':''}" data-bus-marker="${bus.id}" style="--heading:${rot}deg" aria-label="${escapeHtml(bus.name)}, ${escapeHtml(routeOf(bus).name)}"><span class="bus-vehicle">${busSvg('available', routeOf(bus).color)}</span><span class="bus-label">${eta}</span><span class="bus-id-label">${bus.id}</span></div>`;
  }
  function stopIconHtml() { return `<div class="stop-pin-marker">${pinSvg}</div>`; }
  function pointIconHtml(place) { return `<div class="map-point-label">${escapeHtml(place.name)}</div>`; }
  function busDivIcon(bus, selected=false) {
    return L.divIcon({ className:'bus-marker-shell', html:busIconHtml(bus,selected), iconSize:[24,50], iconAnchor:[12,25] });
  }
  function stopDivIcon(size=30) { return L.divIcon({ className:'stop-marker-shell', html:stopIconHtml(), iconSize:[size,size], iconAnchor:[size/2,size-1] }); }
  function stopLabelIcon(stop) { return L.divIcon({className:'stop-label-marker-shell',html:`<div class="stop-name-label">${escapeHtml(stop.short)}</div>`,iconSize:[145,20],iconAnchor:[0,10]}); }
  function placeDivIcon(place) { return L.divIcon({ className:'stop-label-marker', html:pointIconHtml(place), iconSize:[140,22], iconAnchor:[0,0] }); }

  function startMap() {
    if (!map) return;
    streetLayer = L.tileLayer(`https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${encodeURIComponent(CARTO_BASEMAP_KEY)}`, {
      maxZoom:19, maxNativeZoom:19, keepBuffer:6,
      // Let the current tiles remain visible while the user pans/zooms; fetch replacement tiles when motion settles.
      updateWhenIdle:true, updateWhenZooming:false, updateInterval:250, detectRetina:false,
      attribution:'&copy; OpenStreetMap contributors &copy; CARTO'
    });
    streetLayer.on('tileerror', () => {
      tileErrorCount++;
      // Never swap the whole map because of a short tile/CDN hiccup: that caused the screen to flash.
      if (tileErrorCount >= 18 && tileLoadCount === 0 && $('#mapActivity')) $('#mapActivity').textContent = 'Map tiles unavailable';
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
    map.on('zoomend', updatePlaceLabels);
    map.on('moveend', updatePlaceLabels);
    map.on('dragstart',()=>{followSelectedBus=false;});
    map.getContainer().addEventListener('wheel',()=>{followSelectedBus=false;},{passive:true});
    map.getContainer().addEventListener('touchstart',event=>{if(event.touches?.length>1)followSelectedBus=false;},{passive:true});
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
    route.outboundEndMeters = route.nodes[Math.max(0, route.outboundStopIds.length - 1)]?.meters || 0;
    route.patterns = [
      { key:'outbound', label:route.outboundDirection || `Towards ${STOP_BY_ID.get(route.outboundStopIds.at(-1))?.short || 'destination'}`, stopIds:route.outboundStopIds, nodeStart:0 },
      { key:'return', label:route.returnDirection || `Towards ${STOP_BY_ID.get(route.returnStopIds.at(-1))?.short || 'origin'}`, stopIds:route.returnStopIds, nodeStart:route.outboundStopIds.length - 1 }
    ];
    routeGeometryReady=true;
  }
  async function loadRoadGeometry() {
    const entries=Object.values(ROUTES);
    // Fetch road geometry into temporary results first. Do not mutate the active route layers while
    // network requests are still arriving; that avoids partial redraws and gives animation a stable base.
    const results=await Promise.all(entries.map(async route=>{
      const fallback=routeWaypoints(route);
      const pts=fallback.map(([lat,lng])=>`${lng},${lat}`).join(';');
      const url=`https://router.project-osrm.org/route/v1/driving/${pts}?overview=full&geometries=geojson&steps=false&continue_straight=true`;
      try{
        const response=await fetch(url,{mode:'cors',signal:AbortSignal.timeout?AbortSignal.timeout(2300):undefined});
        if(!response.ok)throw new Error('Routing service unavailable');
        const data=await response.json();
        if(data.code!=='Ok'||!data.routes?.[0]?.geometry?.coordinates?.length)throw new Error('No road geometry');
        return {route,geometry:data.routes[0].geometry.coordinates.map(([lng,lat])=>[lat,lng]),roadGeometry:true};
      }catch(e){return {route,geometry:fallback,roadGeometry:false};}
    }));

    // Capture current positions immediately before swapping geometries so each bus eases from the
    // position the student actually sees at that moment, rather than jumping back to request-start.
    const migrationAt=performance.now();
    const previousPositions=new Map(BUSES.map(bus=>{
      const pos=bus.currentLatLng||currentBusPosition(bus,migrationAt);
      return [bus.id,{lat:pos.lat,lng:pos.lng,heading:pos.heading||bus.heading||0}];
    }));
    results.forEach(({route,geometry,roadGeometry})=>{
      route.geometry=geometry;route.roadGeometry=roadGeometry;
      if(roadGeometry)useOSRMGeometry=true;
      buildRouteMeta(route);
    });
    drawRouteLayers();
    BUSES.forEach(bus=>{
      const prior=previousPositions.get(bus.id);
      if(prior&&!bus.external){bus.routeTransitionFrom=[prior.lat,prior.lng];bus.routeTransitionHeadingFrom=prior.heading;bus.routeTransitionStart=migrationAt;bus.routeTransitionDuration=900;}
      if(bus.marker)updateBusPosition(bus,migrationAt,true);
    });
    // Rebuild only the highlighted service geometry; never route a shuttle to the user's location.
    if(activeRoute!=='all')focusRoute(activeRoute,false);
    renderHomeBusList();
    // Route display is independent from the user's location.
  }
  function drawRouteLayers() {
    if(!map) return;
    Object.values(ROUTES).forEach(route => {
      // Keep the same Leaflet layer instances; only replace their geometry after routing returns.
      if(routeOutlines[route.id]) routeOutlines[route.id].setLatLngs(route.geometry);
      else routeOutlines[route.id]=L.polyline(route.geometry,{color:'#ffffff',weight:8,opacity:0,interactive:false,lineCap:'round',lineJoin:'round',className:`route-outline route-outline-${route.id}`,smoothFactor:1.2,noClip:false}).addTo(map);
      if(routeLayers[route.id]) routeLayers[route.id].setLatLngs(route.geometry);
      else routeLayers[route.id]=L.polyline(route.geometry,{color:route.color,weight:4,opacity:0,interactive:false,lineCap:'round',lineJoin:'round',className:`route-line route-${route.id}`,smoothFactor:1.2,noClip:false}).addTo(map);
      styleRoute(route.id);
    });
  }
  function styleRoute(routeId) {
    const route=ROUTES[routeId];
    const tracked=trackingBusId ? BUSES.find(bus=>bus.id===trackingBusId) : null;
    const visible=!!tracked && tracked.routeId===routeId;
    if(routeLayers[routeId]) {
      const line=visible?directionalRouteGeometry(tracked):[];
      routeLayers[routeId].setLatLngs(line);
      routeLayers[routeId].setStyle({opacity:visible?1:0,weight:visible?5:0,dashArray:null});
    }
    if(routeOutlines[routeId]) {
      const line=visible?directionalRouteGeometry(tracked):[];
      routeOutlines[routeId].setLatLngs(line);
      routeOutlines[routeId].setStyle({opacity:visible?.95:0,weight:visible?9:0});
    }
  }
  function directionalRouteGeometry(bus) {
    const route=routeOf(bus); if(!route?.geometry?.length)return [];
    const current=bus.external&&Number.isFinite(bus.distance)?bus.distance:busDistance(bus,performance.now());
    const direction=currentDirection(bus);
    const terminal=direction?.key==='outbound'?route.outboundEndMeters:route.totalMeters;
    const remaining=Math.max(20,terminal-current);
    return routeSliceForward(route,current,remaining);
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
    STOPS.forEach(stop=>{
      const icon=L.divIcon({className:`stop-marker-shell${stop.confidence==='candidate'?' is-candidate-stop':''}`,html:stopIconHtml(),iconSize:[20,23],iconAnchor:[10,22]});
      const marker=L.marker([stop.lat,stop.lng],{icon,keyboard:true,title:stop.name,zIndexOffset:stop.confidence==='candidate'?250:500,riseOnHover:true});
      marker.on('click',()=>openStopDetail(stop.id)); marker.addTo(map); stopMarkers[stop.id]=marker;
    });
    PLACES.forEach(place=>{
      const marker=L.marker([place.lat,place.lng],{icon:placeDivIcon(place),keyboard:false,interactive:false,zIndexOffset:50,opacity:0});
      marker.addTo(map); placeMarkers[place.id]=marker;
    });
    BUSES.forEach(bus=>{
      bus.currentLatLng=routePositionAt(routeOf(bus),routeOf(bus).totalMeters*(bus.offset||0));
      bus.marker=L.marker([bus.currentLatLng.lat,bus.currentLatLng.lng],{icon:busDivIcon(bus,bus.id===selectedBusId),keyboard:true,title:`${bus.name} · ${busStatus(bus)==='full'?'Full':'Route active'}`,zIndexOffset:bus.id===selectedBusId?1800:1000,riseOnHover:true,autoPanOnFocus:false});
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
    // Keep the campus overview clean; secondary landmarks and unverified candidate stops appear only when zoomed in.
    Object.entries(placeMarkers).forEach(([id,marker])=>{
      marker.setOpacity(zoom >= 13.25 ? 1 : 0);
      const el=marker.getElement(); if(el) el.style.pointerEvents='none';
    });
    Object.entries(stopMarkers).forEach(([id,marker])=>{
      const stop=STOP_BY_ID.get(id);
      const threshold=stop?.confidence==='candidate'?14.05:13.0;
      marker.setOpacity(zoom >= threshold ? (stop?.confidence==='candidate'?.72:1) : 0);
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
  function clearApproachRoute() {
    if(map){
      if(approachLine)map.removeLayer(approachLine);
      if(approachOutline)map.removeLayer(approachOutline);
      if(approachTargetMarker)map.removeLayer(approachTargetMarker);
    }
    approachLine=null;approachOutline=null;approachTargetMarker=null;approachCoords=[];approachTarget=null;
    approachDistanceMeters=null;approachRequestAt=0;approachRequestStart=null;approachRequestTarget=null;approachEtaMinutes=null;
    approachPatternKey='';approachPatternAnchor=null;approachPatternBuildAt=0;
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
    const route=routeOf(bus), routePos=routePositionAt(route,busDistance(bus,now));
    if(bus.routeTransitionFrom && bus.routeTransitionStart){
      const duration=bus.routeTransitionDuration||850;
      const raw=Math.max(0,Math.min(1,(now-bus.routeTransitionStart)/duration));
      const t=raw*raw*(3-2*raw); // smoothstep removes a visible snap when road geometry changes
      const point=interpolateLatLng(bus.routeTransitionFrom,[routePos.lat,routePos.lng],t);
      const heading=interpolateHeading(bus.routeTransitionHeadingFrom??routePos.heading,routePos.heading,t);
      if(raw>=1){bus.routeTransitionFrom=null;bus.routeTransitionStart=0;}
      return {...point,heading,meters:routePos.meters};
    }
    return routePos;
  }
  // If two vehicles occupy virtually the same screen point, gently fan out only their displayed
  // markers. Their actual GPS/simulated coordinates remain untouched for ETA and route calculations.
  function clusteredMapMarkerPosition(bus, pos, now) {
    if(!map) return [pos.lat,pos.lng];
    const origin=map.latLngToContainerPoint([pos.lat,pos.lng]);
    const nearby=[];
    BUSES.forEach(other=>{
      const otherPos=other===bus?pos:(other.currentLatLng||currentBusPosition(other,now));
      const point=map.latLngToContainerPoint([otherPos.lat,otherPos.lng]);
      if(Math.hypot(point.x-origin.x,point.y-origin.y)<20) nearby.push({bus:other,point});
    });
    if(nearby.length<2) return [pos.lat,pos.lng];
    nearby.sort((a,b)=>a.bus.id.localeCompare(b.bus.id));
    const index=nearby.findIndex(item=>item.bus===bus);
    if(index<0)return [pos.lat,pos.lng];
    const angle=(Math.PI*2*index)/nearby.length;
    const radius=nearby.length===2?15:18;
    const shifted=map.containerPointToLatLng(L.point(origin.x+Math.cos(angle)*radius,origin.y+Math.sin(angle)*radius));
    return [shifted.lat,shifted.lng];
  }
  function fallbackBusScale() {
    if(!fallbackSvg)return .65;
    const width=fallbackSvg.clientWidth||390,height=fallbackSvg.clientHeight||700;
    const pxPerUnit=Math.min(width/(fallbackView.w||926),height/(fallbackView.h||690));
    return Math.max(.45,Math.min(4,22/(28*(pxPerUnit||.4))));
  }
  function clusteredFallbackPoint(bus, pos, now) {
    if(!fallbackSvg||!fallbackProject) return fallbackProject?fallbackProject(pos.lat,pos.lng):[0,0];
    const origin=fallbackProject(pos.lat,pos.lng),screenScale=Math.min((fallbackSvg.clientWidth||390)/(fallbackView.w||926),(fallbackSvg.clientHeight||700)/(fallbackView.h||690));
    const nearby=[];
    BUSES.forEach(other=>{
      const otherPos=other===bus?pos:(other.currentLatLng||currentBusPosition(other,now));
      const point=fallbackProject(otherPos.lat,otherPos.lng);
      if(Math.hypot((point[0]-origin[0])*screenScale,(point[1]-origin[1])*screenScale)<20) nearby.push({bus:other,point});
    });
    if(nearby.length<2)return {x:origin[0],y:origin[1]};
    nearby.sort((a,b)=>a.bus.id.localeCompare(b.bus.id));
    const index=nearby.findIndex(item=>item.bus===bus),angle=Math.PI*2*index/nearby.length;
    const radius=(nearby.length===2?13:15)/(screenScale||.4);
    return {x:origin[0]+Math.cos(angle)*radius,y:origin[1]+Math.sin(angle)*radius};
  }
  function updateBusPosition(bus, now=performance.now(), force=false) {
    const pos=currentBusPosition(bus,now);
    bus.currentLatLng={lat:pos.lat,lng:pos.lng};
    const targetHeading=((pos.heading%360)+360)%360;
    if(!Number.isFinite(bus.displayHeading)) bus.displayHeading=targetHeading;
    const headingDelta=((targetHeading-bus.displayHeading+540)%360)-180;
    const headingAlpha=1-Math.exp(-Math.max(0,now-(bus.lastRenderAt||now))/210);
    bus.displayHeading=((bus.displayHeading+headingDelta*headingAlpha)%360+360)%360;
    bus.lastRenderAt=now; bus.heading=bus.displayHeading;
    const smoothPos={...pos,heading:bus.displayHeading};
    if(!bus.marker){
      if(!map && fallbackProject){const node=fallbackBusNodes[bus.id];if(node){const display=clusteredFallbackPoint(bus,smoothPos,now);node.setAttribute('transform',`translate(${display.x} ${display.y}) rotate(${bus.displayHeading}) scale(${fallbackBusScale()})`);node.setAttribute('opacity','1');node.style.pointerEvents='auto';}}
      return;
    }
    bus.marker.setLatLng(clusteredMapMarkerPosition(bus,smoothPos,now));
    const selected=bus.id===selectedBusId, status=busStatus(bus);
    if(bus.renderedStatus!==status || bus.renderedSelected!==selected){
      bus.marker.setIcon(busDivIcon(bus,selected));bus.renderedStatus=status;bus.renderedSelected=selected;
      bus.marker.setZIndexOffset(selected?1800:1000);
    }
    const el=bus.marker.getElement();
    if(el){
      const inner=el.querySelector('.bus-marker');
      if(inner){
        inner.style.setProperty('--heading',`${bus.displayHeading}deg`);
        inner.classList.toggle('is-selected',selected);
        // Keep moving the SVG every frame, but refresh its ETA text only twice a second.
        if(!bus.labelUpdateAt||now-bus.labelUpdateAt>1800){
          const label=inner.querySelector('.bus-label');
          if(label){const mins=nextStopInfo(bus,now).eta;label.textContent=Number.isFinite(mins)?`${Math.max(1,Math.round(mins))} min`:'—';}
          bus.labelUpdateAt=now;
        }
      }
    }
    // Deliberately do not draw any line from this vehicle to the user's location.
    // Keep every vehicle visible while tracking; selection changes stacking/highlight, not visibility.
    bus.marker.setOpacity(1);
    if(el) el.style.pointerEvents='auto';
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

  function currentDirection(bus, now=performance.now()) {
    const route=routeOf(bus), distance=bus.external && Number.isFinite(bus.distance) ? bus.distance : busDistance(bus,now);
    return distance <= (route.outboundEndMeters || 0) ? route.patterns?.[0] : route.patterns?.[1];
  }
  function tripEtaInfo(bus, pickupId=tripPickupId, destinationId=tripDestinationId, now=performance.now()) {
    const route=routeOf(bus);
    if(!route?.plannerEnabled || !pickupId || !destinationId || pickupId===destinationId || !route.nodes?.length || !route.totalMeters) return null;
    const curr=bus.external && Number.isFinite(bus.distance) ? bus.distance : busDistance(bus,now);
    const total=route.totalMeters;
    const metersPerMinute=total/(route.cycleMs/60000);
    let best=null;
    for(const pattern of (route.patterns||[])) {
      for(let pickupIndex=0;pickupIndex<pattern.stopIds.length-1;pickupIndex++) {
        if(pattern.stopIds[pickupIndex]!==pickupId) continue;
        const destinationIndex=pattern.stopIds.findIndex((id,i)=>i>pickupIndex && id===destinationId);
        if(destinationIndex<0) continue; // destination is not downstream in this direction
        const nodeIndex=pattern.nodeStart+pickupIndex;
        const node=route.nodes[nodeIndex];
        if(!node) continue;
        let delta=(node.meters-curr+total)%total;
        if(delta<2) delta=.5;
        const eta=delta/(metersPerMinute||1);
        const candidate={eta,delta,node,nodeIndex,pattern,pickupId,destinationId,destinationIndex};
        if(!best||candidate.eta<best.eta) best=candidate;
      }
    }
    return best;
  }
  function routeCanServeTrip(bus,pickupId,destinationId) { return !!tripEtaInfo(bus,pickupId,destinationId); }

  function renderHomeBusList() {
    const list=$('#homeBusList');
    if(!list) return;
    const ordered=(selectedServicePattern==='all'?BUSES.slice():getVisibleBuses()).sort((a,b)=>nextStopInfo(a).eta-nextStopInfo(b).eta);
    list.innerHTML=ordered.length?ordered.map(bus=>{
      const route=routeOf(bus),next=nextStopInfo(bus),direction=currentDirection(bus)?.label||'';
      const provisional=route.provisional?' · route pattern to confirm':'';
      return `<button class="home-bus-card" type="button" data-open-bus="${bus.id}">
        <span class="mini-bus-icon">${busSvg('available',route.color)}</span><span class="home-bus-main"><strong>${escapeHtml(bus.name)}</strong><span>${escapeHtml(route.name)} · ${escapeHtml(direction)}${provisional}</span></span><span class="home-bus-eta"><strong>${Number.isFinite(next.eta)?etaLabel(next.eta):'—'}</strong><span>next checkpoint</span></span>
      </button>`;
    }).join(''):`<div class="search-empty trip-empty">No demo shuttle is currently travelling in this direction. All vehicles remain visible on the map.</div>`;
    list.querySelectorAll('[data-open-bus]').forEach(btn=>btn.addEventListener('click',()=>openBusDetail(btn.dataset.openBus)));
    $('#mapActivity').textContent=`${BUSES.length} shuttles on the map`;
    if($('#shuttleCountSummary')) $('#shuttleCountSummary').textContent=selectedServicePattern==='all'?`${BUSES.length} shuttles on the map`:`${ordered.length} matching shuttles`;
    if($('#seatCountSummary')) $('#seatCountSummary').textContent=selectedServicePattern==='all'?'All services':`${ordered.length} matching`;
  }

  function initTripPlanner() {
    const select=$('#servicePatternSelect');
    if(!select) return;
    const options=['<option value="all">All shuttle services</option>'];
    Object.values(ROUTES).forEach(route=>{
      options.push(`<option value="${route.id}:outbound">${escapeHtml(STOP_BY_ID.get(route.outboundStopIds[0])?.short||route.outboundDirection||'Outbound')} → ${escapeHtml(STOP_BY_ID.get(route.outboundStopIds.at(-1))?.short||'Destination')}${route.provisional?' · route to confirm':''}</option>`);
      options.push(`<option value="${route.id}:return">${escapeHtml(STOP_BY_ID.get(route.returnStopIds[0])?.short||route.returnDirection||'Return')} → ${escapeHtml(STOP_BY_ID.get(route.returnStopIds.at(-1))?.short||'Origin')}${route.provisional?' · route to confirm':''}</option>`);
    });
    select.innerHTML=options.join(''); select.value=selectedServicePattern;
    select.addEventListener('change',()=>{
      selectedServicePattern=select.value;
      const matches=getVisibleBuses();
      $('#servicePatternNote').textContent=selectedServicePattern==='all'?'All shuttles remain visible on the map. Tap a vehicle to highlight its service route and see the next checkpoint ETA.':matches.length?`${matches.length} shuttle${matches.length===1?'':'s'} currently travelling in this route direction. ETA follows the ordered checkpoints.`:'No demo shuttle is currently travelling in this direction. All vehicles remain visible on the map.';
      renderHomeBusList();
      if($('#shuttleCountSummary')) $('#shuttleCountSummary').textContent=selectedServicePattern==='all'?`${BUSES.length} shuttles on the map`:`${matches.length} matching shuttles`;
    });
  }
  function getVisibleBuses() {
    if(!selectedServicePattern||selectedServicePattern==='all') return BUSES.slice();
    const [routeId,patternKey]=selectedServicePattern.split(':');
    return BUSES.filter(bus=>bus.routeId===routeId && currentDirection(bus)?.key===patternKey);
  }

  function renderQuickCheckpoints() {
    $('#quickCheckpoints').innerHTML=STOPS.map(stop=>`<button type="button" class="quick-checkpoint" data-open-stop="${stop.id}">${escapeHtml(stop.short)}</button>`).join('');
    $$('#quickCheckpoints [data-open-stop]').forEach(btn=>btn.addEventListener('click',()=>openStopDetail(btn.dataset.openStop)));
  }
  function nearestStop() { return STOP_BY_ID.get(lastNearestId)||STOP_BY_ID.get('conti'); }
  function findNearestStop() {
    const from=userLatLng?[userLatLng.lat,userLatLng.lng]:CAMPUS_CENTER;
    let nearest=STOPS[0],dist=Infinity;
    STOPS.filter(stop=>stop.confidence!=='candidate').forEach(stop=>{const d=haversine(from,[stop.lat,stop.lng]);if(d<dist){dist=d;nearest=stop;}});
    lastNearestId=nearest.id;
    if($('#shuttleCountSummary')) $('#shuttleCountSummary').textContent=`${BUSES.length} shuttles on the map`;
    if($('#seatCountSummary')) $('#seatCountSummary').textContent=selectedServicePattern==='all'?'All services':`${getVisibleBuses().length} matching`;
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

  function fallbackAspect() {
    if(!fallbackSvg)return 1100/820;
    const rect=fallbackSvg.getBoundingClientRect();
    return rect.width>0&&rect.height>0?Math.max(.35,Math.min(2.5,rect.width/rect.height)):1100/820;
  }
  function setFallbackView(view) {
    if(!fallbackSvg)return;
    // Match the live viewport aspect ratio. Forcing a landscape viewBox into a portrait phone
    // cropped all buses at the sides of the offline campus schematic.
    const aspect=fallbackAspect();
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
    const aspect=fallbackAspect();
    const xSpan=Math.max(maxX-minX,260),ySpan=Math.max(maxY-minY,200);
    const w=Math.min(1350,Math.max(340,Math.max(xSpan,ySpan*aspect)*1.28));
    setFallbackView({cx:(minX+maxX)/2,cy:(minY+maxY)/2,w});
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
    trackingBusId=bus.id;routeVisibility=true;followSelectedBus=false;
    $('#sheetHome').hidden=true;$('#sheetDetail').hidden=false;
    $('#busDetailView').hidden=false;$('#stopDetailView').hidden=true;
    $('#detailEyebrow').textContent='SHUTTLE TRACKING';
    $('#detailTitle').textContent=bus.name;
    $('#detailSubtitle').textContent=`${routeOf(bus).name}${currentDirection(bus)?.label?' · '+currentDirection(bus).label:''}${routeOf(bus).provisional?' · provisional pattern':''}`;
    $('#detailBell').style.visibility='hidden';
    updateSelectionVisuals();renderBusDetail();
    setSheetState('detail');
    Object.keys(ROUTES).forEach(styleRoute);
    clearApproachRoute();
    focusTrackedVehicles(true);lastTrackMapTick=performance.now();
  }
  function nearestMappedPlace(lat,lng) {
    const all=[...PLACES.map(place=>({name:place.name,lat:place.lat,lng:place.lng})),...STOPS.map(stop=>({name:stop.short,lat:stop.lat,lng:stop.lng}))];
    let best=all[0],dBest=Infinity;
    all.forEach(item=>{const d=haversine([lat,lng],[item.lat,item.lng]);if(d<dBest){dBest=d;best=item;}});
    return {name:best.name,distance:dBest};
  }

  function renderBusDetail() {
    const bus=BUSES.find(b=>b.id===selectedBusId);if(!bus)return;
    const route=routeOf(bus),status=busStatus(bus),next=nextStopInfo(bus),direction=currentDirection(bus);
    $('#detailBusIcon').innerHTML=busSvg(status, routeOf(bus).color);
    $('#detailBusName').textContent=bus.name;
    const pos=bus.currentLatLng||currentBusPosition(bus),near=nearestMappedPlace(pos.lat,pos.lng);
    $('#busLiveLocation').textContent=near.distance<500?`Near ${near.name}`:`Around ${near.name}`;
    const eta=next.eta;
    const etaText=`${Math.max(1,Math.round(eta))} min away`;
    $('#busEtaToYou').textContent=etaText;
    if($('#heroEta'))$('#heroEta').textContent=etaText;
    if($('#heroRouteLabel'))$('#heroRouteLabel').textContent=`${bus.name} · ${route.name}${direction?.label?' · '+direction.label:''}`;
    if($('#pickupKind'))$('#pickupKind').textContent='NEXT CHECKPOINT';
    if($('#pickupTargetName'))$('#pickupTargetName').textContent=next.stop?.short||'Next checkpoint';
    if($('#pickupTargetHelp'))$('#pickupTargetHelp').textContent='ETA follows this shuttle’s checkpoint order and direction, not straight-line distance.';
    $('#busFeedStatus').textContent=bus.external&&Date.now()-bus.telemetryAt<12000?'Location connected':'Demo route movement';
    $('#centerSelected').innerHTML=((followSelectedBus&&trackingBusId===bus.id)?'Following shuttle':'Follow shuttle')+' <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="7.5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 1.5v3m0 15v3m-10.5-10.5h3m15 0h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';
    $('#centerSelected').classList.toggle('is-active',trackingBusId===bus.id&&followSelectedBus);
    if($('#seatStatus')) { $('#seatStatus').classList.remove('is-full'); $('#seatStatus').innerHTML='<i></i><span>Route active</span>'; }
    if($('#detailServiceDirection')) $('#detailServiceDirection').textContent=direction?.label||'Service route';
    if($('#servicePatternDetail')) $('#servicePatternDetail').textContent=route.name;
    $('#detailRouteDot').style.background=route.color;
    $('#checkpointTimeline').innerHTML=nextStopsFor(bus,6).map((item,i)=>`<div class="timeline-stop ${i===0?'is-next':''} ${i>0?'is-upcoming':''}"><span class="timeline-node">${i===0?'•':''}</span><span class="timeline-stop-copy"><strong>${escapeHtml(item.stop.short)}</strong><small>${i===0?'Next checkpoint':route.name}</small></span><span class="timeline-time">${etaLabel(item.eta)}</span></div>`).join('');
    $('#mapActivity').textContent=`${BUSES.length} shuttles on the move`;
  }
  function openStopDetail(id) {
    const stop=STOP_BY_ID.get(id);if(!stop)return;
    screenMode='stop';selectedStopId=id;trackingBusId=null;routeVisibility=false;followSelectedBus=false;clearApproachRoute();Object.keys(ROUTES).forEach(styleRoute);
    $('#sheetHome').hidden=true;$('#sheetDetail').hidden=false;
    $('#busDetailView').hidden=true;$('#stopDetailView').hidden=false;
    $('#detailEyebrow').textContent='CHECKPOINT';$('#detailTitle').textContent=stop.short;
    const routeCount=Object.values(ROUTES).filter(r=>r.stopOrder?.includes(id)||r.stopIds.includes(id)).length;
    $('#detailSubtitle').textContent=`${routeCount} ${routeCount===1?'route':'routes'} serve this checkpoint`;
    $('#detailBell').style.visibility='visible';$('#detailBell').classList.toggle('is-active',alerts.has(id));
    $('#stopAlertButton').classList.toggle('is-active',alerts.has(id));
    $('#stopDetailName').textContent=stop.name;$('#stopDetailDescription').textContent=stop.description;
    renderStopArrivals();
    followSelectedBus=false;
    setSheetState('detail');
    if(map)map.panTo([stop.lat,stop.lng],{animate:true,duration:.45});else focusFallbackAt(stop.lat,stop.lng,390);
  }
  function renderStopArrivals() {
    const stop=STOP_BY_ID.get(selectedStopId);if(!stop)return;
    const arrivals=BUSES.map(bus=>({bus,eta:etaToStop(bus,stop.id)})).filter(x=>Number.isFinite(x.eta)).sort((a,b)=>a.eta-b.eta);
    $('#stopArrivalCount').textContent=arrivals.length?`${arrivals.length} shuttle${arrivals.length===1?'':'s'} on this route`:'No scheduled shuttles';
    $('#stopArrivalsList').innerHTML=arrivals.length?arrivals.slice(0,4).map(({bus,eta})=>`<button class="stop-arrival-card" type="button" data-open-bus="${bus.id}"><span class="mini-bus-icon">${busSvg(busStatus(bus), routeOf(bus).color)}</span><span class="stop-arrival-main"><strong>${escapeHtml(bus.name)} · ${escapeHtml(routeOf(bus).name)}</strong><small>${escapeHtml(currentDirection(bus)?.label||'Service route')} · next checkpoint ETA</small></span><span class="arrival-badge">${etaLabel(eta)}</span></button>`).join(''):'<div class="search-empty">No shuttle currently follows this checkpoint. Try another route.</div>';
    $$('#stopArrivalsList [data-open-bus]').forEach(btn=>btn.addEventListener('click',()=>openBusDetail(btn.dataset.openBus)));
    $('#stopAlertButton').classList.toggle('is-active',alerts.has(stop.id));$('#stopAlertButton').querySelector('span').textContent=alerts.has(stop.id)?'Alert on':'Alert me';
  }
  function closeDetail() {
    screenMode='home';selectedStopId=null;trackingBusId=null;routeVisibility=false;followSelectedBus=false;
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
    // The map fills its fixed parent; the sheet overlays it, so a resize/invalidate here only redraws tiles unnecessarily.
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
    let startY=null,startX=null,startHeight=0,lastY=0,lastTime=0,dragging=false,pointerId=null,startTarget=null,scrollTarget=null;
    const interactive='button,a,input,select,textarea,[role="button"],[data-no-sheet-drag]';
    sheet.addEventListener('pointerdown',event=>{
      if(event.button!==undefined&&event.button!==0)return;
      // Controls retain their click behaviour; the rest of the sheet can be dragged, not only the handle.
      if(event.target.closest(interactive)&&!event.target.closest('#sheetHandle'))return;
      // Expanded content can scroll natively; at its top/bottom edge, the same gesture can move the sheet.
      startY=event.clientY;startX=event.clientX;lastY=startY;lastTime=performance.now();
      startHeight=sheet.getBoundingClientRect().height;dragging=true;pointerId=event.pointerId;startTarget=event.target;scrollTarget=event.target.closest('.sheet-expanded-content');
      sheet.classList.add('is-dragging');sheet.style.transition='none';
      // Listen on document for the rest of the gesture; avoid pointer capture so normal handle clicks still fire.
    });
    document.addEventListener('pointermove',event=>{
      if(!dragging||startY===null||event.pointerId!==pointerId)return;
      const totalDy=startY-event.clientY,totalDx=event.clientX-startX;
      if(Math.abs(totalDx)>Math.abs(totalDy)*1.3){return;}
      if(scrollTarget&&sheetState==='expanded'&&Math.abs(totalDy)>6){
        const canScroll=totalDy>0
          ? scrollTarget.scrollTop+scrollTarget.clientHeight<scrollTarget.scrollHeight-1
          : totalDy<0&&scrollTarget.scrollTop>0;
        if(canScroll){dragging=false;startY=null;pointerId=null;startTarget=null;scrollTarget=null;sheet.classList.remove('is-dragging');sheet.style.height='';sheet.style.transition='';return;}
      }
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
      const tappedHandle=!!startTarget?.closest('#sheetHandle');
      dragging=false;startY=null;pointerId=null;startTarget=null;scrollTarget=null;sheet.classList.remove('is-dragging');sheet.style.transition='';
      if(Math.abs(dy)<10&&Math.abs(velocity)<.22){
        sheet.style.height='';sheet.style.transition='';
        // A tap on the handle remains reliable even on mobile browsers whose pointer gesture
        // suppresses the synthetic click. Swallow the following click to avoid a double toggle.
        if(tappedHandle){
          suppressSheetClick=true;
          if(sheetState==='collapsed')setSheetState(screenMode==='bus'?'detail':'raised');
          else if(sheetState==='raised'||sheetState==='detail')setSheetState('expanded');
          else setSheetState('collapsed');
          window.setTimeout(()=>{suppressSheetClick=false;},260);
        }
        return;
      }
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
    document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish);
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
    // Location updates only move the user's blue dot; they never create a shuttle-to-user route.
    if(followingUser)map.panTo([lat,lng],{animate:true,duration:.35});
  }
  function requestLocation(follow=false, quiet=false) {
    if(!navigator.geolocation){if(!quiet)showToast('Location is not available in this browser.');return;}
    followingUser=follow;
    if(follow)followSelectedBus=false;
    const locateButtons=[$('#locateButton'),$('#locateTop')];locateButtons.forEach(b=>b.classList.add('is-active'));
    navigator.geolocation.getCurrentPosition(pos=>{
      const firstFix = !userLatLng;
      updateLocation(pos.coords.latitude,pos.coords.longitude,pos.coords.accuracy);
      // Acquire and display the user's position on startup without snapping the map camera.
      // Only an explicit Find me action recentres the map.
      if(map && follow)map.setView([pos.coords.latitude,pos.coords.longitude],16,{animate:true});
      else if(!map && fallbackSvg && follow)focusFallbackAt(pos.coords.latitude,pos.coords.longitude,360);
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
    trackingBusId=bus.id;routeVisibility=true;followSelectedBus=true;
    Object.keys(ROUTES).forEach(styleRoute);updateSelectionVisuals();
    clearApproachRoute();focusTrackedVehicles(true);lastTrackMapTick=performance.now();lastFollowPanAt=performance.now();
    renderBusDetail();setSheetState('detail');
    showToast(`Following ${bus.name}`);
  }

  function focusTrackedVehicles(animate=false) {
    if(!trackingBusId)return;
    const bus=BUSES.find(item=>item.id===trackingBusId);if(!bus)return;
    const p=bus.currentLatLng||currentBusPosition(bus), routePoints=directionalRouteGeometry(bus);
    if(map){
      // Frame the route this bus is actually travelling, not the user location or the entire fleet.
      const points=(routePoints.length?routePoints:[[p.lat,p.lng]]).map(pair=>Array.isArray(pair)?pair:[pair.lat,pair.lng]);
      if(points.length>1){
        map.fitBounds(L.latLngBounds(points),{paddingTopLeft:[42,64],paddingBottomRight:[42,window.innerWidth<=760?Math.min(290,window.innerHeight*.36):80],maxZoom:window.innerWidth<=760?15.4:16.0,animate,duration:.5});
      } else map.setView([p.lat,p.lng],Math.min(map.getZoom(),15.4),{animate,duration:.5});
    }else if(fallbackSvg){fitFallbackToPoints(routePoints.length?routePoints:[[p.lat,p.lng]]);}
  }

  function fitFleetOverview(animate=false) {
    const primaryStopIds=['commercial','conti','science','ksb','caselyHayford','prempeh','brunei','gaza','medicalVillage'];
    const points=[
      ...BUSES.map(bus=>bus.currentLatLng||currentBusPosition(bus)).map(pos=>[pos.lat,pos.lng]),
      ...primaryStopIds.map(id=>STOP_BY_ID.get(id)).filter(Boolean).map(stop=>[stop.lat,stop.lng])
    ].filter(pair=>pair.every(Number.isFinite));
    if(map&&points.length){
      map.fitBounds(L.latLngBounds(points),{
        paddingTopLeft:[25,56],paddingBottomRight:[25,window.innerWidth<=760?Math.min(235,window.innerHeight*.30):50],
        maxZoom:window.innerWidth<=760?13.8:14.8,animate,duration:.45
      });
    }else if(fallbackSvg&&points.length) fitFallbackToPoints(points);
  }

  function keepTrackedBusInView() {
    if(!map||!trackingBusId||!followSelectedBus)return;
    const now=performance.now();
    if(now-lastFollowPanAt<1350)return;
    if(map._panAnim?._inProgress)return;
    const bus=BUSES.find(item=>item.id===trackingBusId);if(!bus?.currentLatLng)return;
    const p=map.latLngToContainerPoint([bus.currentLatLng.lat,bus.currentLatLng.lng]),size=map.getSize();
    const sheetHeight=$('#bottomSheet').getBoundingClientRect().height;
    const safeBottom=Math.max(120,sheetHeight+22),top=70,left=Math.min(94,size.x*.20),right=size.x-Math.min(94,size.x*.20),bottom=size.y-safeBottom;
    // Stay still while the vehicle is comfortably in view. Pan only when it exits the inset frame.
    if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)return;
    const targetX=Math.min(right-8,Math.max(left+8,p.x)),targetY=Math.min(bottom-12,Math.max(top+12,p.y));
    const dx=p.x-targetX,dy=p.y-targetY;
    if(Math.abs(dx)<22&&Math.abs(dy)<22)return;
    lastFollowPanAt=now;
    map.panBy([dx,dy],{animate:true,duration:.62,easeLinearity:.16});
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
    lastTelemetryUpdate=now;
    const hasFreshFeed=BUSES.some(bus=>bus.external&&Date.now()-bus.telemetryAt<12000);
    $('#lastUpdate').textContent=hasFreshFeed?'Live updates just now':'Demo simulation';
    findNearestStop();
    if(screenMode==='bus' && now-lastUiRefresh>1400){renderBusDetail();lastUiRefresh=now;} else if(screenMode==='stop' && now-lastUiRefresh>1600){renderStopArrivals();lastUiRefresh=now;}
  }
  function animationFrame(now) {
    BUSES.forEach(bus=>updateBusPosition(bus,now));
    if(trackingBusId && now-lastTrackMapTick>850){keepTrackedBusInView();lastTrackMapTick=now;}
    // Selected route highlighting is static geometry; no bus-to-user routing requests are made.
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
    BUSES.forEach(bus=>{if(!q||`${bus.name} ${bus.id} ${routeOf(bus).name}`.toLowerCase().includes(q))items.push({type:'bus',id:bus.id,title:bus.name,subtitle:routeOf(bus).name,icon:busSvg(busStatus(bus), routeOf(bus).color)});});
    STOPS.forEach(stop=>{if(!q||`${stop.name} ${stop.short}`.toLowerCase().includes(q))items.push({type:'stop',id:stop.id,title:stop.short,subtitle:stop.confidence==='candidate'?'Candidate stop · verify on campus':'Shuttle checkpoint',icon:pinSvg});});
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
    const busGroup=BUSES.map(bus=>{const pos=currentBusPosition(bus,performance.now());const [x,y]=point(pos.lat,pos.lng);return `<g class="local-fallback-bus" data-open-bus="${bus.id}" data-bus-pos="${bus.id}" transform="translate(${x} ${y}) rotate(${pos.heading}) scale(.65)" role="button" tabindex="0" aria-label="${escapeHtml(bus.name)}">${busSvg(busStatus(bus), routeOf(bus).color).replace('<svg viewBox="0 0 28 58"','<svg x="-14" y="-29" width="28" height="58" viewBox="0 0 28 58"')}<title>${escapeHtml(bus.name)}</title></g>`;}).join('');
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
    $('#mapActivity').textContent=`${BUSES.length} shuttles on the map`;
    if($('#mapAttribution'))$('#mapAttribution').innerHTML='Campus schematic · checkpoint locations based on mapped features';
  }

  function bindEvents() {
    // Map gestures are intentionally uncluttered; native trackpad/touch zoom remains available.
    $('#zoomIn').addEventListener('click',()=>{followSelectedBus=false;if(map)map.zoomIn();else zoomFallback(.78);});$('#zoomOut').addEventListener('click',()=>{followSelectedBus=false;if(map)map.zoomOut();else zoomFallback(1.28);});
    $('#fitCampus').addEventListener('click',()=>{followSelectedBus=false;if(map)focusRoute('all',true);else fitFallbackToPoints(STOPS.map(stop=>[stop.lat,stop.lng]));});
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
      // Render stable base layers first. Fetch road geometry once, then start movement so buses never jump
      // from straight checkpoint chords to a newly routed road polyline while the animation is running.
      drawRouteLayers();addMapMarkers();
    } else initLocalFallback();
    bindEvents();initTripPlanner();renderQuickCheckpoints();findNearestStop();
    connectExternalFeed();
    const clock=()=>{const fresh=BUSES.some(bus=>bus.external&&Date.now()-bus.telemetryAt<12000);$('#lastUpdate').textContent=fresh?'Live location updates':'Demo vehicle movement';};clock();setInterval(clock,5000);
    if(navigator.geolocation){setTimeout(()=>requestLocation(false,true),1200);}
    const startMotion=()=>{
      mapReadyForMotion=true;
      BUSES.forEach(bus=>updateBusPosition(bus,performance.now(),true));
      // Start in a fleet overview. Selecting a bus highlights its route, but does not hijack the camera.
      if(screenMode==='home'){
        selectedBusId=null;trackingBusId=null;routeVisibility=false;followSelectedBus=false;
        updateSelectionVisuals();renderRouteVisibility();renderHomeBusList();setSheetState('raised');
      }else {
        const active=BUSES.find(bus=>bus.id===selectedBusId);
        if(active&&trackingBusId)clearApproachRoute();
      }
      requestAnimationFrame(animationFrame);
    };
    if(map){fitFleetOverview(false);startMotion();loadRoadGeometry().catch(()=>showToast('Using checkpoint geometry while road routing is unavailable.'));}
    else { fitFleetOverview(false);startMotion(); }
    if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('service-worker.js').catch(()=>{});
  }
  boot();
})();
