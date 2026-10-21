# 🎓 Student Management System

A full-stack **Student Management System** built with:

| Layer | Technology |
|-------|-----------|
| Frontend | React + Axios + Nginx |
| Backend | Python FastAPI + SQLAlchemy + Pydantic |
| Database | PostgreSQL 15 |
| DevOps | Docker + Docker Compose |

---

## 📁 Project Structure

```
student-management/
├── frontend/
│   ├── Dockerfile          ← Multi-stage: Node (build) → Nginx (serve)
│   ├── nginx.conf          ← Nginx SPA + /api reverse proxy
│   ├── package.json
│   └── src/
│       ├── App.jsx         ← Root component with header/footer
│       ├── App.css         ← Global dark-mode styles
│       ├── StudentList.jsx ← Container: search, CRUD, toast notifications
│       ├── StudentForm.jsx ← Add / Edit modal form with validation
│       ├── StudentTable.jsx← Data table with skeleton loader
│       ├── api.js          ← Axios client (uses /api proxy — works on any server)
│       └── index.js        ← React entry point
│
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py             ← FastAPI app, routes, CORS
│   ├── database.py         ← SQLAlchemy engine + retry logic
│   ├── models.py           ← ORM model (Student table)
│   └── schemas.py          ← Pydantic request/response schemas
│
├── compose.yaml            ← Orchestrates all 3 services
└── README.md
```

---

## 🌐 How It Works (Architecture)

```
Browser → http://localhost:8080
              │
              ▼
         Nginx (port 80 inside container)
              │
              ├── /api/*  → proxy → backend:8000 (FastAPI)
              │                         │
              │                         ▼
              │                    PostgreSQL (db:5432)
              │
              └── /*      → React SPA (static files)
```

**Key design decision:** The React frontend always calls `/api/*` (relative URL). Nginx forwards those requests to the FastAPI backend container on the internal Docker network. This means:
- Only **one port (8080)** needs to be open in your firewall.
- The app works identically on `localhost` and any remote server IP.

---

## 🚀 Quick Start

### Prerequisites

Make sure you have installed:
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

---

## 📋 Step-by-Step Commands

### 1. Open a Terminal in the Project Root

**Windows (PowerShell / Command Prompt):**
```powershell
cd "C:\Users\lahar\OneDrive\Desktop\aws project\student-management"
```

**macOS / Linux:**
```bash
cd /path/to/student-management
```

### 2. Build and Start All Containers

```bash
docker compose up --build -d
```

> **First build takes 3–8 minutes** — it downloads Docker images, installs npm packages, and compiles the React app. Subsequent builds are much faster.

### 3. Check Container Status

```bash
docker compose ps
```

Expected output — all three should show `Up`:
```
NAME                 STATUS              PORTS
student-db           Up (healthy)        0.0.0.0:5432->5432/tcp
student-backend      Up                  0.0.0.0:8000->8000/tcp
student-frontend     Up                  0.0.0.0:8080->80/tcp
```

### 4. View Logs

View all services at once:
```bash
docker compose logs
```

Follow live logs for a specific service:
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f db
```

### 5. Open the Frontend

**Local development:**
```
http://localhost:8080
```

**On an EC2 / cloud server (replace with your actual IP):**
```
http://YOUR_SERVER_IP:8080
```

### 6. Open FastAPI Swagger Documentation

**Local:**
```
http://localhost:8000/docs
```

**On EC2:**
```
http://YOUR_SERVER_IP:8000/docs
```

You can test all API endpoints directly from the Swagger UI.

### 7. Test the Health Endpoint

```bash
curl http://localhost:8000/health
# Expected: {"status":"ok","message":"Student Management API is running 🚀"}
```

### 8. Stop the Containers

Stop containers (data is preserved in the Docker volume):
```bash
docker compose down
```

### 9. Restart and Rebuild After Code Changes

```bash
docker compose up --build -d
```

### 10. Verify Data Persists After Restart

```bash
# Stop containers
docker compose down

# Start again (without --build to skip rebuild)
docker compose up -d

# Your student records will still be there ✅
```

---

## 🔗 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/students` | Get all students (optional `?search=`) |
| GET | `/students/{id}` | Get student by ID |
| POST | `/students` | Create new student |
| PUT | `/students/{id}` | Update student |
| DELETE | `/students/{id}` | Delete student |

### Example: Create a Student

```bash
curl -X POST http://localhost:8000/students \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Rahul Sharma",
    "email": "rahul@example.com",
    "department": "Computer Science",
    "year": 2,
    "phone": "+91 98765 43210"
  }'
```

### Example: Search Students

```bash
curl "http://localhost:8000/students?search=Rahul"
```

---

## 🗄️ Database Details

| Setting | Value |
|---------|-------|
| Host (inside Docker) | `db` |
| Port | `5432` |
| Database | `studentdb` |
| Username | `postgres` |
| Password | `postgres` |

Tables are **automatically created** on backend startup (no migrations needed).  
Data persists in the Docker named volume `student-postgres-data`.

---

## 🌍 Remote Deployment (AWS EC2 / Any Cloud Server)

### 1. Open required ports in your Security Group / Firewall

| Port | Purpose | Required? |
|------|---------|-----------|
| 8080 | Frontend (Nginx) | ✅ Yes |
| 8000 | Backend API / Swagger docs | Optional (only if you need direct API access) |
| 5432 | PostgreSQL | ❌ No (internal only) |

### 2. Access the app

Replace `YOUR_SERVER_IP` with your EC2 public IP:
```
http://YOUR_SERVER_IP:8080
```

The frontend automatically routes API calls through Nginx (`/api/*` proxy) so no configuration change is needed.

### 3. Security recommendations for production

- Change the PostgreSQL password in `compose.yaml`
- Remove the `5432` port mapping if external DB access isn't needed
- Consider using HTTPS (add an SSL certificate via Let's Encrypt + Certbot)

---

## 🎓 Student Fields

| Field | Type | Constraints |
|-------|------|-------------|
| `id` | integer | Auto-increment primary key |
| `name` | varchar(100) | Required |
| `email` | varchar(150) | Required, unique |
| `department` | varchar(100) | Required |
| `year` | integer | Required, 1–6 |
| `phone` | varchar(20) | Required |

---

## ❓ Troubleshooting

### Backend can't connect to the database

```bash
docker compose logs backend
# Look for retry messages — it retries up to 10 times automatically
```

If the database keeps failing, try a clean restart:
```bash
docker compose down
docker compose up --build -d
```

### Frontend shows "Failed to load students"

1. Check the backend is running:
   ```bash
   docker compose ps
   curl http://localhost:8000/health
   ```
2. Check that port 8080 is open (and port 8000 if you need direct API access).
3. Check Nginx logs:
   ```bash
   docker compose logs frontend
   ```

### Port already in use

If port 8080 or 8000 is already used by another app, change it in `compose.yaml`:
```yaml
ports:
  - "9080:80"   # Use 9080 instead of 8080
```

### Start completely fresh (delete all data)

⚠️ This deletes all student records!
```bash
docker compose down -v
docker compose up --build -d
```

### Windows: Docker not starting

Make sure Docker Desktop is running (look for the whale icon in the system tray).

---

## 🐳 Docker Architecture

```
┌─────────────────────────────────────────────────┐
│               student-network (bridge)           │
│                                                  │
│  ┌──────────────────┐    ┌──────────────────┐   │
│  │    frontend       │    │     backend       │   │
│  │  (Nginx :80)      │    │  (FastAPI :8000)  │   │
│  │                   │───▶│                  │   │
│  │  /api/* → proxy   │    │  /students       │   │
│  │  /*    → SPA      │    │  /health         │   │
│  └──────────────────┘    └────────┬─────────┘   │
│         ↑                         │               │
│    port 8080                      │               │
│    (host)                  ┌──────▼──────┐        │
│                             │     db      │        │
│                             │ (Postgres   │        │
│                             │  :5432)     │        │
│                             └─────────────┘        │
│                                   ↑                │
│                              postgres_data          │
│                               (volume)             │
└─────────────────────────────────────────────────┘
```
