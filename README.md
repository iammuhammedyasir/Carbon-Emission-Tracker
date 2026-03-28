# Carbon Emission Tracker

A full-stack IoT project that reads live vehicle emission data from an OBD2 scanner via a Raspberry Pi 4B, calculates a real-time pollution score, displays it on an in-vehicle screen, and syncs the data to a cloud database accessible through a web dashboard.

Built as a Final Semester project.

---

## How It Works

```
OBD2 Scanner (Bluetooth)
        ↓
Raspberry Pi 4B  ──→  Waveshare 7" Display (offline, always on)
        ↓
  SQLite Buffer (saves data locally when offline)
        ↓  (when internet available)
  HiveMQ MQTT Broker
        ↓
  mqttworker.py → Supabase Database
        ↓
  EcoTrek Web Dashboard
```

The system is **offline-first** — the Pi always reads and displays data locally. Internet is only needed for syncing to the website. If the connection drops mid-drive, data is buffered in SQLite and sent when the connection is restored.

---

## Repository Structure

```
Carbon-Emission-Tracker/
│
├── obd_reader.py               # Standalone OBD2 reader — reads PIDs, calculates
│                               # pollution score, prints live to terminal.
│                               # Supports both Petrol and Diesel vehicles.
│
├── pi_pollution_publisher.py   # Main Pi script — reads OBD2 data, calculates
│                               # pollution score, and publishes JSON payload
│                               # to HiveMQ broker over MQTT every 5 seconds.
│
├── mqttworker.py               # MQTT subscriber — runs separately, listens to
│                               # HiveMQ topic and inserts each reading into
│                               # the Supabase `results` table via REST API.
│
├── supabase_schema.sql         # Full database schema — users, vehicles,
│                               # trips tables with RLS policies and
│                               # auth trigger for automatic profile creation.
│
├── src/
│   ├── main.js                 # SPA router with Supabase auth guard.
│   │                           # Handles page transitions and user session.
│   ├── supabaseClient.js       # Supabase client initialisation.
│   ├── style.css               # Global styles.
│   └── views/
│       ├── login.js            # Login page with Supabase email/password auth.
│       ├── dashboard.js        # Live pollution score display via MQTT websocket.
│       │                       # Shows real-time scores as Pi publishes data.
│       ├── profile.js          # User profile, vehicle garage (add/view vehicles),
│       │                       # weekly Carbon Pulse gauge, recent trip activity feed.
│       ├── logger.js           # Manual trip logger. Three modes: Manual Entry,
│       │                       # Odometer Sync, and Map Route (beta).
│       │                       # Calculates CO2 from distance + fuel type + L/100km.
│       └── analytics.js        # 12-month emission trend chart (line) and
│                               # per-vehicle CO2 comparison chart (bar).
│                               # Export CSV and Download PDF buttons.
│
├── index.html                  # App entry point.
├── package.json                # Vite + Supabase JS dependencies.
└── supabase_schema.sql         # Run this in Supabase SQL editor to set up DB.
```

---

## Pollution Score Algorithm

The Pi calculates a score from 0–100 for each reading. **Higher = cleaner engine.**

```
Pollution_Score = 0.6 × Combustion_Score + 0.4 × AfterTreatment_Score
```

| Score | Formula | OBD2 PID |
|---|---|---|
| FuelTrim | `100 − (│STFT%│ + │LTFT%│) × 2` | Mode 01, PID 06 & 07 |
| LambdaStability | `100 − (Avg_Dev × 1000)` | Mode 01, PID 0x24 |
| CatalystEfficiency | `100 − (Var_Down / Var_Up) × 100` | PID 0x14 (up), 0x15 (down) |
| Combustion (Petrol) | `0.5 × FuelTrim + 0.5 × Lambda` | — |
| Combustion (Diesel) | `Lambda only` | — |
| AfterTreatment | `0.6 × Catalyst + 0.4 × Lambda` | — |

Lambda and O2 scores use a rolling 60-sample window (~30 seconds) for stability. Engine must be **warm and in closed loop** for valid readings.

**Rating bands:**

| Score | Rating |
|---|---|
| ≥ 80 | LOW RISK 🟢 |
| 50 – 79 | MODERATE 🟡 |
| < 50 | HIGH RISK 🔴 |

---

## Hardware

| Component | Details |
|---|---|
| Raspberry Pi 4B | Main processing unit |
| OBD2 Bluetooth Scanner | ELM327-based, connects via rfcomm0 |
| Waveshare 7" Display | HDMI (video) + USB (touch), powered separately |
| Heatsink + Fan | Required — car interiors get very hot |
| DC-DC Buck Converter | 12V → 5V/5A, wired to car fuse box ACC slot |

**Power:** The Pi and display are powered from the car's fuse box via a buck converter (not from the OBD2 port). The OBD2 port powers only the scanner itself.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vite (Vanilla JS), SPA with custom router |
| Styling | Vanilla CSS |
| Charts | Chart.js |
| Auth & Database | Supabase |
| Pi → Cloud | paho-mqtt → HiveMQ → mqttworker.py → Supabase REST |
| Pi OBD2 | pyserial + rfcomm (Bluetooth) |

---

## Database Schema

Three tables are defined in `supabase_schema.sql`:

- **`users`** — linked to Supabase Auth. Auto-created via trigger on signup.
- **`vehicles`** — stores make, model, year, fuel type, avg L/100km per user.
- **`trips`** — logs each trip with distance (km), CO2 (kg), vehicle reference, timestamp.

> ⚠️ A `results` table is also needed to store live OBD2 readings published by the Pi via `mqttworker.py`. This is not yet in `supabase_schema.sql` — add it before running the MQTT pipeline.

Row Level Security (RLS) is enabled on all tables. Users can only read and modify their own data.

---

## Getting Started

### Website

**Prerequisites:** Node.js v16+

```bash
git clone https://github.com/iammuhammedyasir/Carbon-Emission-Tracker.git
cd Carbon-Emission-Tracker
npm install
```

Create a `.env` file in the root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

> ⚠️ Never commit your `.env` file. Add it to `.gitignore`. Also move the hardcoded credentials out of `src/supabaseClient.js` and use `import.meta.env.VITE_SUPABASE_URL` instead.

Run the dev server:

```bash
npm run dev
```

Set up the database by running `supabase_schema.sql` in your Supabase project's SQL editor.

---

### Raspberry Pi

**Prerequisites:**

```bash
pip install pyserial paho-mqtt
```

**Step 1 — Pair OBD2 adapter:**

```bash
bluetoothctl
scan on
# find your adapter MAC address
pair XX:XX:XX:XX:XX:XX
sudo rfcomm bind 0 XX:XX:XX:XX:XX:XX 2
```

**Step 2 — Update the MAC address** in `obd_reader.py`:

```python
MAC = "XX:XX:XX:XX:XX:XX"   # your actual OBD2 adapter MAC
```

**Step 3 — Run the OBD2 reader** (terminal display only, no MQTT):

```bash
python obd_reader.py
```

**Step 4 — Run with MQTT publishing** (sends data to HiveMQ → Supabase):

Update config at the top of `pi_pollution_publisher.py`:

```python
MQTT_BROKER  = "broker.hivemq.com"
MQTT_TOPIC   = "results/data"
SERIAL_PORT  = "/dev/rfcomm0"
VEHICLE_TYPE = "petrol"   # or "diesel"
```

Then run:

```bash
python pi_pollution_publisher.py
```

**Step 5 — Run the MQTT worker** (on a separate machine or Pi — subscribes and writes to Supabase):

Update config in `mqttworker.py`:

```python
SUPABASE_URL = "your_supabase_url"
SUPABASE_KEY = "your_supabase_anon_key"
MQTT_BROKER  = "broker.hivemq.com"   # must match publisher
```

Then run:

```bash
python mqttworker.py
```

---

## Web Pages

| Page | Route | What it does |
|---|---|---|
| Login | `/` | Email + password sign-in via Supabase Auth |
| Dashboard | `/dashboard` | Live pollution score, combustion, aftertreatment scores updated in real time via MQTT |
| Profile | `/profile` | User info, vehicle garage, weekly Carbon Pulse gauge, recent trip history |
| Log Trip | `/logger` | Manual entry, odometer sync, or map route (beta) — calculates CO2 and saves to Supabase |
| Analytics | `/analytics` | 12-month emission trend, per-vehicle CO2 comparison, export CSV / PDF |

---

## Known Issues / To-Do

- `results` table is missing from `supabase_schema.sql` — needs to be added for MQTT pipeline to work
- Supabase credentials are currently hardcoded in `supabaseClient.js` — move to `.env`
- `analytics.js` still references `distance_miles` in one place — should be `distance_km`
- Map Route tab in logger is a placeholder (beta) — not yet functional
- Export CSV and Download PDF buttons in analytics are mock UI — not yet implemented

---

## License

Private — for educational use only.
