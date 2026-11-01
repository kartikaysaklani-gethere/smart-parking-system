# Smart Parking System with Intelligent Slot Detection 🚗⚡

An enterprise-ready, mobile-responsive IoT Smart Parking web application built with **Next.js 15 (App Router, TypeScript)**, **Tailwind CSS**, **shadcn/ui**, and **Supabase (Postgres, Auth, Realtime)**. Designed for an engineering college lab project and live exhibition showcase.

---

## 🌟 Key Features

1. **6-Slot Dual-Floor Garage Model**:
   - **Ground Floor (Level 0)**:
     - `G1`: Sensor Slot (ESP32 Ultrasonic HC-SR04)
     - `G2`: Sensor Slot (ESP32 Ultrasonic HC-SR04)
     - `G3`: Virtual Slot (Dummy car pasted, always occupied, admin editable)
   - **1st Floor (Level 1)**:
     - `F1`: Sensor Slot (ESP32 Ultrasonic HC-SR04)
     - `F2`: Virtual Slot (Bookable online or via walk-in)
     - `F3`: Virtual Slot (Permanently reserved for VIP/Staff)
   - Real-time Slot States: `free`, `booked`, `assigned`, `occupied`, `reserved`, `maintenance`.

2. **Cryptographic QR Pass (HMAC-SHA256)**:
   - Generated instantly on booking reservation.
   - Encodes driver name, phone, vehicle plate, car model/color, slot code, duration, tariff, and timestamp.
   - Validated server-side via constant-time cryptographic signature verification to reject tampering, expired tickets, or duplicate entries.

3. **Gate Staff Kiosk (`/gate`)**:
   - Live camera QR barcode scanner (compatible with MacBook webcam and mobile browser cameras).
   - "Confirm Entry": Automatically opens servo gate, triggers slot guidance LED on ESP32, and activates directional LCD display ("Go to slot X").
   - "Walk-In" allocation modal: assigns available free slots (sensor slots prioritized).
   - "Check Out" tab: computes exact parking duration with hourly rounding rules.

4. **Dynamic Tariff & Hourly Rounding (INR ₹)**:
   - Default tariff ₹40/hr (stored in database and editable via admin page).
   - Walk-in sessions billed by actual time rounded up to the next full hour (minimum 1 hour).
   - Overstay penalties calculated automatically if pre-booked slots exceed allotted time.

5. **ESP32 Hardware Telemetry API (`POST /api/device/telemetry`)**:
   - Authenticated with `x-device-key` header.
   - Controls physical slot LEDs (LED turns ON only when slot is assigned and car is en route; turns OFF when car is parked).
   - Feeds 16x2 I2C LCD with latest assignment navigation for 20 seconds, or dynamic floor-wise free counts (`"Free: 4/6"`, `"G:2 F:2"`, or `"PARKING FULL"`).
   - Detects hardware heartbeats (< 6s = "Online").

6. **Interactive Demo Simulator (`/admin`)**:
   - Allows judges, evaluators, and presenters to simulate the entire hardware loop directly in software without needing physical ESP32 boards wired!
   - Toggle ultrasonic sensors, simulate entrance gate triggers, inspect raw JSON payloads, and view simulated retro LCD display and pinout LEDs.

---

## 🎨 Color Palette & Design System

- **Navy**: `#0B2545` (Primary headings, dark accents)
- **Teal**: `#0F9D9A` (Brand accent, active states, buttons)
- **Amber**: `#F2A541` (In-transit alerts, warnings)
- **Light Background**: `#F4F8FB`
- **Dark Mode**: Deep midnight navy `#08111e` and `#0c182a` cards
- Accessible down to **375px mobile screens** up to 4K ultra-wide monitors.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+ (Node 20+ recommended)
- npm or pnpm

### 2. Installation
```bash
git clone <repo-url>
cd smart-parking-system
npm install
```

### 3. Setup Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Automated Testing

The project includes automated test suites covering:
- Overlap prevention & anti-double-booking constraints
- Cryptographic HMAC-SHA256 signature verification & tampering detection
- Pricing engine & hourly rounding calculations
- ESP32 hardware endpoint LED & 16x2 LCD display logic
- Full end-to-end user & hardware journey

Run all tests:
```bash
npm test
```

Run build verification:
```bash
npm run build
```

---

## 🗄️ Supabase Database Setup & Migrations

If deploying with Supabase:
1. Create a project at [supabase.com](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Run the migrations in order from the `supabase/migrations/` folder:
   - `001_initial_schema.sql` (Tables, indexes, and realtime publication)
   - `002_rls_policies.sql` (Row Level Security rules)
   - `003_functions.sql` (Transactional overlap prevention & cleanup cron)
   - `004_seed.sql` (Initial 6 slots, pricing, and sample analytics data)
4. Copy your **Project URL**, **Anon Key**, and **Service Role Key** from Supabase Settings -> API into `.env.local`.

*(Note: If you run locally without configuring Supabase, the application automatically uses its built-in in-memory stateful store so that all features, APIs, and the demo simulator work out of the box).*

---

## 🤖 ESP32 IoT Device Integration & API Specification

### Hardware Wiring
- **Microcontroller**: ESP32 NodeMCU (30-pin or 38-pin)
- **Ultrasonic Sensors (HC-SR04)**:
  - G1 Sensor: Trig Pin 13, Echo Pin 12
  - G2 Sensor: Trig Pin 14, Echo Pin 27
  - F1 Sensor: Trig Pin 26, Echo Pin 25
  - Gate Entrance Sensor: Trig Pin 33, Echo Pin 32
- **Actuators**:
  - SG90 Servo Motor: PWM Pin 18 (Gate barrier)
  - 16x2 I2C LCD Display: SDA Pin 21, SCL Pin 22 (Address `0x27`)
  - Slot LEDs: G1 LED (Pin 2), G2 LED (Pin 4), F1 LED (Pin 5)

### API Endpoint
`POST /api/device/telemetry`

**Headers**:
```http
Content-Type: application/json
x-device-key: esp32_smart_parking_secret_key_2026
```

**Request Body Example**:
```json
{
  "slots": {
    "G1": false,
    "G2": true,
    "F1": false
  },
  "gate": {
    "car_present": true,
    "distance_cm": 12
  }
}
```

**Response Example**:
```json
{
  "leds": {
    "G1": true,
    "G2": false,
    "F1": false
  },
  "lcd": [
    "Go to slot G1",
    "Ground Floor"
  ],
  "gate_hold": true,
  "server_time": "2026-11-02T00:15:00.000Z"
}
```

### Test with cURL
```bash
curl -X POST http://localhost:3000/api/device/telemetry \
  -H "Content-Type: application/json" \
  -H "x-device-key: esp32_smart_parking_secret_key_2026" \
  -d '{
    "slots": { "G1": false, "G2": true, "F1": false },
    "gate": { "car_present": true, "distance_cm": 15 }
  }'
```

---

## 🌐 Deploy to Vercel

1. Push this repository to GitHub / GitLab.
2. Go to [vercel.com](https://vercel.com) and click **"Add New Project"**.
3. Import this repository.
4. Set the Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `DEVICE_API_KEY`
   - `QR_SECRET`
   - `CRON_SECRET`
   - `NEXT_PUBLIC_APP_URL`
5. Click **Deploy**. Vercel will build and deploy the app with edge performance.

---

## 👥 Project Information
- **Project**: Smart Parking System with Intelligent Slot Detection
- **Domain**: IoT, Embedded Systems, Cloud Computing, Full-Stack Web Development
- **Target**: College Lab Project & Engineering Expo Demonstration
