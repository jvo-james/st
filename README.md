# KNUST Shuttle

A mobile-first KNUST campus shuttle tracker with a full-screen ride-hailing map, transparent custom SVG shuttle symbols, scrollable route capsules, checkpoint arrivals, passenger occupancy, driver details, checkpoint timelines, current-location support and checkpoint reminders.

## Run it locally

For location permission, installability and reliable browser behavior, run it through localhost rather than opening `index.html` directly from File Explorer.

**Windows**

```powershell
py -m http.server 8000
```

**macOS / Linux**

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Current operating mode

Without a connected shuttle GPS backend, the app runs on a local vehicle movement model so route selection, bus tracking, checkpoint timelines, ETA changes, occupancy colors and checkpoint alerts can be exercised. The current driver names, registration plates and seat counts are sample records; replace them with verified fleet records before public deployment.

The app attempts to request road-following route geometry from the public OSRM routing service. If that request is unavailable (including when the browser blocks it), it uses its built-in checkpoint-to-checkpoint route geometry. The primary map is CARTO Voyager and includes CARTO / OpenStreetMap attribution. If map tiles are rejected or unavailable, an included campus schematic with interactive markers is used so the screen does not fill with failed tiles. The schematic is an orientation fallback, not a surveyed campus map.

## CARTO key

The supplied CARTO Basemaps key has been added to the client-side tile URL. A key in front-end JavaScript is visible to users by design. Restrict it to your deployed domain in the CARTO dashboard, keep it scoped to this project, and rotate it if needed. See CARTO's Basemaps terms and attribution requirements before a public launch.

## Try checkpoint alerts

1. Open the app from `http://localhost:8000` or HTTPS.
2. Choose a checkpoint from the map or the expanded panel.
3. Tap **Alert me** and allow browser notifications if you want an operating-system notification.
4. Keep the page open. The local feed triggers a reminder when a shuttle enters the 30-metre geofence two checkpoints before the alerted stop on its route.

This client-side reminder is for testing while the page is running. Notifications when the browser is closed require a push-notification service worker subscription and a server that sends push messages; a backend has not been provisioned here.

## Connect a vehicle WebSocket

Pass a WebSocket endpoint as a query parameter, for example:

`https://your-domain.example/?feed=wss%3A%2F%2Fyour-api.example%2Fvehicles`

The page accepts one JSON object per message, a JSON array, or an object with a `vehicles` array. Each vehicle record should use the following fields:

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

Vehicle IDs must match the app's known IDs (`K-01` to `K-04`) or the data and IDs must be changed together in `script.js`. Driver devices should emit authorised location updates approximately every three seconds. The server must authenticate driver devices, validate coordinates, rate-limit messages, and publish only authorised fleet data; do not ship a private credential in this front-end project.

## Checkpoint data

The checkpoint names and several public mapped coordinates are based on OpenStreetMap / Mapcarta / KNUST public map references. Checkpoints created from a junction or an area rather than a verified bus-stop point are approximate until a campus survey confirms the exact boarding bay. The app uses a 30-metre radius to test local checkpoint arrivals.

## Files

- `index.html` — responsive page and Leaflet CDN fallback loader
- `styles.css` — responsive interface and custom SVG vehicle marker styling
- `script.js` — local vehicle motion, routes, ETA calculations, geofences, notifications and optional WebSocket telemetry
- `fallback.js` — loads the local map implementation if Leaflet cannot be loaded
- `campus-fallback.svg` — included map-tile fallback artwork
- `favicon.svg` — app icon
- `app.webmanifest` — install metadata
- `service-worker.js` — caches local shell files for repeat visits
