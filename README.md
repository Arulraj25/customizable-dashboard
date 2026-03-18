  DashForge - Custom Dashboard Builder
  
  DashForge is a full-stack web application that allows users to create customizable dashboards and manage customer orders. It includes a CI/CD pipeline for automated deployment using Jenkins and Docker.
  
  Tech Stack
  
  Backend: Flask (Python)
  
  Frontend: HTML, CSS, JavaScript
  
  Database: MySQL
  # DashForge · Custom Dashboard Builder

> A production-grade, full-stack web application for building customizable data dashboards and managing customer orders — with drag-and-drop layout, commit history, real-time refresh, and automated CI/CD deployment.

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Online-10d9a0?style=flat-square)](http://32.192.50.89:8000)
[![YouTube](https://img.shields.io/badge/Demo%20Video-YouTube-red?style=flat-square)](https://www.youtube.com/watch?v=AX4GiqDjdZA)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=flat-square&logo=github)](https://github.com/Arulraj25/customizable-dashboard)

---

## Overview

DashForge lets teams build live dashboards from real order data — without writing code. Drag a chart widget onto a canvas, configure its data source and style, save the layout, and your dashboard is live. Every change is versioned with a commit message so you can preview and restore any past state.

The platform includes a full customer order management system (CRUD), a rule-based widget data engine, real-time auto-refresh, a Git-style commit history for dashboards, PDF export, advanced data filters, and a Dark/Light theme toggle.

Deployed on **AWS EC2** behind **Nginx**, containerised with **Docker**, and continuously delivered via a **Jenkins** CI/CD pipeline.

---

## Live Access

| Resource | URL |
|---|---|
| Application | http://32.192.50.89:8000 |
| Demo Video (YouTube) | https://www.youtube.com/watch?v=AX4GiqDjdZA |
| GitHub Repository | https://github.com/Arulraj25/customizable-dashboard |

---

## Features

### Core

| Feature | Description |
|---|---|
| **Dashboard Builder** | Drag-and-drop canvas using Gridstack.js — place, resize, and rearrange widgets freely |
| **Multiple Dashboards** | Create, rename, switch between, and delete named dashboards via a tab interface |
| **Widget Types** | Bar Chart, Line Chart, Pie Chart, Area Chart, Scatter Plot, Data Table, KPI Value |
| **Widget Configuration** | Per-widget settings panel: data source, axes, color, aggregation, pagination, font size |
| **Order Management** | Full CRUD for customer orders with search, status filter, and inline validation |
| **Save & Load** | Dashboard layouts (positions, sizes, settings) are persisted in MySQL as JSON |

### Unique Additions

| Feature | Description |
|---|---|
| ★ **Commit History** | Every save records a commit message — browse the full history, preview any snapshot, restore with one click |
| ★ **Commit Preview** | Read-only render of any historical dashboard state at `/preview/<id>` — restore only if you choose |
| ★ **KPI Smart Trends** | KPI widgets show `↑ 12% vs last 7 days` — compares current 7-day window against the prior 7-day window |
| ★ **Real-Time Refresh** | Dashboard data auto-refreshes every 10 seconds via AJAX polling (pauses when tab is hidden) |
| ★ **Widget Auto-Refresh** | Per-widget configurable refresh interval: Off / 10s / 30s / 1 minute |
| ★ **Advanced Filters** | Global filter bar for Product, Status, Created By, and Country — all widgets update dynamically |
| ★ **Export PDF** | One-click PDF export using html2canvas + jsPDF — captures the live dashboard exactly as rendered |
| ★ **Dark / Light Theme** | Full theme toggle with preference saved to `localStorage` — designed for both themes from the start |
| ★ **Duplicate Widget** | Copy any widget with all its settings in one click — placed next to the original |
| ★ **Dimension-Responsive** | `ResizeObserver` detects each widget's frame shape and auto-rotates KPI layout (horizontal / vertical / square) |

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Python 3.10+ · Flask 3.0 | REST API, page routing, server-side data aggregation |
| **Database** | MySQL 8.0 | Persistent storage for orders, dashboards, commit history |
| **ORM / DB Driver** | Flask-MySQLdb · mysqlclient | Database connection management |
| **Frontend** | HTML5 · CSS3 · Vanilla JavaScript | Zero-framework SPA — fast, simple, debuggable |
| **Charts** | Chart.js 4 | Bar, Line, Pie, Area, Scatter rendering |
| **Grid / Drag-Drop** | Gridstack.js 10 | 12-column drag-resize layout engine |
| **PDF Export** | html2canvas 1.4 · jsPDF 2.5 | Client-side PDF generation |
| **Fonts** | Syne (display) · Outfit (body) | Google Fonts — loaded via CDN |
| **Containerisation** | Docker · Docker Compose | Reproducible production containers |
| **CI/CD** | Jenkins | Automated build and deployment pipeline |
| **Cloud** | AWS EC2 | Application hosting |
| **Proxy** | Nginx | Reverse proxy, SSL termination, static file serving |

---

## Project Structure

```
dashforge/
│
├── app.py                          ← Flask app entry point — all routes & API endpoints
├── config.py                       ← DB and app settings (single .env change point)
├── requirements.txt
│
├── database/
│   ├── schema.sql                
├── templates/
│   ├── layout.html                 ← Base layout: sidebar nav, CDN imports, global JS helpers
│   ├── dashboard.html              ← Live dashboard view: filters, date range, PDF export
│   ├── configure_dashboard.html    ← Drag-and-drop builder: tabs, palette, settings panel
│   ├── orders.html                 ← Order management table + create/edit modal
│   └── preview_commit.html         ← Read-only historical commit snapshot with restore option
│
└── static/
    ├── css/
    │   └── style.css               ← Design system: CSS variables, dark/light themes, responsive
    └── js/
        ├── widgets.js              ← Shared widget renderer (KPI, chart, pie, table) + auto-refresh
        ├── dashboard.js            ← Dashboard view logic: grid init, real-time refresh, filters
        ├── configure.js            ← Builder: drag-drop, widget menus, save modal, commit history
        └── orders.js               ← Orders CRUD: load table, form validation, auto-calc total
```


## How the Dashboard Builder Works

```
User drags palette item → canvas
         │
         ▼
Gridstack.js creates grid item (x, y, w, h)
         │
         ▼
Widget shell rendered (title, body, ⋯ menu)
         │
         ▼
POST /api/widget/<type>  ← fetches data from MySQL
         │
         ▼
Chart.js / table HTML injected into widget body
         │
         ▼
User clicks "Save Dashboard"
         │
         ▼
Modal prompts: Dashboard Name + Commit Message (both required)
         │
         ▼
POST /api/dashboards  ← saves layout JSON + records commit snapshot
         │
         ▼
Dashboard loads on return visit — layout restored from JSON
```

### How Commit History Works

```
Save Dashboard  →  commit recorded (snapshot of layout at save time)
                         │
                         ▼
History panel  →  timeline of all commits (newest = HEAD)
                         │
           ┌─────────────┴──────────────┐
           │                            │
     👁 Preview                   ✕ Delete commit
     (opens /preview/<id>)         (history only)
           │
           ▼
  Read-only render of historical layout
  (live data, historical widget positions)
           │
           ▼
     Restore button
     → POST /api/history/<id>/restore
     → Updates DB layout
     → Redirects to /configure to review before going live
```

**Key principle:** A commit preview never changes the live dashboard. Restore updates the database, but you are taken to `/configure` to review and manually confirm before the dashboard becomes active.

---

## Getting Started

### Prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | 3.10+ | `python --version` |
| MySQL | 8.0+ | `mysql --version` |
| pip | latest | `pip --version` |

### Installation

**1. Clone the repository**

```bash
git clone https://github.com/Arulraj25/customizable-dashboard.git
cd customizable-dashboard
```

**2. Set up the database**

```bash
mysql -u root -p < database/schema.sql
```

This creates `dashforge_db`, all three tables, and seeds 12 sample customer orders.

**3. Configure environment**

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password_here
MYSQL_DB=dashforge_db
SECRET_KEY=change-me-in-production
FLASK_DEBUG=true
```

**4. Set up Python environment**

```bash
python3 -m venv venv
source venv/bin/activate        # macOS / Linux
venv\Scripts\activate           # Windows

pip install -r requirements.txt
```

> **macOS note:** If `mysqlclient` fails to build:
> ```bash
> brew install mysql-client pkg-config
> pip install -r requirements.txt
> ```
>
> **Ubuntu / Debian note:**
> ```bash
> sudo apt-get install libmysqlclient-dev python3-dev
> pip install -r requirements.txt
> ```

**5. Run the application**

```bash
python app.py
```

Open **http://localhost:5000**

### Running Again (after first setup)

```bash
source venv/bin/activate        # Windows: venv\Scripts\activate
python app.py
```

---

## Deployment (Docker + Jenkins + AWS EC2)

### Architecture

```
Developer pushes code to GitHub
         │
         ▼
Jenkins CI/CD pipeline triggers
         │
         ▼
Code pulled to AWS EC2 instance
         │
         ▼
Docker image built (Flask + dependencies)
         │
         ▼
Containers started:
  ├── MySQL container
  ├── Flask application container
  └── Nginx reverse proxy container
         │
         ▼
Application served at http://32.192.50.89:8000
```

### Docker Containers

| Container | Purpose |
|---|---|
| `dashforge-mysql` | MySQL 8.0 database |
| `dashforge-flask` | Flask application (Gunicorn) |
| `dashforge-nginx` | Reverse proxy, serves on port 8000 |

### Useful Docker Commands

```bash
# Check running containers
docker ps

# View Flask application logs
docker logs dashforge-flask

# Pull the latest image
docker pull arulraj25/dashforge:latest

# Restart application
docker restart dashforge-flask
```

### Security

| Measure | Detail |
|---|---|
| SSH access | Key-based login only — password auth disabled |
| Open ports | 22 (SSH), 8000 (App) |
| Docker credentials | Managed via access tokens — no plaintext passwords |
| Secret key | Set via environment variable — never committed to git |

---

## Pages

| URL | Description |
|---|---|
| `/` | Live dashboard view with date filter, advanced filters, real-time refresh |
| `/orders` | Customer order management — create, edit, delete, search |
| `/configure` | Drag-and-drop dashboard builder with tab-based multi-dashboard support |
| `/preview/<id>` | Read-only snapshot of any historical commit |

---

## Widget Configuration Reference

### KPI Widget
- **Metric:** Total Amount · Quantity · Unit Price · Customer ID · Status · Product · Created By
- **Aggregation:** Sum · Average · Count
- **Format:** Number · Currency (with decimal precision)
- **Trend:** Auto-calculates % change vs prior 7-day window
- **Auto-refresh:** Off · 10s · 30s · 1 min

### Chart Widgets (Bar, Line, Area, Scatter)
- **X Axis / Y Axis:** Product · Quantity · Unit Price · Total Amount · Status · Created By
- **Color:** Hex color picker
- **Auto-refresh:** Off · 10s · 30s · 1 min

### Pie Chart
- **Field:** Status · Product · Created By · Quantity · Total Amount
- **Show Legend:** Toggle

### Table Widget
- **Columns:** Any combination of all 17 available fields
- **Sort:** Any column, ascending or descending
- **Pagination:** 5–50 rows per page
- **Styling:** Font size (12–18px), header background color

---

## Advanced Filters

A global filter bar appears on the dashboard and preview pages:

| Filter | Options |
|---|---|
| Product | Fiber Internet 300 Mbps · 5G Unlimited Mobile Plan · Fiber Internet 1 Gbps · Business Internet 500 Mbps · VoIP Corporate Package |
| Status | Pending · In progress · Completed |
| Created By | Mr. Michael Harris · Mr. Ryan Cooper · Ms. Olivia Carter · Mr. Lucas Martin |
| Country | United States · Canada · Australia · Singapore · Hong Kong |

Changing any filter instantly re-fetches data for all widgets on the page.

---

## Sample Seed Data

12 customer orders are pre-loaded by `schema.sql` spanning all 5 products, all 3 statuses, all 4 agents, and all 5 countries — providing meaningful data for every chart type out of the box.

| Product | Orders |
|---|---|
| Fiber Internet 1 Gbps | Alice, Frank, Karen |
| 5G Unlimited Mobile Plan | Bob, Grace, Liam |
| Fiber Internet 300 Mbps | Carol, Jack |
| Business Internet 500 Mbps | David, Henry |
| VoIP Corporate Package | Eva, Iris |

---

## Migrations (Existing Installations)

If you are upgrading from an earlier version of DashForge:

```bash
# v2 → v3: adds name column to dashboard_layout
mysql -u root -p dashforge_db < database/migration_001_named_dashboards.sql

# v3 → v4: adds dashboard_history table
mysql -u root -p dashforge_db < database/migration_002_commit_history.sql

# v4 → v5: ensures all columns exist, safe to run on any version
mysql -u root -p dashforge_db < database/migration_003_v4_features.sql
```

New installations should run `schema.sql` only — no migrations needed.

---

## Author

**Arulraj**
GitHub: [github.com/Arulraj25/customizable-dashboard](https://github.com/Arulraj25/customizable-dashboard)

---

*DashForge v5.0 · Flask · MySQL · Chart.js · Gridstack.js · Docker · Jenkins · AWS EC2*
  Charts and UI: Chart.js, Gridstack.js
  
  Containerization: Docker
  
  CI/CD: Jenkins
  
  Cloud: AWS EC2
  
  Proxy: Nginx
  
  Architecture (Simple Flow)
  
  GitHub → Jenkins → Docker → AWS EC2
  
  Code is pushed to GitHub
  
  Jenkins builds and deploys
  
  Docker containers run on EC2
  
  Application is served using Nginx
  
  Containers
  
  MySQL for database
  
  Flask application for backend
  
  Nginx for reverse proxy
  
  Access
  
  Application: http://32.192.50.89:8000
  
  Youtube Video Link
  
  https://www.youtube.com/watch?v=AX4GiqDjdZA
  
  Key Features
  
  Custom dashboard builder with drag-and-drop
  
  Multiple chart types (Bar, Line, Pie, KPI, etc.)
  
  Customer order management (CRUD)
  
  Filters for date range and data
  
  Save dashboard layouts
  
  Deployment Flow
  
  Push code to GitHub
  
  Jenkins pipeline runs
  
  Code is sent to EC2
  
  Docker image is built
  
  Containers are started
  
  Application goes live
  
  Run Locally
  git clone https://github.com/Arulraj25/customizable-dashboard.git
  cd customizable-dashboard
  
  # Create environment file
  cp .env.example .env
  
  Edit the .env file and update values:
  
  MYSQL_HOST=localhost
  MYSQL_USER=root
  MYSQL_PASSWORD=your_password_here  # your database password
  MYSQL_DB=dashforge_db
  SECRET_KEY=change-me-in-production
  FLASK_DEBUG=true
  # Create virtual environment
  python3 -m venv venv
  
  # Activate virtual environment
  source venv/bin/activate
  
  # Install dependencies
  pip install -r requirements.txt
  
  # Setup MySQL
  mysql -u root -p < database/schema.sql
  
  # Run application
  python app.py
  
  Open in browser: http://localhost:5000
  
  Docker (EC2)
  docker ps
  docker logs dashforge-flask
  docker pull arulraj25/dashforge:latest
  Basic Security
  
  SSH key-based login
  
  Limited open ports (22, 8000, 8080)
  
  Docker credentials managed using tokens
  
  Author
  
  Arulraj
  
  GitHub: https://github.com/Arulraj25/customizable-dashboard.git
