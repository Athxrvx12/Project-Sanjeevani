# 📡 Project Sanjeevani | Real-Time AI Medical Logistics Network

Project Sanjeevani is an end-to-end, multi-tenant digital health platform engineered to bridge the gap between critical patients and fragmented medical supply chains. By utilizing computer vision and zero-latency networking, the platform digitizes handwritten prescriptions and instantly broadcasts localized emergency pings to nearby verified pharmacies for rapid stock fulfillment.

---

## 🛠️ The Technology Stack

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js (React), TypeScript | Handles responsive UI logic, routing, and client state. |
| **Styling & Theme** | Tailwind CSS v4, Next-Themes | Implements glassmorphic dark/light mode design semantics. |
| **Database & Real-Time**| Supabase (PostgreSQL) | Manages multi-tenant relational data and WebSocket sync. |
| **AI Microservice** | Python, FastAPI, Google Gemini | Dedicated vision computation cluster deployed on Render. |
| **Mapping Engine** | React-Leaflet, OpenStreetMap | Renders interactive geospatial data and distance matrix routing. |

---

## 🚀 Implemented Architecture (Current Build)

The application is decoupled into an asynchronous, secure service-oriented architecture:

### 1. The AI Vision Engine (Prescription Digitization)
* **Handwriting Extraction:** Integrates Google Gemini Vision AI via a dedicated Python FastAPI microservice to ingest unstructured, handwritten prescription images.
* **Structured Parsing:** Processes raw text into a strict, programmatic JSON schema detailing medicine names and dosages, handed back cleanly to the client core.

### 2. Geospatial Proximity Radar
* **Dynamic Radius Scan:** Utilizes the OpenStreetMap Overpass API to dynamically scan and identify verified local pharmacies within a 5km radius of the user's localized GPS coordinates.
* **Distance Computation:** Implements the mathematical **Haversine Formula** natively in TypeScript to calculate absolute terrestrial proximity.

### 3. Zero-Latency Real-Time Loop
* **WebSocket Event Streaming:** Leverages Supabase Real-Time engine (`pg_changes` channel over WebSockets) to broadcast emergency medicine inquiries instantly to targeted pharmacists without manual API polling or page refreshes.
* **Polling Failsafe Protocol:** Built an automatic 3-second database polling interval into the client core as an architectural redundancy system in case of sudden network jitter or dropped WebSocket handshakes.

### 4. Enterprise-Grade Security & Multi-Tenancy
* **Cryptographic Access Control:** Utilizes Supabase Auth to isolate corporate pharmacy profiles linking authenticated credentials to distinct OpenStreetMap Facility IDs.
* **Row Level Security (RLS):** Implements strict PostgreSQL RLS policies directly on the database cluster, mathematically verifying tokenized signatures (`auth.uid()`) to ensure no pharmacy tenant can intercept or view data rows belonging to another.

---

## 💡 Impact & Benefits

* **Erases Time-to-Fulfillment:** Eliminates the grueling manual process of physically driving or calling multiple pharmacies sequentially during late-night emergencies.
* **Optimized Resource Allocation:** Pushes critical inquiries cleanly onto a dedicated, secure dashboard, allowing pharmacists to quickly communicate itemized inventory availability in under two clicks.
* **Instant Allocation:** Generates dynamic UPI deep links (`upi://pay?...`) calculated accurately against available quantities, allowing immediate allocation fees to lock down crucial stock.

---

## 📦 Getting Started

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

### Prerequisites
Ensure you have Node.js (v18+) and your environment variables set up for Supabase and the FastAPI backend.

### Run the Development Server

First, install dependencies and run the development server:

```bash
npm install
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
