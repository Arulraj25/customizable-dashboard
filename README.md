# DashForge
### Custom Dashboard Builder with Customer Order Management

A full-stack web application built with **Flask · MySQL · Vanilla JS · Chart.js · Gridstack.js**

---

## Tech Stack

| Layer       | Technology              |
|-------------|-------------------------|
| Backend     | Python 3.10+ / Flask    |
| Database    | MySQL 8.0+              |
| Charts      | Chart.js 4              |
| Grid / DnD  | Gridstack.js 10         |
| Frontend    | HTML5 / CSS3 / Vanilla JS |
| Fonts       | Syne · Outfit (Google)  |

---

## Quick Setup

### 1 · Clone / extract the project

```bash
cd project/
```

### 2 · Set up MySQL

```bash
mysql -u root -p < database/schema.sql
```

This creates `dashforge_db`, both tables, and 12 sample orders.

### 3 · Create your `.env` file

```bash
cp .env.example .env
# Edit .env and fill in your MYSQL_PASSWORD
```

```env
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=your_password
MYSQL_DB=dashforge_db
SECRET_KEY=change-me
FLASK_DEBUG=true
```

### 4 · Install Python dependencies

```bash
pip install -r requirements.txt
```

**macOS note:** If `mysqlclient` fails:
```bash
brew install mysql-client pkg-config
pip install -r requirements.txt
```

**Ubuntu/Debian note:**
```bash
sudo apt-get install libmysqlclient-dev python3-dev
pip install -r requirements.txt
```

### 5 · Run

```bash
python app.py
```

Open **http://localhost:5000**

---

## Pages

| URL           | Description                           |
|---------------|---------------------------------------|
| `/`           | Live dashboard (read-only view)       |
| `/orders`     | Customer orders CRUD table            |
| `/configure`  | Drag-and-drop dashboard builder       |

---

## Features

### Orders (`/orders`)
- Create, edit, delete orders via a polished modal form
- Auto-calculated `total_amount = quantity × unit_price`
- Live search and status filter
- Required field validation with inline error messages

### Dashboard Builder (`/configure`)
- Drag widgets from the palette panel onto the canvas grid
- **Widget types:** Bar, Line, Pie, Area, Scatter · Table · KPI
- Per-widget settings panel with full configuration options
- Resize and reposition with Gridstack.js (12-col / 8-col / 4-col responsive)
- **Save Configuration** button persists layout + settings to MySQL

### Dashboard (`/`)
- Automatically loads your saved widget layout
- **Date filter:** All Time · Today · Last 7/30/90 Days
- All data is sourced live from `customer_orders`

---

## API Reference

| Method | Endpoint               | Purpose                   |
|--------|------------------------|---------------------------|
| GET    | `/api/orders`          | List all orders           |
| POST   | `/api/orders`          | Create order              |
| GET    | `/api/orders/<id>`     | Get single order          |
| PUT    | `/api/orders/<id>`     | Update order              |
| DELETE | `/api/orders/<id>`     | Delete order              |
| GET    | `/api/layout`          | Load dashboard layout     |
| POST   | `/api/layout`          | Save dashboard layout     |
| POST   | `/api/widget/kpi`      | KPI widget data           |
| POST   | `/api/widget/chart`    | Chart widget data         |
| POST   | `/api/widget/pie`      | Pie chart data            |
| POST   | `/api/widget/table`    | Paginated table data      |

---

## Project Structure

```
project/
├── app.py                        # Flask routes & API
├── config.py                     # Configuration from .env
├── requirements.txt
├── .env.example                  # Copy to .env and fill in
│
├── database/
│   └── schema.sql                # MySQL schema + seed data
│
├── templates/
│   ├── layout.html               # Base layout (sidebar navigation)
│   ├── dashboard.html            # Live dashboard view
│   ├── configure_dashboard.html  # Widget builder
│   └── orders.html               # Order management
│
└── static/
    ├── css/
    │   └── style.css             # Dark editorial theme
    └── js/
        ├── widgets.js            # Shared widget renderer
        ├── dashboard.js          # Dashboard view logic
        ├── configure.js          # Builder: drag-drop + settings
        └── orders.js             # Orders CRUD
```
