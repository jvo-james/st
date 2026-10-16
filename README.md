# KNUST Shuttle Tracker

A phone-first, map-focused shuttle tracker for the KNUST campus. The design keeps the map clear and uses small, elongated, transparent SVG shuttle icons: **green means seats are available; red means the shuttle is full**.

## Run locally

Use a local web server rather than opening `index.html` directly. This enables browser geolocation and gives the service worker a secure local origin.

**Windows**

```powershell
py -m http.server 8000
```

**macOS / Linux**

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000> in your browser. Allow location access to show your blue position dot and calculate an estimated arrival time from your location to the selected shuttle.

## Using the map

- The map opens with all shuttles visible and no route lines or checkpoint pins overlaid. Campus landmark labels remain visible as you zoom in.
- Tap a shuttle to open a compact information sheet with its registration plate, nearby landmark, seat status, location update status and estimated arrival to you.
- Drag the sheet handle or its header **up** to open the nearby-shuttle list and **down** to collapse it. The collapsed strip stays available so you can pull the sheet up again; no Back button is needed.
- Tap **Track this shuttle** to zoom toward the selected shuttle and your location (when permission is granted), hide other vehicles and show the selected vehicle's route as a dashed guide. Tap **Stop tracking** to restore the full set of shuttles and clear the route line.
- If browser GPS is denied or unavailable, the app still shows shuttle movement around campus, but the ETA-to-you field asks you to enable location.

## Vehicle location feed

When no external feed is configured, vehicles move locally along their assigned route so the map, markers, selection sheet and tracking interaction can be exercised. Sample plates, driver names and occupancy values are placeholders and must be replaced with verified fleet data for a real service. The location estimate and arrival time are estimates, not dispatch guarantees.

To connect a WebSocket server, open the app with a URL such as:

`https://your-domain.example/?feed=wss%3A%2F%2Fyour-api.example%2Fvehicles`

The page accepts one JSON vehicle record per message, an array of records, or an object containing a `vehicles` array. Example record:

```json
{
  "busId": "K-01",
  "lat": 6.67920,
  "lng": -1.57083,
  "heading": 125,
  "occupancy": 8,
  "capacity": 18,
  "timestamp": "2026-10-15T12:00:00Z"
}
```

Vehicle IDs must match `K-01` to `K-04` unless you update the fleet records in `script.js`. Driver devices should upload approved coordinates and heading roughly every three seconds. A production backend still needs driver authentication, coordinate validation, authorized fleet data, reliable geofencing, accurate stop/road coordinates, and push notification delivery. Do not place private backend credentials in browser code.

## Map services and privacy

The primary street map uses CARTO Voyager tiles with OpenStreetMap/CARTO attribution. The CARTO basemap key is included in the browser-side tile URL so map tiles can load. Since client-side keys are visible by design, restrict the key to your deployed domain in the CARTO dashboard, keep it scoped to this project, and rotate it if needed. Satellite imagery is intentionally omitted from the simplified interface.

If external map tiles are blocked or unavailable, the app switches to the included campus schematic. It is an orientation fallback, not a surveyed campus map. The public OSRM routing service is used to request road-following route geometry when available; if unavailable, the local route model is used instead. Confirm the precise shuttle paths and boarding areas with KNUST before public launch.

## Files

- `index.html` — responsive interface and map-library fallback loader
- `styles.css` — responsive map-first interface, sheet drag states, and vehicle marker styling
- `script.js` — shuttle movement, seat status, estimated arrivals, selected-vehicle tracking, location and optional WebSocket feed
- `fallback.js` — fallback loader if the Leaflet mapping library cannot load
- `campus-fallback.svg` — campus schematic used when map tiles cannot load
- `favicon.svg` — app icon
- `app.webmanifest` — install metadata
- `service-worker.js` — local application-shell cache
