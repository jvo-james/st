/* KNUST Shuttle offline-safe schematic map.
 * Used only when all external Leaflet CDN sources are unavailable.
 * Positions are grounded in the app's campus latitude/longitude dataset;
 * roads/building footprints are intentionally a fallback schematic, not survey data.
 */
(function () {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const features = [
    {id:'conti',name:'Conti Roundabout',lat:6.67920,lng:-1.57083,type:'stop',detail:'A major campus interchange near Unity Hall and Paa Joe Stadium.',accuracy:'mapped'},
    {id:'pentecost',name:'Pentecost Bus Stop',lat:6.67457,lng:-1.56755,type:'stop',detail:'Campus stop serving the academic and residential areas.',accuracy:'mapped'},
    {id:'business',name:'Business School / KSB Stop',lat:6.66932,lng:-1.56716,type:'stop',detail:'The mapped Business School and KSB stop location on P.V. Obeng Avenue.',accuracy:'mapped'},
    {id:'brunei',name:'Brunei Bus Stop',lat:6.67115,lng:-1.57435,type:'stop',detail:'Approximate position near hostels and GUSSS Sports Complex.',accuracy:'approximate'},
    {id:'ccb',name:'CCB Bus Stop',lat:6.67592,lng:-1.56522,type:'stop',detail:'Approximate stop placement beside the CCB Bush Canteen / FoSS Library area.',accuracy:'approximate'},
    {id:'steps',name:'Steps Bus Stop',lat:6.67515,lng:-1.56570,type:'stop',detail:'Approximate position within the CCB / FoSS academic area.',accuracy:'approximate'},
    {id:'commercial',name:'Commercial Area Shuttle Stop',lat:6.68340,lng:-1.57566,type:'stop',detail:'Approximate pickup point within the Commercial Area.',accuracy:'approximate'},
    {id:'botanical',name:'KNUST Botanical Garden',lat:6.68150,lng:-1.56570,type:'landmark',detail:'The university botanical garden and green space.',accuracy:'mapped'},
    {id:'unity',name:'Unity Hall',lat:6.67953,lng:-1.57186,type:'landmark',detail:'A well-known student residence close to Conti Roundabout.',accuracy:'mapped'},
    {id:'republic',name:'Republic Hall',lat:6.67852,lng:-1.57402,type:'landmark',detail:'Student residence on the central-west side of campus.',accuracy:'mapped'},
    {id:'queens',name:'Queen Elizabeth II Hall',lat:6.67661,lng:-1.57446,type:'landmark',detail:'Queen Elizabeth II Hall and the nearby Royal Parade Ground.',accuracy:'mapped'},
    {id:'great-hall',name:'The Old Great Hall',lat:6.68115,lng:-1.57413,type:'landmark',detail:'The older Great Hall / central university landmark.',accuracy:'mapped'},
    {id:'library',name:'KNUST Library Mall',lat:6.67737,lng:-1.56627,type:'landmark',detail:'A campus library-area feature.',accuracy:'mapped'},
    {id:'gusss',name:'GUSSS Sports Complex',lat:6.66958,lng:-1.57568,type:'landmark',detail:'University sports facilities near Brunei Bus Stop.',accuracy:'mapped'},
    {id:'ccb-canteen',name:'CCB Bush Canteen',lat:6.67576,lng:-1.56490,type:'landmark',detail:'A mapped food spot by Evans Anfom Auditorium and FoSS Library.',accuracy:'mapped'}
  ];
  const byId = new Map(features.map(item => [item.id, item]));
  const routes = {
    green:{id:'green',name:'Halls ↔ Academic Core',short:'HALLS–CORE',color:'#167a62',path:['brunei','business','pentecost','library','conti','unity','republic','queens','brunei'],cycle:780000},
    blue:{id:'blue',name:'Commercial ↔ Academic Loop',short:'CAMPUS LOOP',color:'#397bd0',path:['commercial','great-hall','conti','botanical','library','pentecost','ccb','steps','commercial'],cycle:900000},
    amber:{id:'amber',name:'Residence Connector',short:'RESIDENCE',color:'#bf852a',path:['brunei','gusss','queens','republic','unity','conti','pentecost','ccb','brunei'],cycle:840000}
  };
  const buses = [
    {id:'K-01',name:'Shuttle K-01',routeId:'green',occupancy:12,capacity:18,offset:.11},
    {id:'K-02',name:'Shuttle K-02',routeId:'blue',occupancy:7,capacity:18,offset:.42},
    {id:'K-03',name:'Shuttle K-03',routeId:'amber',occupancy:15,capacity:20,offset:.68},
    {id:'K-04',name:'Shuttle K-04',routeId:'green',occupancy:4,capacity:18,offset:.78}
  ];
  const bounds = {north:6.689, south:6.664, west:-1.584, east:-1.557};
  const svgNS = 'http://www.w3.org/2000/svg';
  const icon = {
    bus:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7.2 2.6h9.6c2.2 0 3.2 1.4 3.2 3.5v11.3c0 1.1-.8 2-1.9 2h-.5v1.1a1.3 1.3 0 0 1-2.6 0v-1.1H9v1.1a1.3 1.3 0 0 1-2.6 0v-1.1h-.5c-1.1 0-1.9-.9-1.9-2V6.1c0-2.1 1-3.5 3.2-3.5Z" fill="currentColor"/><path d="M6.5 6.5c0-.7.5-1.2 1.2-1.2h8.6c.7 0 1.2.5 1.2 1.2v4H6.5v-4Z" fill="#16332b"/><path d="M7 13h10v2.7H7z" fill="#fff"/><circle cx="7.5" cy="17" r="1" fill="#142722"/><circle cx="16.5" cy="17" r="1" fill="#142722"/></svg>',
    stop:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 10c0 5.2-8 11-8 11S4 15.2 4 10a8 8 0 1 1 16 0Z" stroke="currentColor" stroke-width="1.9"/><circle cx="12" cy="10" r="2.5" stroke="currentColor" stroke-width="1.9"/></svg>',
    landmark:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 9 9-5 9 5M5.5 10v8m4.3-8v8m4.4-8v8m4.3-8v8M3.5 20h17M2.5 9.5h19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    clock:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 7v5l3 2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    users:'<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3" stroke="currentColor" stroke-width="1.7"/><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M16 5.5a3 3 0 0 1 0 5.8M17 13.5a4 4 0 0 1 3.5 4V19" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>'
  };
  let selectedBusId = 'K-01';
  let selectedFeatureId = null;
  let currentTab = 'shuttles';
  let searchTerm = '';
  let routesVisible = true;
  let darkMap = false;
  let zoom = 1, panX = 0, panY = 0;
  let userMarker = null, watchId = null, followLocation = false;
  let toastTimer;
  let lastCardUpdate = 0;

  function xy(point) { return { x:(point.lng-bounds.west)/(bounds.east-bounds.west)*1400, y:(bounds.north-point.lat)/(bounds.north-bounds.south)*1000 }; }
  function pathFor(ids) { return ids.map(id => { const p = xy(byId.get(id)); return `${p.x.toFixed(1)},${p.y.toFixed(1)}`; }).join(' '); }
  function dist(a,b) { const r=Math.PI/180, d1=(b.lat-a.lat)*r, d2=(b.lng-a.lng)*r; const h=Math.sin(d1/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(d2/2)**2; return 6371000*2*Math.asin(Math.min(1,Math.sqrt(h))); }
  function notify(message, ms=3100) { const toast=$('#toast'); toast.textContent=message; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),ms); }
  function routeFor(bus) { return routes[bus.routeId]; }
  function motionFor(bus, now) {
    const route=routeFor(bus), pts=route.path.map(id=>byId.get(id));
    const segs=[]; let total=0;
    for(let i=0;i<pts.length-1;i++){const d=dist(pts[i],pts[i+1]);segs.push(d);total+=d;}
    const travelled=((now+bus.offset*route.cycle)%route.cycle)/route.cycle*total;
    let rem=travelled, leg=0;
    while(leg<segs.length-1 && rem>=segs[leg]){rem-=segs[leg];leg++;}
    const t=Math.max(0,Math.min(1,rem/Math.max(segs[leg],1))), a=pts[leg], b=pts[leg+1];
    const pos={lat:a.lat+(b.lat-a.lat)*t,lng:a.lng+(b.lng-a.lng)*t};
    const dx=(b.lng-a.lng)*Math.cos(pos.lat*Math.PI/180), dy=b.lat-a.lat;
    const bearing=(Math.atan2(dx,dy)*180/Math.PI+360)%360;
    return {pos,bearing,next:route.path[leg+1]||route.path[0],eta:Math.max(1,Math.ceil((segs[leg]*(1-t))/Math.max(total/(route.cycle/1000),1)/60)),leg};
  }
  function node(tag, attrs={}, text) { const el=document.createElementNS(svgNS,tag); Object.entries(attrs).forEach(([key,val])=>el.setAttribute(key,String(val))); if(text!==undefined)el.textContent=text; return el; }
  function buildMap() {
    const root=$('#map'); root.innerHTML=''; root.classList.add('offline-map-mode');
    const svg=node('svg',{class:'fallback-map-svg',viewBox:'0 0 1400 1000',preserveAspectRatio:'xMidYMid slice',role:'img','aria-label':'KNUST campus schematic map. Map tiles could not load.'});
    const defs=node('defs');
    const grad=node('linearGradient',{id:'mapPaper',x1:'0',y1:'0',x2:'1',y2:'1'});grad.append(node('stop',{offset:'0%','stop-color':'#f5f5ee'}));grad.append(node('stop',{offset:'100%','stop-color':'#e8efe5'}));defs.append(grad);
    const pattern=node('pattern',{id:'mapDots',width:25,height:25,patternUnits:'userSpaceOnUse'});pattern.append(node('circle',{cx:2,cy:2,r:1,fill:'#d9e1d7'}));defs.append(pattern);svg.append(defs);
    const scene=node('g',{id:'mapScene'});svg.append(scene);
    scene.append(node('rect',{x:0,y:0,width:1400,height:1000,fill:'url(#mapPaper)'}));
    scene.append(node('rect',{x:0,y:0,width:1400,height:1000,fill:'url(#mapDots)',opacity:.48}));
    // Parks and greenspaces anchored around the campus features.
    scene.append(node('path',{d:'M760 -20 L1060 -20 L1205 205 L1115 400 L900 425 L785 275 Z',fill:'#d5e8cd',stroke:'#c2d9ba','stroke-width':3}));
    scene.append(node('path',{d:'M-30 700 L195 625 L390 720 L345 1040 L-30 1040 Z',fill:'#dce9d4',stroke:'#cbdcc4','stroke-width':3}));
    scene.append(node('path',{d:'M900 610 L1120 575 L1290 710 L1200 920 L920 860 Z',fill:'#e0ecd7',stroke:'#cbdcc4','stroke-width':3}));
    // Soft terrain contours.
    for(let i=0;i<4;i++) scene.append(node('path',{d:`M${80+i*65} ${150+i*8} C${300+i*40} ${50+i*28},${550+i*28} ${280+i*15},${700+i*30} ${180+i*18} S${1050+i*30} ${70+i*20},${1320} ${150+i*18}`,fill:'none',stroke:'#dce5d8','stroke-width':2,opacity:.7}));
    // Draw a plausible campus road grid; mapped landmark points remain the reference anchors.
    const roadPaths=[
      {coords:[[6.688,-1.585],[6.686,-1.578],[6.685,-1.570],[6.687,-1.561]],major:true},
      {ids:['commercial','great-hall','conti','unity','botanical'],major:true},
      {ids:['business','pentecost','library','ccb-canteen','ccb','steps','botanical']},
      {ids:['gusss','queens','republic','unity','conti']},
      {ids:['brunei','business','pentecost','ccb','brunei']},
      {ids:['great-hall','republic','queens','gusss']},
      {ids:['commercial','botanical','ccb','pentecost']},
      {coords:[[6.670,-1.583],[6.672,-1.578],[6.677,-1.578],[6.681,-1.580],[6.685,-1.576]]},
      {coords:[[6.684,-1.568],[6.679,-1.568],[6.675,-1.570],[6.670,-1.570],[6.666,-1.570]]},
      {coords:[[6.681,-1.563],[6.679,-1.565],[6.676,-1.563],[6.672,-1.564],[6.668,-1.563]]}
    ];
    roadPaths.forEach(r=>{const pts=r.ids?r.ids.map(id=>byId.get(id)):r.coords.map(([lat,lng])=>({lat,lng}));const line=pathForPoints(pts);scene.append(node('polyline',{points:line,fill:'none',stroke:'#d1d8d1','stroke-width':r.major?34:23,'stroke-linecap':'round','stroke-linejoin':'round'}));scene.append(node('polyline',{points:line,fill:'none',stroke:r.major?'#fff9eb':'#ffffff','stroke-width':r.major?26:16,'stroke-linecap':'round','stroke-linejoin':'round'}));if(r.major)scene.append(node('polyline',{points:line,fill:'none',stroke:'#eacb80','stroke-width':2,'stroke-dasharray':'8 13','stroke-linecap':'round'}));});
    // Compact building footprints around the mapped landmarks (schematic, not survey-grade).
    features.filter(f=>f.type==='landmark').forEach((f,i)=>{const p=xy(f),w=i%2?36:43,h=i%3?26:31;scene.append(node('rect',{x:p.x-w/2,y:p.y-h/2,width:w,height:h,rx:4,fill:i===0?'#a8d1a3':'#ded9cf',stroke:'#fff','stroke-width':4}));scene.append(node('rect',{x:p.x-w/2+5,y:p.y-h/2+5,width:w-10,height:h-10,rx:2,fill:'none',stroke:'#c0bbaa','stroke-width':1.4}));});
    // Places and stop labels are actual content labels, not guessed business names.
    const labels=[['unity','UNITY HALL',0,-41],['republic','REPUBLIC HALL',-45,-35],['queens','QUEEN ELIZABETH II HALL',45,34],['great-hall','OLD GREAT HALL',0,-42],['botanical','BOTANICAL GARDEN',5,-35],['library','LIBRARY MALL',-4,38],['gusss','GUSSS SPORTS COMPLEX',25,40],['ccb-canteen','CCB BUSH CANTEEN',35,35]];
    labels.forEach(([id,label,dx,dy])=>{const p=xy(byId.get(id)),w=label.length*7.1+22;const g=node('g',{transform:`translate(${p.x+dx} ${p.y+dy})`});g.append(node('rect',{x:-w/2,y:-14,width:w,height:28,rx:8,fill:'#fff','fill-opacity':.94,stroke:'#dce4dc','stroke-width':1.5}));g.append(node('text',{x:0,y:4,'text-anchor':'middle','font-size':12,'font-weight':800,'font-family':'Arial,sans-serif',fill:'#52675a'},label));scene.append(g);});
    // Layer groups keep the route, stop, landmark and bus symbols crisp and clickable.
    const routeLayer=node('g',{id:'fallbackRoutes',class:'fallback-routes'});scene.append(routeLayer);
    const featureLayer=node('g',{id:'fallbackFeatures'});scene.append(featureLayer);
    const busLayer=node('g',{id:'fallbackBuses'});scene.append(busLayer);
    const youLayer=node('g',{id:'fallbackUser'});scene.append(youLayer);
    root.append(svg);
    function pathForPoints(pts){return pts.map((f,i)=>{const p=xy(f);return `${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`}).join(' ').replace(/M/g,'').replace(/L/g,' ').trim();}
    function repaintFeatures(){featureLayer.innerHTML='';features.forEach(f=>{const p=xy(f),isStop=f.type==='stop';const g=node('g',{transform:`translate(${p.x} ${p.y})`,class:'fallback-point','data-feature-id':f.id,tabindex:0,role:'button','aria-label':f.name,style:'cursor:pointer'});
      if(isStop){g.append(node('circle',{r:17,fill:'#fff',stroke:'#397dc0','stroke-width':2.5}));g.append(node('circle',{r:9,fill:'#397dc0'}));g.append(node('circle',{r:3,fill:'#fff'}));}
      else {g.append(node('rect',{x:-12,y:-12,width:24,height:24,rx:8,fill:'#bb812a',stroke:'#fff','stroke-width':3}));g.append(node('path',{d:'M-6 3V-4L0-8 6-4V3M-4 -3V3M0 -3V3M4 -3V3',fill:'none',stroke:'#fff','stroke-width':1.6,'stroke-linecap':'round'}));}
      g.append(node('title',{},f.name));g.addEventListener('click',()=>selectFeature(f.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectFeature(f.id);}});featureLayer.append(g);});}
    function repaintRoutes(){routeLayer.innerHTML='';Object.values(routes).forEach(route=>{const pts=route.path.map(id=>byId.get(id)),g=node('g',{class:'fallback-route','data-route-id':route.id,style:`${routesVisible?'':'display:none'}`});const d=pts.map((f,i)=>{const p=xy(f);return `${i?'L':'M'}${p.x},${p.y}`}).join(' ');g.append(node('path',{d,fill:'none',stroke:'#fff','stroke-width':16,'stroke-linecap':'round','stroke-linejoin':'round',opacity:.94}));g.append(node('path',{d,fill:'none',stroke:route.color,'stroke-width':6,'stroke-linecap':'round','stroke-linejoin':'round','stroke-dasharray':selectedBusId&&buses.find(b=>b.id===selectedBusId).routeId!==route.id?'10 11':'none',class:'fallback-route-core'}));g.addEventListener('click',()=>{const bus=buses.find(b=>b.routeId===route.id);if(bus)selectBus(bus.id);});routeLayer.append(g);});}
    function repaintBuses(now=performance.now()){busLayer.innerHTML='';buses.forEach(bus=>{const m=motionFor(bus,now),p=xy(m.pos);bus.current=m;const g=node('g',{transform:`translate(${p.x} ${p.y})`,class:`fallback-bus${bus.id===selectedBusId?' selected':''}`,'data-bus-id':bus.id,tabindex:0,role:'button','aria-label':bus.name,style:'cursor:pointer'});g.append(node('circle',{r:26,fill:routeFor(bus).color,opacity:.12,class:'fallback-bus-halo'}));g.append(node('g',{transform:`rotate(${m.bearing})`}));const vehicle=node('g',{transform:`rotate(${m.bearing})`});vehicle.append(node('rect',{x:-16,y:-21,width:32,height:42,rx:11,fill:routeFor(bus).color,stroke:'#fff','stroke-width':4,filter:'url(#dropShadow)'}));vehicle.append(node('rect',{x:-10,y:-14,width:20,height:11,rx:3,fill:'#122b28',opacity:.9}));vehicle.append(node('rect',{x:-10,y:1,width:20,height:9,rx:3,fill:'#fff',opacity:.96}));vehicle.append(node('circle',{cx:-11,cy:14,r:2.5,fill:'#1c2b27'}));vehicle.append(node('circle',{cx:11,cy:14,r:2.5,fill:'#1c2b27'}));g.append(vehicle);g.append(node('rect',{x:12,y:12,width:30,height:17,rx:5,fill:routeFor(bus).color,stroke:'#fff','stroke-width':2}));g.append(node('text',{x:27,y:24,'font-size':10,'font-weight':800,'text-anchor':'middle',fill:'#fff'},bus.id));g.append(node('title',{},`${bus.name} · ${routeFor(bus).name}`));g.addEventListener('click',()=>selectBus(bus.id));g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectBus(bus.id);}});busLayer.append(g);});}
    // Drop shadow definition for vehicle symbols.
    const drop=node('filter',{id:'dropShadow',x:'-40%',y:'-40%',width:'180%',height:'190%'});drop.append(node('feDropShadow',{dx:0,dy:3,stdDeviation:3,'flood-color':'#1b352c','flood-opacity':.2}));defs.append(drop);
    repaintRoutes();repaintFeatures();repaintBuses();
    return {svg,scene,routeLayer,featureLayer,busLayer,youLayer,repaintRoutes,repaintFeatures,repaintBuses};
  }
  const mapUI=buildMap();
  function renderContent(){
    const list=$('#contentList');if(!list)return;
    const match=text=>!searchTerm||text.toLowerCase().includes(searchTerm);
    if(currentTab==='shuttles'){
      const found=buses.filter(b=>match(`${b.id} ${b.name} ${routeFor(b).name}`));
      list.innerHTML=`<div class="list-heading"><h2>Nearby shuttles</h2><span>${found.length} vehicles · demo positions</span></div>`+found.map(bus=>{const rt=routeFor(bus),pct=Math.round(bus.occupancy/bus.capacity*100);return `<button type="button" class="bus-card${bus.id===selectedBusId?' selected':''}" data-bus-id="${bus.id}" style="--route-color:${rt.color};--route-tint:${bus.routeId==='green'?'#e8f5ee':bus.routeId==='blue'?'#eaf0ff':'#fff3dc'}"><div class="bus-card-top"><span class="bus-mini-icon">${icon.bus}</span><span class="bus-card-main"><span class="bus-card-title">${bus.name}</span><span class="bus-card-subtitle">${rt.name}</span></span><span class="card-chevron"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m9 5 7 7-7 7" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg></span></div><div class="bus-card-bottom"><span class="bus-info-pair">${icon.clock}<span>${escapeHtml(byId.get(bus.current?.next||rt.path[1])?.name||'Next stop')}</span></span><span class="bus-route-tag">${rt.short}</span><span class="bus-info-pair">${icon.users}<span>${bus.occupancy}/${bus.capacity}</span><i class="occupancy-track"><i class="occupancy-fill" style="width:${pct}%;background:${rt.color};display:block"></i></i></span></div></button>`}).join('')||'<div class="empty-state">No shuttle matched that search.</div>';
    }else{
      const found=features.filter(f=>match(`${f.name} ${f.detail}`));
      list.innerHTML=`<div class="list-heading"><h2>Stops & campus places</h2><span>${found.length} locations</span></div>`+found.map(f=>`<button type="button" class="place-card${f.id===selectedFeatureId?' selected':''}" data-feature-id="${f.id}"><span class="place-card-icon${f.type==='stop'?' stop':''}">${f.type==='stop'?icon.stop:icon.landmark}</span><span class="place-card-main"><span class="place-card-title">${escapeHtml(f.name)}</span><span class="place-card-desc">${escapeHtml(f.detail)}</span></span><span class="place-card-tail">${f.accuracy==='approximate'?'<span class="approx-tag">Approx.</span>':''}<span>${f.type==='stop'?'Bus stop':'Landmark'}</span></span></button>`).join('')||'<div class="empty-state">No place matched that search.</div>';
    }
  }
  function updateSelectedCard(){const bus=buses.find(b=>b.id===selectedBusId)||buses[0],rt=routeFor(bus),m=bus.current||motionFor(bus,performance.now());$('#selectedCard').classList.remove('hidden');$('#selectedBusName').textContent=bus.name;$('#selectedRouteName').textContent=`${rt.name} · demo tracking`;$('#selectedNextStop').textContent=byId.get(m.next)?.name||'Next stop';$('#selectedEta').textContent=`${m.eta||2} min` ;$('#selectedCapacity').textContent=`${bus.occupancy} / ${bus.capacity}`;$('#selectedCard').style.setProperty('--selected-color',rt.color);$('#selectedCard').style.setProperty('--selected-tint',bus.routeId==='green'?'#e8f5ee':bus.routeId==='blue'?'#eaf0ff':'#fff3dc');$('#mapStatus').textContent='Demo movement';}
  function selectBus(id){selectedBusId=id;selectedFeatureId=null;mapUI.repaintRoutes();mapUI.repaintBuses();renderContent();updateSelectedCard();if(window.innerWidth<=820)$('#sidebar').classList.remove('mobile-open');}
  function selectFeature(id){selectedFeatureId=id;const feature=byId.get(id);if(!feature)return;$('#selectedCard').classList.add('hidden');renderContent();mapUI.repaintFeatures();if(window.innerWidth<=820)$('#sidebar').classList.remove('mobile-open');notify(`${feature.name}${feature.accuracy==='approximate'?' · approximate boarding point':''}`,3800);}
  function updateFilter(){searchTerm=$('#globalSearch').value.trim().toLowerCase();renderContent();Array.from(mapUI.featureLayer.children).forEach(el=>{const f=byId.get(el.dataset.featureId);el.style.opacity=(!searchTerm||`${f.name} ${f.detail}`.toLowerCase().includes(searchTerm))?'1':'.13';});Array.from(mapUI.busLayer.children).forEach(el=>{const b=buses.find(v=>v.id===el.dataset.busId);el.style.opacity=(!searchTerm||`${b.name} ${b.id} ${routeFor(b).name}`.toLowerCase().includes(searchTerm))?'1':'.16';});}
  function applyZoom(){const w=1400,h=1000;mapUI.scene.setAttribute('transform',`translate(${panX+(1-zoom)*w/2} ${panY+(1-zoom)*h/2}) scale(${zoom})`);}
  function showLocation(coords,center){const lat=coords.latitude,lng=coords.longitude;if(userMarker)userMarker.remove();const p=xy({lat,lng});userMarker=node('g',{transform:`translate(${p.x} ${p.y})`,class:'fallback-user-pin'});userMarker.append(node('circle',{r:27,fill:'#3b82f6',opacity:.17}));userMarker.append(node('circle',{r:10,fill:'#3b82f6',stroke:'#fff','stroke-width':4}));userMarker.append(node('circle',{r:3,fill:'#fff'}));mapUI.youLayer.append(userMarker);if(center){zoom=Math.max(zoom,1.35);panX=(700-p.x)*zoom;panY=(500-p.y)*zoom;applyZoom();}notify('Your device location is shown as the blue dot.');}
  function locate(){if(!navigator.geolocation){notify('This browser does not support location services.');return;}$('#locateButton').classList.add('active');navigator.geolocation.getCurrentPosition(p=>{$('#locateButton').classList.remove('active');showLocation(p.coords,true);},e=>{ $('#locateButton').classList.remove('active');notify(e.code===1?'Location permission was denied. Allow it in browser settings.':'Could not determine your location. Try again outdoors.',4800);},{enableHighAccuracy:true,timeout:15000,maximumAge:10000});}
  function follow(){if(watchId!==null){navigator.geolocation.clearWatch(watchId);watchId=null;followLocation=false;$('#followButton').classList.remove('active');$('#followButton').setAttribute('aria-pressed','false');notify('Location follow paused.');return;}if(!navigator.geolocation){notify('This browser does not support location services.');return;}followLocation=true;$('#followButton').classList.add('active');$('#followButton').setAttribute('aria-pressed','true');watchId=navigator.geolocation.watchPosition(p=>showLocation(p.coords,true),e=>{if(watchId!==null)navigator.geolocation.clearWatch(watchId);watchId=null;followLocation=false;$('#followButton').classList.remove('active');$('#followButton').setAttribute('aria-pressed','false');notify('Could not follow your device location.');},{enableHighAccuracy:true,maximumAge:5000,timeout:20000});}
  function toggleMap(){darkMap=!darkMap;$('#map').classList.toggle('satellite-mode',darkMap);$('#layerToggle').classList.toggle('is-on',darkMap);$('#layerToggle span').textContent=darkMap?'Light map':'Satellite';notify(darkMap?'Muted dark map theme enabled.':'Light map theme enabled.');}
  function toggleRoutes(){routesVisible=!routesVisible;$('#routeToggle').classList.toggle('is-on',routesVisible);$('#routeToggle').setAttribute('aria-pressed',String(routesVisible));$('#fallbackRoutes').style.display=routesVisible?'':'none';notify(routesVisible?'Route corridors shown.':'Route corridors hidden.');}
  function updateClock(){const value=new Intl.DateTimeFormat('en-GH',{timeZone:'Africa/Accra',hour:'2-digit',minute:'2-digit',hour12:true}).format(new Date());$('#clockTime').textContent=`${value} · GMT`;}
  $('#shuttlesTab').addEventListener('click',()=>{currentTab='shuttles';$('#shuttlesTab').classList.add('active');$('#stopsTab').classList.remove('active');$('#shuttlesTab').setAttribute('aria-selected','true');$('#stopsTab').setAttribute('aria-selected','false');renderContent();});
  $('#stopsTab').addEventListener('click',()=>{currentTab='stops';$('#stopsTab').classList.add('active');$('#shuttlesTab').classList.remove('active');$('#stopsTab').setAttribute('aria-selected','true');$('#shuttlesTab').setAttribute('aria-selected','false');renderContent();});
  $('#contentList').addEventListener('click',e=>{const b=e.target.closest('[data-bus-id]');if(b){selectBus(b.dataset.busId);return;}const f=e.target.closest('[data-feature-id]');if(f)selectFeature(f.dataset.featureId);});
  $('#globalSearch').addEventListener('input',updateFilter);$('#globalSearch').addEventListener('keydown',e=>{if(e.key==='Escape'){$('#globalSearch').value='';updateFilter();$('#globalSearch').blur();}});
  $('#routeToggle').addEventListener('click',toggleRoutes);$('#layerToggle').addEventListener('click',toggleMap);$('#locateButton').addEventListener('click',locate);$('#followButton').addEventListener('click',follow);
  $('#zoomInButton').addEventListener('click',()=>{zoom=Math.min(zoom*1.18,2.5);applyZoom();});$('#zoomOutButton').addEventListener('click',()=>{zoom=Math.max(zoom/1.18,0.75);applyZoom();});$('#fitMapButton').addEventListener('click',()=>{zoom=1;panX=0;panY=0;applyZoom();});$('#centerSelectedButton').addEventListener('click',()=>{const bus=buses.find(b=>b.id===selectedBusId);if(bus)notify(`${bus.name} is moving on the demo route.`,2500);});$('#selectedClose').addEventListener('click',()=>$('#selectedCard').classList.add('hidden'));
  $('#mobilePanelToggle').addEventListener('click',()=>$('#sidebar').classList.toggle('mobile-open'));
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();$('#globalSearch').focus();}if(e.key==='Escape')$('#sidebar').classList.remove('mobile-open');});
  // Pointer pan is intentionally lightweight for the offline map.
  let drag=null;const svg=mapUI.svg;svg.addEventListener('pointerdown',e=>{if(e.target.closest('[data-bus-id],[data-feature-id]'))return;drag={x:e.clientX,y:e.clientY,px:panX,py:panY};svg.setPointerCapture(e.pointerId);});svg.addEventListener('pointermove',e=>{if(!drag)return;panX=drag.px+(e.clientX-drag.x)*1400/svg.clientWidth;panY=drag.py+(e.clientY-drag.y)*1000/svg.clientHeight;applyZoom();});svg.addEventListener('pointerup',()=>{drag=null;});svg.addEventListener('pointercancel',()=>{drag=null;});svg.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.75,Math.min(2.5,zoom*(e.deltaY<0?1.1:.91)));applyZoom();},{passive:false});
  $('#activeBusCount').textContent=String(buses.length).padStart(2,'0');$('#stopCount').textContent=String(features.filter(f=>f.type==='stop').length).padStart(2,'0');$('#routeCount').textContent=String(Object.keys(routes).length).padStart(2,'0');$('#shuttlesTabCount').textContent=String(buses.length).padStart(2,'0');$('#stopsTabCount').textContent=String(features.length).padStart(2,'0');
  $('#sidebar').classList.remove('mobile-open');
  const warning=document.createElement('div');warning.className='offline-map-note';warning.innerHTML='<strong>Offline campus schematic</strong><span>Live street tiles could not load. Landmarks are pinned from the campus coordinate dataset; road/building shapes are illustrative. Shuttle movement is simulated.</span>';$('#map').append(warning);
  renderContent();updateSelectedCard();updateClock();setInterval(updateClock,30000);
  let start=performance.now();function tick(now){mapUI.repaintBuses(now-start);if(now-lastCardUpdate>950){const bus=buses.find(b=>b.id===selectedBusId);if(bus){updateSelectedCard();if(currentTab==='shuttles')renderContent();}lastCardUpdate=now;}requestAnimationFrame(tick);}requestAnimationFrame(tick);
})();
