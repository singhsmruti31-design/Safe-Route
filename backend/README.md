# Safe Route App - Backend API

> An intelligent, safety-optimized routing backend designed to guide newcomers, women, and vulnerable pedestrians through the **safest walking route** between two points, rather than simply the shortest.

Built with **Node.js 20+ (ES Modules)**, **Express**, **PostgreSQL with PostGIS on Supabase**, **OpenRouteService (ORS)**, and **OpenStreetMap (Overpass API)**.

---

## Key Features

- **Safest Walking Route Calculation (`POST /api/routes/safe`)**:
  - Fetches alternative walking paths from OpenRouteService (`foot-walking`).
  - Splits polylines into uniform segments of ~100 meters.
  - Scores every segment using **ONE single batched PostGIS query per route**.
  - Evaluates open businesses, road hierarchy (`waytype`), police and hospital proximity, verified community hazard reports, and environmental penalties.
  - Returns GeoJSON paths, metric distances, walk duration, safety scores (0–100), risk levels (`green`, `yellow`, `red`), weakest segment identification, and `extraMinutesVsFastest`.
  - Sorts by safety (`mode="safest"`) or walking time (`mode="fastest"`).
- **Time-Aware Help Points (`GET /api/places`)**:
  - Locates police stations, hospitals, pharmacies, fuel stations, 24/7 shops, and ATMs within a radius.
  - Uses the `opening_hours` engine to compute whether each venue is open right now or at a scheduled departure time.
- **Nearest Safe Spots (`GET /api/safe-spots/nearest`)**:
  - Identifies the top 3 closest **currently open** emergency havens (police stations, hospitals, 24/7 shops, fuel pumps).
  - Automatically provides an ORS walking route directly to the closest safe haven.
- **Stateless Emergency SOS Links (`POST /api/sos/link`)**:
  - Generates instant one-tap emergency Google Maps, WhatsApp, and SMS links with pre-filled distress messages and coordinates.
  - Strictly stateless: zero storage, zero tracking, zero coordinate logging.
- **Anonymous Community Safety Reports & Moderation (`/api/reports`)**:
  - Community members report hazards (`harassment`, `dark`, `felt_unsafe`, `isolated`, `safe_spot`).
  - **Zero Raw IP Storage**: Anonymized with SHA-256 (`ip_hash`).
  - **Spam Prevention**: Automatically rejects duplicate submissions from the same hashed IP within 50 meters and 24 hours.
  - Reports require verification by $\ge 2$ independent hashed IPs or admin approval to impact route scoring.
  - Admin moderation API (`PATCH /api/admin/reports/:id`) secured with `x-admin-token`.

---

## Tech Stack & Architecture

- **Runtime**: Node.js v20+ (ES Modules)
- **Framework**: Express 4
- **Database**: PostgreSQL with PostGIS extension on Supabase (`pg` connection pool with SSL)
- **Routing Engine**: OpenRouteService (ORS) API with a 5-minute in-memory LRU cache
- **Map Data**: OpenStreetMap Overpass API (Help points, open shops)
- **Validation**: Zod (strict schemas and clean 400 errors)
- **Security**: Helmet, CORS with allowlist, Express Rate Limiters (global + strict reports limiter)
- **Testing**: Jest 29 + Supertest (unit & integration testing)

---

## Project Structure

```text
safe-route-backend/
├── db/
│   └── schema.sql                # PostGIS tables, spatial GIST indexes
├── scripts/
│   └── importOsm.js              # Weekly OSM Overpass importer (police, hospital, shops)
├── src/
│   ├── config/
│   │   ├── env.js                # Environment variable loader
│   │   └── scoring.config.js     # Tunable safety weights & radius thresholds
│   ├── db/
│   │   ├── pool.js               # PostgreSQL / Supabase connection pool
│   │   ├── placesRepo.js         # Spatial PostGIS place queries
│   │   ├── reportsRepo.js        # Community reports repository & spam prevention
│   │   └── mockPlacesData.js     # In-memory mock datasets
│   ├── middleware/
│   │   ├── auth.js               # Admin token verification (x-admin-token)
│   │   ├── errorHandler.js       # Central error handler (no leaked secrets)
│   │   └── rateLimiter.js        # Global (60/min) & Report (10/hr) limiters
│   ├── routes/
│   │   ├── health.js             # GET /api/health
│   │   ├── routes.js             # POST /api/routes/safe
│   │   ├── places.js             # GET /api/places
│   │   ├── safeSpots.js          # GET /api/safe-spots/nearest
│   │   ├── sos.js                # POST /api/sos/link
│   │   ├── reports.js            # POST & GET /api/reports
│   │   └── admin.js              # PATCH /api/admin/reports/:id
│   ├── services/
│   │   ├── orsService.js         # ORS client with 5-minute in-memory cache
│   │   ├── segmentSplitter.js    # ~100m polyline splitter & interpolation
│   │   ├── scoringEngine.js      # Batched PostGIS safety scoring engine
│   │   └── openingHoursService.js# opening_hours parser
│   ├── app.js                    # Express app configuration
│   └── server.js                 # HTTP listener & graceful shutdown
├── tests/
│   ├── health.test.js
│   ├── places.test.js
│   ├── routing.test.js
│   ├── scoring.test.js
│   ├── safeSpotsAndSos.test.js
│   └── reports.test.js
├── postman_collection.json       # Ready-to-import Postman Collection
├── .env.example
├── jest.config.js
└── package.json
```

---

## Installation & Setup

### 1. Prerequisites
- Node.js 20+ installed
- A PostgreSQL database with PostGIS (e.g. [Supabase](https://supabase.com))
- An OpenRouteService API key (free at [openrouteservice.org](https://openrouteservice.org/dev/#/signup))

### 2. Clone & Install Dependencies
```bash
git clone <repo-url>
cd safe-route-backend
npm install
```

### 3. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Update `.env` with your credentials:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
ORS_API_KEY=your_openrouteservice_api_key
ADMIN_TOKEN=your_secure_admin_secret_token
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:8080
MOCK_MODE=false
```
> **Offline / Demo Mode**: Setting `MOCK_MODE=true` allows full local testing without live Supabase or ORS credentials using built-in in-memory datasets.

### 4. Database Setup (Supabase / PostgreSQL)
Run the SQL script [`db/schema.sql`](file:///C:/Users/windows%2010/.gemini/antigravity/scratch/safe-route-backend/db/schema.sql) in your Supabase SQL Editor:
```sql
-- Enables PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Creates places table with GIST index
CREATE TABLE IF NOT EXISTS places (
    id BIGSERIAL PRIMARY KEY,
    osm_id BIGINT UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    name VARCHAR(255),
    geom geography(Point, 4326) NOT NULL,
    opening_hours TEXT,
    is_24_7 BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_places_geom ON places USING GIST (geom);

-- Creates reports table with GIST index
CREATE TABLE IF NOT EXISTS reports (
    id BIGSERIAL PRIMARY KEY,
    geom geography(Point, 4326) NOT NULL,
    type VARCHAR(50) NOT NULL,
    note VARCHAR(200),
    status VARCHAR(20) DEFAULT 'pending',
    ip_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reports_geom ON reports USING GIST (geom);
```

### 5. Running the Application
```bash
# Start server in development watch mode
npm run dev

# Start server in production mode
npm start
```

### 6. Running Tests
Execute the comprehensive test suite with Jest:
```bash
npm test
```

---

## OpenStreetMap Data Import

Help points (police stations, hospitals, pharmacies, fuel stations, ATMs, and open shops) are imported offline into PostGIS via the Overpass API.

> [!IMPORTANT]
> **No Overpass calls occur during user requests**. Data is queried strictly from the indexed PostGIS database.
> **No street lighting data** is fetched or stored (`street_lamp` and `lit` tags are strictly excluded).

### Running the Importer
```bash
# By City Name (resolves bounding box automatically via Nominatim)
npm run import -- "London"

# By Bounding Box (minLat, minLng, maxLat, maxLng)
node scripts/importOsm.js --bbox=51.49,-0.15,51.53,-0.10
```

### Scheduled Weekly Ingestion
To maintain up-to-date shop hours and emergency spots, run the import weekly via cron:
```bash
# Run every Sunday at 02:00 AM UTC
0 2 * * 0 cd /path/to/safe-route-backend && npm run import -- "London" >> /var/log/osm-import.log 2>&1
```

---

## Safety Scoring Algorithm

Every route is segmented into ~100m steps. Each segment is scored out of **100 points** based on weights defined in [`src/config/scoring.config.js`](file:///C:/Users/windows%2010/.gemini/antigravity/scratch/safe-route-backend/src/config/scoring.config.js):

| Category | Max Points | Description / Rule |
| :--- | :--- | :--- |
| **Open Places** | **30 pts** | 24/7 shops, fuel pumps, pharmacies, ATMs within 150m that are **OPEN** at `departAt`. (7.5 pts per place, capped at 4 places). Closed places add 0 pts. |
| **Activity** | **30 pts** | Road type importance from ORS `waytype` (primary roads score higher than alleys) + place density within 150m. |
| **Police Station** | **20 pts** | Full 20 points within 500m, falling linearly to 0 points at 2 km. |
| **Hospital** | **10 pts** | Full 10 points within 1 km, falling linearly to 0 points at 3 km. |
| **Community Reports**| **$\pm$ 10 pts** | Verified `safe_spot` reports add +5 pts; verified negative reports (`harassment`, `dark`, `isolated`) deduct -4 pts. |
| **Penalties** | **Up to -15 pts**| Underpass or tunnel (-10 pts), isolated stretches with zero places within 250m (-7 pts). |

### Aggregation & Weakest-Link Rule
- **Segment Score**: Clamped between 0 and 100.
- **Route Score**: Average of all segment scores. If any segment along the path scores **below 30**, the route score is penalized by **-10 points** to highlight high-risk bottlenecks.
- **Safety Levels**:
  - 🟢 **Green (Safe)**: 70 – 100
  - 🟡 **Yellow (Moderate)**: 40 – 69.9
  - 🔴 **Red (Caution)**: 0 – 39.9

---

## API Endpoints & Example Curl Commands

### 1. Health & Database Check
```bash
curl -X GET http://localhost:3000/api/health
```

### 2. Calculate Safe Route (`POST /api/routes/safe`)
```bash
curl -X POST http://localhost:3000/api/routes/safe \
  -H "Content-Type: application/json" \
  -d '{
    "start": { "lat": 51.5074, "lng": -0.1278 },
    "end": { "lat": 51.5150, "lng": -0.1350 },
    "mode": "safest",
    "departAt": "2026-11-01T21:00:00Z"
  }'
```

### 3. Find Nearby Help Points (`GET /api/places`)
```bash
curl -X GET "http://localhost:3000/api/places?lat=51.5074&lng=-0.1278&radius=1500&types=police,hospital,pharmacy"
```

### 4. Nearest Open Safe Spots & Route (`GET /api/safe-spots/nearest`)
```bash
curl -X GET "http://localhost:3000/api/safe-spots/nearest?lat=51.5074&lng=-0.1278"
```

### 5. Generate Emergency SOS Links (`POST /api/sos/link`)
```bash
curl -X POST http://localhost:3000/api/sos/link \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 51.5074,
    "lng": -0.1278,
    "name": "Sarah",
    "contactPhone": "+447700900077"
  }'
```

### 6. Submit Community Hazard Report (`POST /api/reports`)
```bash
curl -X POST http://localhost:3000/api/reports \
  -H "Content-Type: application/json" \
  -d '{
    "lat": 51.5074,
    "lng": -0.1278,
    "type": "harassment",
    "note": "Poor visibility and verbal harassment at entrance"
  }'
```

### 7. Retrieve Approved Reports (`GET /api/reports?bbox=`)
```bash
curl -X GET "http://localhost:3000/api/reports?bbox=-0.15,51.50,-0.10,51.52"
```

### 8. Admin Moderation (`PATCH /api/admin/reports/:id`)
```bash
curl -X PATCH http://localhost:3000/api/admin/reports/1 \
  -H "Content-Type: application/json" \
  -H "x-admin-token: your_secure_admin_secret_token" \
  -d '{
    "status": "approved"
  }'
```

---

## Postman Collection

A complete Postman collection is included in the project root:
- [`postman_collection.json`](file:///C:/Users/windows%2010/.gemini/antigravity/scratch/safe-route-backend/postman_collection.json)

**To Import**:
1. Open Postman.
2. Click **Import** in the top-left corner.
3. Select `postman_collection.json`.
4. The collection includes pre-configured environment variables (`baseUrl = http://localhost:3000`, `adminToken = test-admin-secret-token`).
