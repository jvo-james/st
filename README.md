# KNUST Shuttle Tracker

A standalone, responsive campus shuttle tracker prototype for Kwame Nkrumah University of Science and Technology (KNUST), Kumasi. The ZIP keeps all project files directly at its root (no enclosing folder).

## Run it

1. Extract the ZIP.
2. Open a terminal inside the extracted folder and run:
   - Windows: `py -m http.server 8000`
   - macOS/Linux: `python3 -m http.server 8000`
3. Open `http://localhost:8000` in a modern browser.

An internet connection gives you the detailed CARTO street basemap (the CARTO Basemaps API key is configured in `script.js`), Esri satellite imagery and optional road-routing geometry. The app tries several Leaflet CDNs and two CARTO basemap styles; both raster tile URLs include the supplied CARTO key. If either provider is blocked or returns errors, it removes the failed tile layers, revealing the bundled campus schematic behind the interactive routes and markers so broken 403 tiles cannot cover the map. The schematic is explicitly labeled because it is not a replacement for road survey data. Browser location works on HTTPS pages and `localhost`, subject to permission.

## Included files

- `index.html` — app structure and CDN fallback loader.
- `styles.css` — responsive ride-app layout, cards, controls, SVG marker styling, and minimal local Leaflet layout rules.
- `script.js` — interactive Leaflet map, CARTO street basemap, mapped landmarks/stops, smooth shuttle movement, road-routing integration, route trails, search, satellite layer and geolocation.
- `fallback.js` — offline-safe schematic map with moving demo shuttles and working search / controls when Leaflet cannot load.
- `favicon.svg` — app icon.

## Features

- Full-screen map with a floating shuttle panel, ride-style shuttle markers, and responsive mobile layout.
- Moving shuttle icons rotate to match direction and leave a subtle selected-vehicle movement trail.
- The app attempts to road-snap campus loops using the public OSRM demo routing service. If that service is unavailable, it keeps an indicative demo corridor instead of claiming turn-by-turn accuracy.
- Clickable shuttles, bus stops and landmarks; live-updating selected shuttle details; search; route visibility; zoom; campus fit; satellite toggle.
- “Locate me” and “Follow my location” use browser geolocation after explicit permission.

## Data and limitations

**The vehicle feed is simulated, not live KNUST GPS.** Shuttle positions move around example loops to demonstrate the user experience; the ETA, speed implied by movement, and occupancy are for demonstration only. For production tracking, connect an authorized shuttle/operator GPS feed and backend, then stream timestamped vehicle coordinates to the map. A driver-facing dashboard and passenger view could subscribe to that same feed.

Landmarks and stop points are pinned from mapped campus coordinates. Stops without a confidently mapped boarding bay are marked approximate. The offline schematic has illustrative road and building shapes: the labels and point coordinates are the map anchors, but the schematic shapes are not surveyed. Verify boarding bays and real shuttle routes with KNUST transport operators before using this for passenger decisions.

## Sources and attribution

- KNUST official campus map: <https://www.knust.edu.gh/about/knust/maps>
- KNUST official transportation guide: <https://www.knust.edu.gh/index.php/admissions/freshers-guide/transportation>
- Map data © OpenStreetMap contributors and CARTO: <https://carto.com/attributions>
- OpenStreetMap contributors: <https://www.openstreetmap.org/copyright>
- Satellite imagery © Esri and its data providers.
- Road-snapped demo route geometry (when available) from the OSRM public routing demo: <https://project-osrm.org/>

Map, routing and satellite provider availability/usage policies can change. This prototype is not affiliated with or endorsed by KNUST.


## CARTO key

The CARTO Basemaps key supplied for this project is configured in `script.js` for the Voyager and light raster styles. Because the map runs in the browser, its tile URL and key are visible to visitors. Restrict the key to your deployment origin in the CARTO dashboard where supported; update the allowed origin when moving from local testing to hosting. If the key was exposed somewhere unintended, revoke it and issue a replacement.
