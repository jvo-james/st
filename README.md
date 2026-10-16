# KNUST Shuttle Tracker

A mobile-first campus shuttle tracking prototype built with HTML, CSS, vanilla JavaScript and Leaflet. It includes a light campus map, slim top-down shuttle markers, smooth route movement, a swipeable ride sheet, checkpoint search and service-direction selection.

## Run locally

Use a local web server rather than opening `index.html` with `file://` so the browser can load Leaflet and register the service worker.

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>. VS Code Live Server also works. Location-based features require a secure browser context such as `localhost` or HTTPS.

## Route and checkpoint model

Each shuttle service has a separate ordered outbound pattern and return pattern. The service selector filters vehicles by the route/direction label printed on the bus instead of asking students to plan a pickup-to-destination trip.

### Service patterns encoded from the project owner's route information

**Commercial Area ↔ KSB**

- Towards KSB: Commercial Area → Conti Bus Stop → College of Science Bus Stop → KSB
- Towards Commercial Area: KSB → Casely Hayford Bus Stop → Conti Bus Stop → Commercial Area

**Brunei ↔ KSB**

- Towards KSB: Brunei → Prempeh Library → College of Science Bus Stop → KSB
- Towards Brunei: KSB → Casely Hayford Bus Stop → Prempeh Library → Brunei

**College of Science ↔ Gaza**

- The prototype currently models College of Science ↔ Gaza as an endpoint-only provisional service. Publicly mapped campus stops are available as candidate map pins, but no intermediate checkpoints have been assigned without confirmation from campus shuttle operators.

**Brunei ↔ Medical Village**

- Included as a provisional endpoint-only service because public reporting has mentioned a connection between Brunei and Medical Village. The app does **not** claim to know the official intermediate stops, timetable, or final operating pattern.

**College of Science ↔ Medical Village**

- Included as a provisional endpoint-only pattern based on the service option supplied by the project owner; exact stops and operating details still need confirmation.

The sample fleet assigns demo vehicles to these services for interface testing, including a provisional College of Science ↔ Medical Village route. Bus IDs, positions, route cycle times and all displayed ETAs are mock values, not live operational data.

## Service selection and route-aware ETA

Expand the bottom sheet and choose the shuttle service/direction label (for example, Commercial Area → KSB or KSB → Commercial Area). The vehicle list filters by service direction, but all bus icons remain visible on the map. Selecting a bus highlights only the part of its configured service route ahead of it. The user location is shown as a blue dot when permission is granted, and no route is drawn from the shuttle to the user.

The ETA is a prototype estimate to the next checkpoint based on progress along the ordered route and a configured service-cycle duration. It is not a guaranteed arrival time and is not based on measured campus traffic or a production timetable. Terminal dwell time, queues, driver decisions, temporary diversions and observed segment travel times still need field research before operational use. No passenger occupancy or seat availability is shown because it is not currently verified.

## Campus stop coordinates and source confidence

The route order for Commercial Area–KSB and Brunei–KSB comes from the project owner. College of Science–Gaza, Brunei–Medical Village and College of Science–Medical Village are provisional patterns pending operator confirmation. Stop coordinates are a separate matter: most have not been surveyed to the exact bus bay. A public KNUST campus bus-stop mapping project identifies names including Pentecoste, Casely Hayford, CCB, Steps, KSB, Ahinsan, Brunei and Bomso Gate. Official KNUST materials describe shuttles serving halls/residential areas, academic areas and the commercial area. Public reporting in June 2026 also mentioned a Brunei–Medical Village connection. These references support candidate checkpoint discovery, but they do not confirm the full route sequence, exact boarding position, or live service status.

- Checkpoints explicitly provided by the project owner are used in the confirmed route patterns.
- Other named campus stops and places are marked as approximate/candidate pins in the interface.
- Prempeh II Library and KSB coordinates are sourced from public map references, but are not a surveyed measurement of the exact shuttle bay.
- Gaza, Medical Village and other candidate pins are approximate. They must be checked with campus transport staff or by walking the campus before public use.
- No route sequence has been inferred for a stop simply because that stop appears on the map.

References used for initial discovery:

- KNUST campus bus-stop mapping: <https://storymaps.arcgis.com/stories/70f704c487ca4878b4e2bd543e158f51>
- KNUST official transportation guide: <https://www.knust.edu.gh/index.php/admissions/freshers-guide/transportation>
- KNUST official naming of roads and facilities (includes Gaza / campus road references): <https://www.knust.edu.gh/staff/naming-of-university-facilities>
- Public reporting on the Brunei–Medical Village connection: <https://unexgh.com/uninews/NewsDetails/605>

## Smooth map and marker behaviour

- **CARTO Voyager raster tiles:** the CARTO Basemaps key is configured in `script.js`. Browser keys are public by design; restrict the key to your development/deployment hostnames in the CARTO dashboard. Keep CARTO and OpenStreetMap attribution visible and follow your account's current terms and usage limits.
- **Stable panning and zooming:** tiles are buffered and refreshed after map gestures settle; no CSS filter is applied to the tile pane. Zoom controls and a fit-checkpoints control remain available. Camera follow is disabled by default and automatically pauses during user map gestures. Expensive approach-route geometry is not re-created every animation frame, and road geometry is applied in a single batch rather than arriving route by route.
- **User-controlled map camera:** selecting a shuttle fits the fleet and selected approach route once, then leaves the camera where the user puts it. Camera-follow is opt-in using **Follow shuttle**. Panning, wheel zoom and pinch zoom always suspend follow until the button is pressed again.
- **All shuttles remain visible:** selecting a vehicle raises/highlights it but does not hide other bus markers. Bus markers are sized for visibility and tinted by service route, with no outer marker border; all fleet icons remain visible unless actual map overlap obscures one.
- **Slim top-down vehicle:** the SVG marker has no outer selection frame. Its nose rotates to the route bearing; text labels stay upright.
- **Smooth movement:** simulated vehicles use continuous `requestAnimationFrame` positioning, a short route look-ahead for turning, and eased migration when road-snapped geometry arrives. ETA text is refreshed less often than positions to avoid unnecessary layout work.
- **Route-to-pickup line:** selecting a shuttle draws a highlighted approach line. The pickup/destination planner highlights the selected bus's future path to the next valid pickup occurrence in the selected service pattern.
- **Swipeable bottom sheet:** swipe upward/downward on the sheet header and non-control ride-card surfaces to switch between collapsed, detail and expanded states. The handle responds to one tap, pointer/touch swipes continue beyond the original touch target, and expanded lists retain native vertical scrolling.
- **Offline fallback:** if Leaflet cannot load, a bundled schematic campus map provides a lightweight visual fallback. It is not a verified street map.

## Map and routing service limitations

The map uses CARTO Voyager tiles. CARTO key requirements, pricing/usage allowances and restrictions can change; check your account terms and restrict the browser key to your own domains. The road geometry is requested from the public OSRM demo service (`https://router.project-osrm.org`). That server is shared, can be rate-limited or unavailable, and is not a production-service guarantee. When it cannot provide road geometry, the prototype falls back to straight checkpoint-to-checkpoint geometry so the interface remains usable.

If the app grows beyond personal prototyping, use a contracted map/routing provider or operate an appropriately licensed routing service. Verify map attribution and licensing before deployment.

## Optional vehicle feed

The app can consume a WebSocket feed when a `feed` query parameter is provided:

```text
https://your-host/knust-shuttle/?feed=wss://your-service.example/vehicles
```

A message may be one vehicle record, an array of records, or an object with a `vehicles` array. Example record:

```json
{
  "busId": "K-01",
  "lat": 6.6778,
  "lng": -1.5708,
  "heading": 90,
  "speed": 18,
  "capacity": 18,
  "timestamp": 1792123456789
}
```

Coordinates are validated client-side. Production deployments also need authenticated drivers/devices, server-side validation, telemetry freshness handling, privacy controls and secure backend fan-out.

## Main files

- `index.html` — app shell, map container, controls, service selector and swipeable sheet.
- `styles.css` — visual design, responsive layout, markers and sheet drag surfaces.
- `script.js` — stops, directional service patterns, sample shuttle fleet, route/ETA calculations, map layers, animation, search, alerts and optional WebSocket feed.
- `campus-fallback.svg` — bundled schematic used if Leaflet or online map assets cannot load.
- `service-worker.js` — app-shell cache and offline navigation fallback.
- `README.md` — setup instructions and data-confidence notes.

## Before a real launch

Confirm every stop's boarding-bay coordinates and every service's outbound/return sequence with the KNUST Transport Office or shuttle operators. Record terminal turnaround rules and stop dwell times, test ETAs against actual trips, then replace the demo fleet with authorised vehicle telemetry. Use a stable, suitably licensed tile/routing service for expected traffic, protect the telemetry backend and publish a privacy notice before requesting location.
