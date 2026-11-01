# 🛡️ Safe Route — Smart Safety-Based Walking Route Finder

> **Your Journey. Your Safety.**  
> A privacy-first, frontend-only navigation web application designed to help people compare and choose potentially safer walking routes using real-world open geographical data.

---

## 🌟 Key Features

1. **Interactive OpenStreetMap Navigation**
   - High-performance vector tiles with zoom, pan, and smooth location animations.
   - GPS auto-detection with visual accuracy radius circle.
   - Interactive map clicking to set origins, destinations, or report local hazard spots.

2. **Real Pedestrian Walking Routes (OSRM)**
   - Computes real walking paths (not straight lines or car routes) powered by Open Source Routing Machine (`project-osrm.org`).
   - Multiple alternative routes displayed simultaneously with distance and estimated walking time.

3. **Time-Aware Safety Scoring Engine**
   - Evaluates routes by splitting them into 100-metre segments.
   - Scores environmental safety factors:
     - Proximity to registered Police Stations (35%)
     - Proximity to Hospitals and Emergency Medical Care (25%)
     - Active commercial presence & footfall: 24/7 pharmacies, open shops, petrol pumps (20%)
     - Road hierarchy & pedestrian infrastructure (15%)
     - User-reported local hazards and blind spots (5%)
   - **Time-Aware**: Considers departure time (day vs. late night) and opening hours (`opening_hours` tag from OSM).

4. **Live Nearby Help & Shelter (Overpass API)**
   - Fetches live registered police stations, hospitals, pharmacies, and petrol pumps within 1 km.
   - Category filtering, real distance calculations, and estimated walking times.
   - "Find Nearest Safe Place" one-tap guidance with dotted route.

5. **Emergency SOS Hub**
   - 1-click access to Indian emergency helplines: **112** (National Emergency), **1091** (Women Helpline), **181** (Women in Distress), **100** (Police), **108** (Ambulance).
   - Instant GPS snapshot capture (lat, lon, accuracy, timestamp).
   - One-tap WhatsApp & SMS emergency dispatch with pre-filled Google Maps pin.
   - Fast clipboard copying of emergency coordinates.

6. **100% Privacy & Zero-Backend Architecture**
   - No backend servers, no user accounts, no tracking cookies, and no cloud databases.
   - Coordinates are processed only in volatile browser memory.
   - User hazard reports and search preferences stay strictly inside local browser `localStorage`.
   - Built-in one-tap data wipe control.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js (v18 or higher recommended)
- npm or yarn

### 1. Installation
Navigate into the `frontend` directory and install dependencies:
```bash
cd frontend
npm install
```

### 2. Run the Development Server
```bash
npm run dev
```
Open your browser at `http://localhost:5173` to explore Safe Route.

### 3. Production Build
```bash
npm run build
npm run preview
```

---

## 🗺️ External Services & APIs

Safe Route runs out of the box **without requiring any paid API keys**:

| Service | Purpose | Cost / Auth |
|---|---|---|
| **OpenStreetMap** | Map tiles & base cartography | Free, Open Source |
| **OSRM** (`router.project-osrm.org`) | Real pedestrian walking routes & alternatives | Free public demo server |
| **Overpass API** (`overpass-api.de`) | Live queries for police stations, hospitals, pharmacies | Free public endpoint |
| **Nominatim** (`nominatim.openstreetmap.org`) | Location search autocomplete & reverse geocoding | Free public endpoint |

*To use custom self-hosted or commercial endpoints (e.g. Mapbox, custom OSRM instance), copy `.env.example` to `.env` and configure accordingly.*

---

## ⚠️ Important Safety Notice & Disclaimer

Safe Route provides estimated safety heuristics calculated from publicly accessible geographical datasets. **It cannot predict or guarantee personal safety, nor does it monitor real-time crime incidents or act as a substitute for law enforcement.** Always remain aware of your surroundings and call national emergency services (**112**) immediately if you are in danger.

---

## 📄 License
MIT License. Built for community safety and public good.
