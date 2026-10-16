# KNUST Shuttle Tracker

A mobile-first campus shuttle tracking prototype built with HTML, CSS, vanilla JavaScript and Leaflet. It includes a map-first interface, directional shuttle markers, a draggable ride sheet, route highlighting, arrival estimates, checkpoint search and a simulated route-motion model so the interface can be exercised without a live fleet feed.

## Run locally

Use a local web server rather than opening `index.html` with `file://` so the browser can load the map library and register the service worker.

```bash
python -m http.server 8000
```

Then open <http://localhost:8000>.

You can also use the VS Code **Live Server** extension. The map requires an internet connection unless the bundled campus schematic fallback is active. Location-based features require a secure context such as `localhost` or HTTPS.

## Interface updates

- **Light campus basemap:** CARTO Voyager raster tiles through Leaflet. The CARTO Basemaps API key is configured in `script.js`; because browser keys are visible to visitors, restrict the key to your development/deployment hostnames in the CARTO Basemaps dashboard. Keep the OpenStreetMap and CARTO attribution visible. Usage allowances and terms depend on your CARTO account and project type; do not assume this public endpoint is guaranteed production hosting.
- **Slim, directional shuttle marker:** a narrow top-down SVG with a north-facing base orientation. Its vehicle art rotates along the route bearing, while the ETA bubble stays upright.
- **Route-to-pickup highlight:** selecting a shuttle opens the ride sheet and highlights its approach to the next checkpoint. When device location is available, the app attempts to request road geometry from the public OSRM demo service to the user's location. The fallback joins the shuttle's route to its next checkpoint and estimates the remaining distance.
- **Smooth movement:** simulated vehicles move continuously along route geometry, and the heading uses a short look-ahead around corners. When a WebSocket feed is configured, external GPS fixes are interpolated over a short interval rather than applied as abrupt jumps.
- **Swipeable bottom sheet:** drag the summary/header/hero area up or down to snap between collapsed, shuttle-detail and expanded states. Controls keep their normal click behaviour, and the scrollable list/detail content can still scroll.
- **Search and location controls:** search shuttles, checkpoints and landmarks, center the map, request device location and browse nearby services.
- **Offline fallback:** if the map library cannot load, the bundled campus schematic still provides a lightweight visual prototype. This is approximate geometry, not a verified campus road map.

## Current prototype data and limitations

Shuttle IDs, route loops, passenger counts, drivers, plates, checkpoints and ETAs are sample values used for interface testing. Confirm checkpoint coordinates and route geometry against actual KNUST operations before using the app for travel decisions.

Road routing is attempted through `https://router.project-osrm.org`, a public demonstration service. It can be rate-limited, unavailable, or return imperfect campus routing. The fallback is intentionally visual and should not be treated as turn-by-turn navigation. CARTO's public tile endpoints and OSRM's demo endpoint are not a substitute for a production map/routing agreement if usage grows.

The app optionally accepts a WebSocket URL through the `feed` query parameter:

```text
https://your-host/knust-shuttle/?feed=wss://your-service.example/vehicles
```

Each message can be one vehicle record, an array of records, or an object with a `vehicles` array. Vehicle records use this shape:

```json
{
  "busId": "K-01",
  "lat": 6.6778,
  "lng": -1.5708,
  "heading": 90,
  "speed": 18,
  "occupancy": 8,
  "capacity": 18,
  "timestamp": 1792123456789
}
```

Only finite, in-range GPS coordinates are accepted. Capacity and occupancy are bounded and normalised client-side; production validation and authentication should also happen on the server.

## Main files

- `index.html` — app shell, map container, map controls, search and bottom-sheet UI.
- `styles.css` — visual design, mobile layout and sheet drag surfaces.
- `script.js` — sample routes and shuttles, route/ETA calculations, animation, map layers, search, alerts and optional WebSocket feed.
- `campus-fallback.svg` — bundled schematic map used if Leaflet or online map assets cannot load.
- `service-worker.js` — application-shell cache and offline navigation fallback.

## Before a real launch

Use an owned/contracted tile and routing service at the expected scale, add a secure backend for authenticated driver updates, and replace sample fleet metadata with verified data. Configure a suitable privacy notice before requesting precise location, and test mobile gestures on both Android and iOS devices.
