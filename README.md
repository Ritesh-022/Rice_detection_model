# RiceAI — AI-Based Rice Grain Quality Analysis System 

An end-to-end AI platform that analyses rice grain images and returns quality grades, market prices, shelf-life estimates, and LLM-generated storage advice — built for Indian farmers and grain traders.

---

## 1. Project Overview

RiceAI accepts 1–5 rice grain photos, runs them through a three-stage computer-vision pipeline (YOLO segmentation → EfficientNet-B0 classification → health scoring), and produces a structured report with:

- Grain health score (0–100 %)
- Quality grade (Premium Export / Local Market / Processing Grade / Animal Feed)
- Live APMC mandi market price for the selected Indian state
- Shelf-life estimate (FSSAI / ICAR-NRRI standards)
- Supply-chain recommendation
- LangChain + Ollama (LLaMA 3) AI narrative for storage and handling
- Downloadable PDF report with embedded donut charts
- Email delivery of the PDF report
- IoT sensor data panel (optional)

**Target users:** Smallholder farmers, grain traders, APMC mandi agents, food-processing procurement teams.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (React)                       │
│  Home · Scan · Result · IoT · About                         │
│  Vite 5 · React 18 · React Router 6 · Recharts · i18next   │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP (Axios / Fetch)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│               Node.js / Express Backend  :6532               │
│  Routes → Controllers → Queue (Knapsack) → Worker           │
│  Multer upload · Sharp sanitise · Steganography scan        │
│  PDFKit report · Nodemailer email · Cleanup scheduler       │
└──────────┬──────────────────────────┬───────────────────────┘
           │ Mongoose ODM             │ HTTP multipart/form-data
           ▼                          ▼
┌──────────────────┐      ┌──────────────────────────────────┐
│   MongoDB        │      │   Flask ML Service  :5000         │
│   rice_quality   │      │   YOLO segmentation               │
│   AnalysisJob    │      │   EfficientNet-B0 classification  │
└──────────────────┘      │   Health scoring                  │
                           │   LangGraph orchestration         │
                           │   LangChain + Ollama (LLaMA 3)   │
                           │   Agmarknet API (mandi prices)    │
                           └──────────────────────────────────┘
```

**Components:**

- **Frontend** — React 18 SPA served by Vite dev server (port 5173)
- **Backend** — Express API server (port 6532); owns job lifecycle, queue, PDF, email
- **ML Service** — Flask server (port 5000); owns all model inference and LLM calls
- **Database** — MongoDB (local, `rice_quality` database)
- **External services** — Agmarknet / data.gov.in API for live mandi prices; Ollama for local LLM inference

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite 5, React Router 6, Recharts 2, i18next, Web Speech API |
| Backend | Node.js, Express 4, Mongoose 8, Multer, Sharp, PDFKit, Nodemailer |
| ML Service | Python, Flask, YOLOv8 (Ultralytics), PyTorch, EfficientNet-B0, LangChain, LangGraph, Ollama (LLaMA 3) |
| Database | MongoDB (local) |
| Security | Helmet, express-rate-limit, steganography detection, EXIF stripping, SHA-256 hashing |
| DevOps | `start.bat` launcher, scheduled cleanup, graceful shutdown |

---

## 4. Project Structure

```
Rice_Models/
├── ai_models/                   # Flask ML service
│   ├── ml_service.py            # Single-file pipeline: YOLO + EfficientNet-B0 + LangGraph + Flask
│   ├── segmentation/
│   │   └── segmentation.pt      # YOLOv8 grain detection model
│   ├── recognization/
│   │   ├── recognization.pth    # EfficientNet-B0 rice variety classifier
│   │   └── recog_classes.json   # Variety label map
│   └── health/
│       ├── health.pth           # Health scoring model
│       └── health_classes.json  # Health label map
│
├── stack/
│   ├── backend/                 # Express API server
│   │   ├── server.js            # Bootstrap: DB, queue, schedulers, Express app
│   │   ├── routes/              # Route definitions (v1 + legacy)
│   │   ├── controllers/         # Request handlers (analysis, health, notify, pdf)
│   │   ├── queue/
│   │   │   ├── index.js         # In-memory job queue with drain loop
│   │   │   ├── worker.js        # Job processor: Flask call → PDF generation
│   │   │   └── knapsack.js      # Priority scheduling via 0/1 knapsack algorithm
│   │   ├── services/            # Business logic (email, PDF, file, steganography, cleanup)
│   │   ├── src/
│   │   │   ├── config/          # env.js, database.js, flask.js
│   │   │   ├── models/          # AnalysisJob Mongoose schema
│   │   │   ├── middleware/      # Multer upload, error handler
│   │   │   └── services/        # flaskClient, storage, analysis, steganography
│   │   ├── storage/
│   │   │   ├── uploads/sanitized/   # EXIF-stripped, re-encoded images
│   │   │   └── pdfs/                # Generated PDF reports
│   │   └── .env
│   │
│   └── frontend2/               # React SPA
│       ├── src/
│       │   ├── pages/           # Home, Scan, Result, IoT, About, NotFound
│       │   ├── components/      # Dropzone, MetricGrid, AISummary, Charts, IoT, Nav
│       │   ├── hooks/           # useJob (upload), usePoll (result polling), useTTS
│       │   ├── context/         # JobContext (global job state), LangContext
│       │   ├── services/        # api.js (HTTP), analysis.js (polling), pdf.js, storage.js
│       │   ├── utils/           # normalise.js (ML response → UI shape), status.js
│       │   └── i18n/            # English, Hindi, Kannada translations
│       └── .env
│
└── start.bat                    # One-click launcher for all three services
```

---

## 5. Application Workflow

1. **User opens the app** at `http://localhost:5173` — sees the dashboard with scan history (localStorage).
2. **User navigates to `/scan`** — selects user mode (Farmer / Consumer), picks an Indian state, and drops 1–5 rice grain images.
3. **Frontend POSTs** `multipart/form-data` to `POST /api/v1/analyze`.
4. **Backend sanitises uploads** — magic-byte MIME validation, EXIF stripping via Sharp, SHA-256 hashing, steganography scan.
5. **AnalysisJob is created** in MongoDB with status `QUEUED`. A UUID is returned immediately (HTTP 202).
6. **Frontend navigates** to `/result/:uuid` and begins polling `GET /api/v1/result/:uuid` every 2.5 s.
7. **Queue worker picks up the job** — knapsack scheduler prioritises by age and image count.
8. **Worker calls Flask** — `POST /predict` (single image) or `POST /batch` (multiple images).
9. **Flask pipeline runs:**
   - YOLO detects and crops individual grains
   - EfficientNet-B0 classifies each grain's variety
   - Health model scores each grain
   - LangGraph orchestrates the full pipeline
   - Agmarknet API fetches live mandi price for the selected state
   - LangChain + Ollama generates storage/handling advice
10. **Flask returns** a structured JSON response with summary, market price, shelf life, supply chain, and LLM narrative.
11. **Backend stores** `mlResponse` in MongoDB, sets status to `COMPLETED`, and generates a PDF report via PDFKit.
12. **Frontend poll resolves** — result is normalised and rendered: MetricGrid, pie charts, AI summary, share bar, email gate.
13. **User can download the PDF** via `GET /api/v1/pdf/:uuid` or **email it** via `POST /api/v1/notify/email`.

---

## 6. Web Architecture

**Request lifecycle:**

```
Browser
  └─► POST /api/v1/analyze  (multipart)
        └─► uploadImages middleware  (Multer, memory storage)
              └─► createAnalysisJob controller
                    ├─► sanitizeImageUploads  (Sharp + steganography)
                    ├─► AnalysisJob.create()  (MongoDB)
                    ├─► enqueueJob()          (in-memory queue)
                    └─► 202 { uuid, status: "queued" }

Browser polls GET /api/v1/result/:uuid  every 2500 ms
  └─► getAnalysisResult controller
        └─► AnalysisJob.findOne()
              ├─► queued/processing → 200 { uuid, status }
              └─► completed        → 200 { uuid, status, ml_response }

Queue drain loop (setInterval 1 s)
  └─► selectJobsWithKnapsack()
        └─► processQueueJob()
              ├─► callPredictApi() or callBatchApi()  → Flask :5000
              ├─► AnalysisJob.updateOne(COMPLETED, mlResponse)
              └─► generatePdfFromMlResponse()         → storage/pdfs/
```

**Key middleware chain (Express):**

- `cors` — whitelist `localhost:5173` and `localhost:5174`
- `helmet` — security headers
- `rateLimit` — 120 req/min global; 5 req/min on email endpoint
- `express.json` — 1 MB body limit
- `uploadImages` — Multer memory storage, MIME filter
- `errorHandler` — centralised error formatting

**Frontend state:**

- `JobContext` — global atoms: `uuid`, `status`, `result`, `loading`, `error`
- `useJob` — upload form state + `submit()` / `reset()`
- `usePoll` — polling loop tied to UUID from URL params
- `localStorage` — scan history (no server-side user accounts)

---

## 7. API Documentation

### POST /api/v1/analyze

Submit rice grain images for analysis.

**Request:** `multipart/form-data`

| Field | Type | Description |
|---|---|---|
| `images` | `File[]` | 1–5 JPG/PNG images, max 10 MB each |
| `region` | `string` | Indian state name (e.g. `"Karnataka"`) |
| `userMode` | `string` | `"farmer"` or `"consumer"` |

**Response:** `202 Accepted`
```json
{
  "success": true,
  "data": {
    "uuid": "3f7a1c2d-...",
    "status": "queued"
  }
}
```

---

### GET /api/v1/result/:uuid

Poll job status. Call every 2–3 seconds until `status` is `"completed"` or `"failed"`.

**Response (queued / processing):** `200`
```json
{
  "success": true,
  "data": {
    "uuid": "3f7a1c2d-...",
    "status": "processing"
  }
}
```

**Response (completed):** `200`
```json
{
  "success": true,
  "data": {
    "uuid": "3f7a1c2d-...",
    "status": "completed",
    "ml_response": {
      "summary": {
        "grain_count": 142,
        "dominant_type": "Basmati",
        "health_percentage": 87.3,
        "healthy_count": 124,
        "unhealthy_count": 18,
        "health_distribution": {
          "healthy": 124,
          "broken_high": 12,
          "discoloured_high": 6
        }
      },
      "market_price": 3.45,
      "shelf_life": "5–6 months (hermetic storage)",
      "supply_chain": "local_market",
      "llm_response": "Store in a cool, dry place at 15–20°C...",
      "iot_data": null,
      "price_breakdown": { ... },
      "user_mode": "farmer"
    }
  }
}
```

**Response (failed):** `500`
```json
{
  "success": false,
  "data": {
    "uuid": "3f7a1c2d-...",
    "status": "failed",
    "error": "Flask API request failed with status 500"
  }
}
```

---

### GET /api/v1/pdf/:uuid

Stream the generated PDF report.

| Query param | Type | Description |
|---|---|---|
| `regenerate` | `boolean` | Pass `true` to force PDF rebuild |

**Response:** `200 application/pdf` (inline stream)

---

### POST /api/v1/pdf/:uuid/email

Email the PDF report to an address.

**Request body (JSON):**
```json
{
  "email": "user@example.com"
}
```

**Response:** `200`
```json
{
  "success": true,
  "data": {
    "uuid": "3f7a1c2d-...",
    "emailSent": true,
    "resultLink": "http://localhost:5173/result/3f7a1c2d-...",
    "accepted": ["user@example.com"],
    "rejected": []
  }
}
```

---

### POST /api/v1/notify/email

Send the PDF report by email (rate-limited: 5 req/min per IP).

**Request body (JSON):**
```json
{
  "uuid": "3f7a1c2d-...",
  "email": "user@example.com"
}
```

**Response:** `200` — same shape as above.

**Error codes:** `400` invalid input · `404` job not found · `409` job not completed · `429` rate limited · `500` SMTP failure

---

### GET /api/v1/health

Returns system health status.

**Response:** `200`
```json
{
  "success": true,
  "data": {
    "server": { "status": "running", "uptime": 3600 },
    "mongodb": { "connected": true },
    "flask": { "healthy": true },
    "queue": { "pending": 0, "active": 1 }
  }
}
```

---

### Flask ML Endpoints (internal — called by Node worker only)

| Endpoint | Method | Description |
|---|---|---|
| `/predict` | POST | Single image analysis |
| `/batch` | POST | Multi-image batch analysis |
| `/health` | GET | Flask service health check |

---

## 8. Environment Setup

### Backend — `stack/backend/.env`

```env
# Server
PORT=6532
NODE_ENV=development

# Database
MONGO_URI=mongodb://127.0.0.1:27017/rice_quality

# Flask ML service
FLASK_API_URL=http://127.0.0.1:5000

# SMTP (Gmail example)
SMTP_SERVICE=gmail
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=your@gmail.com

# Frontend URL — used in email result links
FRONTEND_URL=http://localhost:5173

# Upload limits
MAX_UPLOAD_FILES=5
MAX_FILE_SIZE_MB=10

# Queue
QUEUE_CAPACITY=25
QUEUE_CONCURRENCY=2

# Flask timeout
FLASK_TIMEOUT_MS=180000

# Cleanup
CLEANUP_INTERVAL_MS=21600000   # 6 hours
TEMP_RETENTION_HOURS=24
PDF_RETENTION_DAYS=30

# Security
STRICT_STEGO_REJECTION=false
```

| Variable | Description |
|---|---|
| `PORT` | Express server port |
| `MONGO_URI` | MongoDB connection string |
| `FLASK_API_URL` | Base URL of the Flask ML service |
| `SMTP_SERVICE` | Nodemailer service name (e.g. `gmail`) |
| `SMTP_USER` / `SMTP_PASS` | SMTP credentials (use Gmail App Password) |
| `FRONTEND_URL` | Used to build result links in emails |
| `QUEUE_CONCURRENCY` | Max parallel Flask calls |
| `FLASK_TIMEOUT_MS` | Abort Flask call after this many ms |
| `PDF_RETENTION_DAYS` | Auto-delete PDFs older than N days |
| `STRICT_STEGO_REJECTION` | Reject uploads flagged as steganographic |

### Frontend — `stack/frontend2/.env`

```env
VITE_API_BASE=http://localhost:6532/api
VITE_APP_URL=http://localhost:5173
```

### Flask ML Service — `ai_models/ml_service.py` (top of file)

Key constants to review before deployment:

```python
YOLO_MODEL_PATH   = r"segmentation\segmentation.pt"
CLASS_MODEL_PATH  = r"recognization\recognization.pth"
HEALTH_MODEL_PATH = r"health\health.pth"
FLASK_HOST        = "0.0.0.0"
FLASK_PORT        = 5000
OLLAMA_MODEL      = "llama3"
OLLAMA_HOST       = "http://localhost:11434"
AGMARKNET_API_KEY = "<your_data_gov_in_api_key>"
USE_GPU           = True
```

---

## 9. Installation & Setup

### Prerequisites

- Python 3.10+
- Node.js 20+
- MongoDB 6+ (running locally)
- Ollama with LLaMA 3 pulled (`ollama pull llama3`)
- CUDA-capable GPU (optional but recommended for Flask)

### Steps

**1. Clone the repository**
```bash
git clone <repo-url>
cd Rice_Models
```

**2. Install Python dependencies**
```bash
cd ai_models
pip install flask torch torchvision ultralytics langchain langchain-community langgraph opencv-python pillow numpy beautifulsoup4 timm
```

**3. Install Node backend dependencies**
```bash
cd stack/backend
npm install
```

**4. Install frontend dependencies**
```bash
cd stack/frontend2
npm install
```

**5. Configure environment files**
```bash
# Backend
cp stack/backend/.env.example stack/backend/.env
# Edit SMTP_USER, SMTP_PASS, MONGO_URI as needed

# Frontend
cp stack/frontend2/.env.example stack/frontend2/.env
```

**6. Start MongoDB**
```bash
mongod --dbpath /data/db
```

**7. Start Ollama**
```bash
ollama serve
ollama pull llama3
```

**8. Start all services (Windows)**
```bash
start.bat
```

This opens three terminal windows:
- Flask ML Service on `:5000`
- Node Backend on `:6532`
- Vite Frontend on `:5173`

**Or start manually:**
```bash
# Terminal 1
cd ai_models && python ml_service.py

# Terminal 2
cd stack/backend && node server.js

# Terminal 3
cd stack/frontend2 && npm run dev
```

**9. Open the app**

Navigate to `http://localhost:5173`

---

## 10. Real-World Implementation Notes

**Production deployment checklist:**

- Run Flask behind Gunicorn with multiple workers: `gunicorn -w 2 -b 0.0.0.0:5000 ml_service:app`
- Run Node behind PM2: `pm2 start server.js --name riceai-backend`
- Serve the Vite build via Nginx: `npm run build` → serve `dist/`
- Use MongoDB Atlas or a replica set instead of a local instance
- Replace local Ollama with a hosted LLM API (OpenAI, Bedrock) for reliability
- Store uploads and PDFs in S3 or equivalent object storage instead of local disk
- Set `NODE_ENV=production` and use a proper secrets manager for credentials
- Enable `STRICT_STEGO_REJECTION=true` in production

**Scaling considerations:**

- The knapsack queue is in-memory — replace with Redis + BullMQ for multi-instance deployments
- Flask is CPU/GPU-bound — scale horizontally with a load balancer across multiple GPU nodes
- MongoDB indexes on `status + createdAt` are already in place for queue hydration queries
- PDF generation is synchronous in the worker — offload to a separate worker process under high load

---

## 11. Security Considerations

**Upload security:**
- Magic-byte MIME validation (not just `Content-Type` header)
- EXIF metadata stripped via Sharp before storage
- SHA-256 hash recorded before and after sanitisation
- Steganography detection (Shannon entropy, LSB balance, PNG trailing bytes, JPEG segment count)
- File names sanitised — control characters and path traversal characters removed
- Max 5 files, max 10 MB each enforced at Multer level

**API security:**
- Helmet sets `X-Content-Type-Options`, `X-Frame-Options`, CSP, and other headers
- CORS restricted to explicit origin whitelist
- Global rate limit: 120 req/min; email endpoint: 5 req/min per IP
- `x-powered-by` header disabled
- JSON body capped at 1 MB

**Secrets handling:**
- All secrets in `.env` files — never committed (add `.env` to `.gitignore`)
- Use Gmail App Passwords, not your account password
- Rotate `AGMARKNET_API_KEY` periodically

**Data retention:**
- Uploaded images deleted after `TEMP_RETENTION_HOURS` (default 24 h)
- PDFs deleted after `PDF_RETENTION_DAYS` (default 30 days)
- No user accounts — scan history lives only in the browser's localStorage

---

## 12. Performance & Optimization

**ML pipeline:**
- GPU inference enabled by default (`USE_GPU=True`) — falls back to CPU automatically
- YOLO confidence threshold (`0.65`) and NMS IOU threshold (`0.45`) tuned to reduce false positives
- Max 500 grains per image to cap inference time
- Batch endpoint processes multiple images in a single Flask call

**Queue:**
- Knapsack scheduler maximises throughput by selecting the highest-value job set that fits within `QUEUE_CAPACITY`
- `QUEUE_CONCURRENCY=2` prevents Flask from being overwhelmed
- Queue hydrates from MongoDB on startup — no jobs lost on Node restart

**Backend:**
- PDF is generated once and cached on disk; only regenerated when stale (PDF older than job completion time)
- Cleanup scheduler runs every 6 hours to prevent disk bloat
- Mongoose lean queries (`.lean()`) used for read-only result fetches

**Frontend:**
- Polling stops immediately on terminal status — no wasted requests
- `usePoll` skips polling if `JobContext` already holds a completed result for the UUID
- Scan history stored in localStorage — zero API calls on the Home page


