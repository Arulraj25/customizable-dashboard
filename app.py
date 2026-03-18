"""
app.py – DashForge Flask backend
Complete implementation with light theme only
"""

import json
import decimal
from datetime import datetime, date, timedelta, timezone
from flask import Flask, render_template, request, jsonify
from flask_mysqldb import MySQL
from config import Config
import MySQLdb

app = Flask(__name__)
app.config.from_object(Config)
mysql = MySQL(app)


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def _serial(obj):
    """JSON-serialise types that the default encoder cannot handle."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, decimal.Decimal):
        return float(obj)
    raise TypeError(f"Not serialisable: {type(obj)}")


def _json_resp(data, status=200):
    return app.response_class(
        json.dumps(data, default=_serial),
        status=status,
        mimetype="application/json",
    )


def _date_where(date_range: str) -> str:
    """Return a SQL WHERE clause fragment for the requested date range."""
    today = datetime.now(timezone.utc).date()
    if date_range == "today":
        return f"DATE(created_at) = '{today}'"
    if date_range == "last7":
        return f"created_at >= '{today - timedelta(days=7)}'"
    if date_range == "last30":
        return f"created_at >= '{today - timedelta(days=30)}'"
    if date_range == "last90":
        return f"created_at >= '{today - timedelta(days=90)}'"
    return "1=1"   # all time


def is_duplicate_error(e):
    """Check if error is a duplicate entry error"""
    return hasattr(e, 'args') and len(e.args) >= 2 and e.args[0] == 1062


# ─────────────────────────────────────────────────────────────
# Column / field maps
# ─────────────────────────────────────────────────────────────

FIELD_EXPR = {
    "customer_id":   "id",
    "customer_name": "CONCAT(first_name, ' ', last_name)",
    "email":         "email",
    "phone":         "phone",
    "address":       "CONCAT(street, ', ', city)",
    "order_date":    "DATE(created_at)",
    "product":       "product",
    "created_by":    "created_by",
    "status":        "status",
    "total_amount":  "total_amount",
    "unit_price":    "unit_price",
    "quantity":      "quantity",
}

NUMERIC_FIELDS = {"total_amount", "unit_price", "quantity", "customer_id"}

CHART_FIELD_EXPR = {
    "product":      "product",
    "quantity":     "quantity",
    "unit_price":   "unit_price",
    "total_amount": "total_amount",
    "status":       "status",
    "created_by":   "created_by",
}


# ─────────────────────────────────────────────────────────────
# Page routes
# ─────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("dashboard.html")


@app.route("/orders")
def orders():
    return render_template("orders.html")


@app.route("/configure")
def configure():
    return render_template("configure_dashboard.html")


@app.route("/preview/<int:hid>")
def preview_page(hid):
    """Read-only preview of a historical commit."""
    return render_template("preview_commit.html", hid=hid)


# ─────────────────────────────────────────────────────────────
# Orders CRUD API
# ─────────────────────────────────────────────────────────────

@app.route("/api/orders", methods=["GET"])
def get_orders():
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT id, first_name, last_name, email, phone,
               street, city, state, postal_code, country,
               product, quantity, unit_price, total_amount,
               status, created_by, created_at
        FROM customer_orders
        ORDER BY created_at DESC
    """)
    rows = cur.fetchall()
    cur.close()
    return _json_resp(rows)


@app.route("/api/orders/<int:oid>", methods=["GET"])
def get_order(oid):
    cur = mysql.connection.cursor()
    cur.execute("SELECT * FROM customer_orders WHERE id = %s", (oid,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return jsonify({"error": "Not found"}), 404
    return _json_resp(row)


@app.route("/api/orders", methods=["POST"])
def create_order():
    d = request.get_json(force=True)
    cur = mysql.connection.cursor()
    cur.execute("""
        INSERT INTO customer_orders
          (first_name, last_name, email, phone,
           street, city, state, postal_code, country,
           product, quantity, unit_price, status, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        d["first_name"], d["last_name"], d["email"], d["phone"],
        d.get("street",""), d.get("city",""), d.get("state",""),
        d.get("postal_code",""), d.get("country",""),
        d["product"], d["quantity"], d["unit_price"],
        d["status"], d["created_by"],
    ))
    mysql.connection.commit()
    new_id = cur.lastrowid
    cur.close()
    return _json_resp({"success": True, "id": new_id}, 201)


@app.route("/api/orders/<int:oid>", methods=["PUT"])
def update_order(oid):
    d = request.get_json(force=True)
    cur = mysql.connection.cursor()
    cur.execute("""
        UPDATE customer_orders SET
          first_name=%s, last_name=%s, email=%s, phone=%s,
          street=%s, city=%s, state=%s, postal_code=%s, country=%s,
          product=%s, quantity=%s, unit_price=%s,
          status=%s, created_by=%s
        WHERE id=%s
    """, (
        d["first_name"], d["last_name"], d["email"], d["phone"],
        d.get("street",""), d.get("city",""), d.get("state",""),
        d.get("postal_code",""), d.get("country",""),
        d["product"], d["quantity"], d["unit_price"],
        d["status"], d["created_by"], oid,
    ))
    mysql.connection.commit()
    cur.close()
    return _json_resp({"success": True})


@app.route("/api/orders/<int:oid>", methods=["DELETE"])
def delete_order(oid):
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM customer_orders WHERE id = %s", (oid,))
    mysql.connection.commit()
    cur.close()
    return _json_resp({"success": True})


# ─────────────────────────────────────────────────────────────
# Dashboard layout API  (named dashboards)
# ─────────────────────────────────────────────────────────────

@app.route("/api/dashboards", methods=["GET"])
def list_dashboards():
    """Return all saved dashboards (id, name, updated_at)."""
    cur = mysql.connection.cursor()
    cur.execute("SELECT id, name, updated_at FROM dashboard_layout ORDER BY updated_at DESC")
    rows = cur.fetchall()
    cur.close()
    return _json_resp(rows)


@app.route("/api/dashboards/<int:did>", methods=["GET"])
def load_dashboard(did):
    cur = mysql.connection.cursor()
    cur.execute("SELECT id, name, layout FROM dashboard_layout WHERE id=%s", (did,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return _json_resp({"error": "Not found"}, 404)
    layout = row["layout"]
    if isinstance(layout, str):
        layout = json.loads(layout)
    return _json_resp({"id": row["id"], "name": row["name"], "layout": layout})


@app.route("/api/dashboards", methods=["POST"])
def save_dashboard():
    data       = request.get_json(force=True)
    name       = (data.get("name") or "Untitled Dashboard").strip()[:120]
    layout_raw = data.get("layout", [])
    layout     = json.dumps(layout_raw)
    commit_msg = (data.get("commit_msg") or "").strip()[:255]
    did        = data.get("id")          # present when overwriting existing
    cur        = mysql.connection.cursor()

    try:
        if did:
            # Check if updating to a name that already exists (excluding current dashboard)
            cur.execute("SELECT id FROM dashboard_layout WHERE name = %s AND id != %s", (name, did))
            existing = cur.fetchone()
            if existing:
                cur.close()
                return _json_resp({"success": False, "error": "duplicate_name", "message": "A dashboard with this name already exists"}, 400)

            # Snapshot the CURRENT layout before overwriting
            cur.execute("SELECT layout FROM dashboard_layout WHERE id=%s", (did,))
            existing = cur.fetchone()
            if existing and commit_msg:
                # Check for duplicate commit message for this dashboard
                cur.execute("SELECT id FROM dashboard_history WHERE dashboard_id = %s AND commit_msg = %s", (did, commit_msg))
                duplicate_commit = cur.fetchone()
                if duplicate_commit:
                    cur.close()
                    return _json_resp({"success": False, "error": "duplicate_commit", "message": "A commit with this message already exists"}, 400)
                
                cur.execute("""
                    INSERT INTO dashboard_history (dashboard_id, commit_msg, layout)
                    VALUES (%s, %s, %s)
                """, (did, commit_msg, existing["layout"]))

            cur.execute("UPDATE dashboard_layout SET name=%s, layout=%s WHERE id=%s",
                        (name, layout, did))
            if cur.rowcount == 0:
                did = None   # row gone – fall through to insert

        if not did:
            # Check for duplicate dashboard name
            cur.execute("SELECT id FROM dashboard_layout WHERE name = %s", (name,))
            existing = cur.fetchone()
            if existing:
                cur.close()
                return _json_resp({"success": False, "error": "duplicate_name", "message": "A dashboard with this name already exists"}, 400)

            cur.execute("INSERT INTO dashboard_layout (name, layout) VALUES (%s, %s)",
                        (name, layout))
            did = cur.lastrowid
            # First commit
            if commit_msg:
                # Check for duplicate commit message for this new dashboard
                cur.execute("SELECT id FROM dashboard_history WHERE dashboard_id = %s AND commit_msg = %s", (did, commit_msg))
                duplicate_commit = cur.fetchone()
                if duplicate_commit:
                    cur.close()
                    return _json_resp({"success": False, "error": "duplicate_commit", "message": "A commit with this message already exists"}, 400)
                    
                cur.execute("""
                    INSERT INTO dashboard_history (dashboard_id, commit_msg, layout)
                    VALUES (%s, %s, %s)
                """, (did, commit_msg, layout))

        mysql.connection.commit()
        cur.close()
        return _json_resp({"success": True, "id": did, "name": name})
        
    except Exception as e:
        mysql.connection.rollback()
        cur.close()
        if is_duplicate_error(e):
            return _json_resp({"success": False, "error": "duplicate_entry", "message": "Duplicate entry found"}, 400)
        return _json_resp({"success": False, "error": str(e)}, 500)


@app.route("/api/dashboards/<int:did>", methods=["DELETE"])
def delete_dashboard(did):
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM dashboard_history WHERE dashboard_id=%s", (did,))
    cur.execute("DELETE FROM dashboard_layout WHERE id=%s", (did,))
    mysql.connection.commit()
    cur.close()
    return _json_resp({"success": True})


# ─────────────────────────────────────────────────────────────
# Dashboard History (commit log) API
# ─────────────────────────────────────────────────────────────

@app.route("/api/dashboards/<int:did>/history", methods=["GET"])
def get_history(did):
    """Return all commits for a dashboard, newest first."""
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT id, dashboard_id, commit_msg, layout, committed_at
        FROM dashboard_history
        WHERE dashboard_id = %s
        ORDER BY committed_at DESC
    """, (did,))
    rows = cur.fetchall()
    cur.close()
    for r in rows:
        if isinstance(r["layout"], str):
            r["layout"] = json.loads(r["layout"])
    return _json_resp(rows)


@app.route("/api/dashboards/<int:did>/history", methods=["POST"])
def create_commit(did):
    """Snapshot current layout as a named commit."""
    data       = request.get_json(force=True)
    commit_msg = (data.get("commit_msg") or "Update").strip()[:255]
    layout     = json.dumps(data.get("layout", []))

    cur = mysql.connection.cursor()
    try:
        cur.execute("SELECT id FROM dashboard_layout WHERE id=%s", (did,))
        if not cur.fetchone():
            cur.close()
            return _json_resp({"error": "Dashboard not found"}, 404)

        cur.execute("SELECT id FROM dashboard_history WHERE dashboard_id = %s AND commit_msg = %s", (did, commit_msg))
        duplicate_commit = cur.fetchone()
        if duplicate_commit:
            cur.close()
            return _json_resp({"success": False, "error": "duplicate_commit", "message": "A commit with this message already exists"}, 400)

        cur.execute("""
            INSERT INTO dashboard_history (dashboard_id, commit_msg, layout)
            VALUES (%s, %s, %s)
        """, (did, commit_msg, layout))
        mysql.connection.commit()
        commit_id = cur.lastrowid
        cur.close()
        return _json_resp({"success": True, "id": commit_id, "commit_msg": commit_msg})
        
    except Exception as e:
        mysql.connection.rollback()
        cur.close()
        if is_duplicate_error(e):
            return _json_resp({"success": False, "error": "duplicate_commit", "message": "A commit with this message already exists"}, 400)
        return _json_resp({"success": False, "error": str(e)}, 500)


@app.route("/api/history/<int:hid>/restore", methods=["POST"])
def restore_commit(hid):
    """Restore a dashboard to a historical commit's layout."""
    cur = mysql.connection.cursor()
    cur.execute("SELECT dashboard_id, layout FROM dashboard_history WHERE id=%s", (hid,))
    row = cur.fetchone()
    if not row:
        cur.close()
        return _json_resp({"error": "Commit not found"}, 404)

    cur.execute("UPDATE dashboard_layout SET layout=%s WHERE id=%s",
                (row["layout"], row["dashboard_id"]))
    mysql.connection.commit()
    layout = row["layout"]
    if isinstance(layout, str):
        layout = json.loads(layout)
    cur.close()
    return _json_resp({"success": True, "dashboard_id": row["dashboard_id"], "layout": layout})


@app.route("/api/history/<int:hid>", methods=["DELETE"])
def delete_commit(hid):
    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM dashboard_history WHERE id=%s", (hid,))
    mysql.connection.commit()
    cur.close()
    return _json_resp({"success": True})


@app.route("/api/layout", methods=["GET"])
def get_layout():
    cur = mysql.connection.cursor()
    cur.execute("SELECT id, name, layout FROM dashboard_layout ORDER BY updated_at DESC LIMIT 1")
    row = cur.fetchone()
    cur.close()
    if not row:
        return _json_resp({"layout": [], "id": None, "name": ""})
    layout = row["layout"]
    if isinstance(layout, str):
        layout = json.loads(layout)
    return _json_resp({"layout": layout, "id": row["id"], "name": row["name"]})


# ─────────────────────────────────────────────────────────────
# Dashboard rename API (with duplicate check)
# ─────────────────────────────────────────────────────────────

@app.route("/api/dashboards/<int:did>/rename", methods=["PATCH"])
def rename_dashboard(did):
    data = request.get_json(force=True)
    name = (data.get("name") or "Untitled").strip()[:120]
    cur  = mysql.connection.cursor()
    
    cur.execute("SELECT id FROM dashboard_layout WHERE name = %s AND id != %s", (name, did))
    existing = cur.fetchone()
    if existing:
        cur.close()
        return _json_resp({"success": False, "error": "duplicate_name", "message": "A dashboard with this name already exists"}, 400)
    
    cur.execute("UPDATE dashboard_layout SET name=%s WHERE id=%s", (name, did))
    mysql.connection.commit()
    cur.close()
    return _json_resp({"success": True, "name": name})


# ─────────────────────────────────────────────────────────────
# Filter helpers
# ─────────────────────────────────────────────────────────────

def _filter_clauses(cfg: dict) -> str:
    """Build extra WHERE clauses from advanced filter payload."""
    clauses = []
    SAFE_VALS = {
        "product":    ["Fiber Internet 300 Mbps","5G Unlimited Mobile Plan",
                       "Fiber Internet 1 Gbps","Business Internet 500 Mbps",
                       "VoIP Corporate Package"],
        "status":     ["Pending","In progress","Completed"],
        "created_by": ["Mr. Michael Harris","Mr. Ryan Cooper",
                       "Ms. Olivia Carter","Mr. Lucas Martin"],
        "country":    ["United States","Canada","Australia","Singapore","Hong Kong"],
    }
    for field, allowed in SAFE_VALS.items():
        val = cfg.get(f"filter_{field}", "")
        if val and val in allowed:
            clauses.append(f"{field} = '{val}'")
    return (" AND " + " AND ".join(clauses)) if clauses else ""


@app.route("/api/filter-options", methods=["GET"])
def filter_options():
    """Return distinct values for all filter dropdowns."""
    cur = mysql.connection.cursor()
    result = {}
    for field in ("product", "status", "created_by", "country"):
        cur.execute(f"SELECT DISTINCT {field} AS v FROM customer_orders ORDER BY {field}")
        rows = cur.fetchall()
        result[field] = [r["v"] for r in rows if r["v"]]
    cur.close()
    return _json_resp(result)


# ─────────────────────────────────────────────────────────────
# Widget data APIs with cross-filtering support
# ─────────────────────────────────────────────────────────────

@app.route("/api/widget/kpi", methods=["POST"])
def widget_kpi():
    cfg        = request.get_json(force=True)
    metric     = cfg.get("metric",      "total_amount")
    agg        = cfg.get("aggregation", "sum").upper()
    date_range = cfg.get("dateRange",   "all")
    
    # Handle cross-filtering
    filter_field = cfg.get("filter_field")
    filter_value = cfg.get("filter_value")
    
    where = _date_where(date_range)
    
    if filter_field and filter_value:
        where += f" AND {filter_field} = '{filter_value}'"
    
    where += _filter_clauses(cfg)

    if metric not in NUMERIC_FIELDS and agg in ("SUM", "AVG"):
        agg = "COUNT"

    expr = FIELD_EXPR.get(metric, "total_amount")

    # Trend calculation
    trend_pct  = None
    trend_dir  = None
    if metric in NUMERIC_FIELDS and agg in ("SUM", "AVG", "COUNT"):
        today   = datetime.now(timezone.utc).date()
        w7      = f"created_at >= '{today - timedelta(days=7)}'"
        w14     = f"created_at >= '{today - timedelta(days=14)}' AND created_at < '{today - timedelta(days=7)}'"
        extra   = _filter_clauses(cfg)
        
        if filter_field and filter_value:
            w7 += f" AND {filter_field} = '{filter_value}'"
            w14 += f" AND {filter_field} = '{filter_value}'"
        
        cur     = mysql.connection.cursor()
        cur.execute(f"SELECT {agg}({expr}) AS v FROM customer_orders WHERE {w7}{extra}")
        row = cur.fetchone()
        now_val = row["v"] if row and row["v"] is not None else 0
        cur.execute(f"SELECT {agg}({expr}) AS v FROM customer_orders WHERE {w14}{extra}")
        row = cur.fetchone()
        prev_val = row["v"] if row and row["v"] is not None else 0
        cur.close()
        if prev_val and prev_val != 0:
            trend_pct = round(((float(now_val) - float(prev_val)) / float(prev_val)) * 100, 1)
            trend_dir = "up" if trend_pct >= 0 else "down"

    cur = mysql.connection.cursor()
    cur.execute(f"SELECT {agg}({expr}) AS val FROM customer_orders WHERE {where}")
    row = cur.fetchone()
    cur.close()
    val = row["val"] if row and row["val"] is not None else 0
    return _json_resp({"value": val, "trend_pct": trend_pct, "trend_dir": trend_dir})


@app.route("/api/widget/chart", methods=["POST"])
def widget_chart():
    cfg        = request.get_json(force=True)
    x_field    = cfg.get("xAxis",      "product")
    y_field    = cfg.get("yAxis",      "total_amount")
    date_range = cfg.get("dateRange",  "all")
    
    # Handle cross-filtering
    filter_field = cfg.get("filter_field")
    filter_value = cfg.get("filter_value")
    
    where = _date_where(date_range)
    
    if filter_field and filter_value:
        where += f" AND {filter_field} = '{filter_value}'"
    
    where += _filter_clauses(cfg)

    x_expr = CHART_FIELD_EXPR.get(x_field, "product")
    y_expr = CHART_FIELD_EXPR.get(y_field, "total_amount")

    if y_field in NUMERIC_FIELDS:
        sql = f"""
            SELECT {x_expr} AS label, SUM({y_expr}) AS value
            FROM customer_orders WHERE {where}
            GROUP BY {x_expr}
            ORDER BY value DESC LIMIT 20
        """
    else:
        sql = f"""
            SELECT {x_expr} AS label, COUNT(*) AS value
            FROM customer_orders WHERE {where}
            GROUP BY {x_expr}
            ORDER BY value DESC LIMIT 20
        """

    cur = mysql.connection.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    cur.close()

    labels = [r["label"] for r in rows]
    values = [float(r["value"]) if r["value"] is not None else 0 for r in rows]
    return _json_resp({"labels": labels, "values": values})


@app.route("/api/widget/pie", methods=["POST"])
def widget_pie():
    cfg        = request.get_json(force=True)
    field      = cfg.get("field",      "status")
    date_range = cfg.get("dateRange",  "all")
    
    # Handle cross-filtering
    filter_field = cfg.get("filter_field")
    filter_value = cfg.get("filter_value")
    
    where = _date_where(date_range)
    
    if filter_field and filter_value:
        where += f" AND {filter_field} = '{filter_value}'"
    
    where += _filter_clauses(cfg)

    expr = CHART_FIELD_EXPR.get(field, "status")

    if field in NUMERIC_FIELDS:
        sql = f"""
            SELECT {expr} AS label, SUM({expr}) AS value
            FROM customer_orders WHERE {where}
            GROUP BY {expr}
        """
    else:
        sql = f"""
            SELECT {expr} AS label, COUNT(*) AS value
            FROM customer_orders WHERE {where}
            GROUP BY {expr}
        """

    cur = mysql.connection.cursor()
    cur.execute(sql)
    rows = cur.fetchall()
    cur.close()

    labels = [str(r["label"]) for r in rows]
    values = [float(r["value"]) if r["value"] is not None else 0 for r in rows]
    return _json_resp({"labels": labels, "values": values})


@app.route("/api/widget/table", methods=["POST"])
def widget_table():
    cfg        = request.get_json(force=True)
    date_range = cfg.get("dateRange", "all")
    sort_col   = cfg.get("sortCol",   "created_at")
    sort_dir   = "ASC" if cfg.get("sortDir","desc").lower() == "asc" else "DESC"
    page       = max(1, int(cfg.get("page",    1)))
    per_page   = max(1, int(cfg.get("perPage", 10)))
    offset     = (page - 1) * per_page
    
    # Handle cross-filtering
    filter_field = cfg.get("filter_field")
    filter_value = cfg.get("filter_value")
    
    where = _date_where(date_range)
    
    if filter_field and filter_value:
        where += f" AND {filter_field} = '{filter_value}'"
    
    where += _filter_clauses(cfg)

    SAFE = {
        "id","first_name","last_name","email","phone",
        "street","city","state","postal_code","country",
        "product","quantity","unit_price","total_amount",
        "status","created_by","created_at",
    }
    columns  = [c for c in cfg.get("columns", []) if c in SAFE]
    if not columns:
        columns = ["id","first_name","last_name","product","total_amount","status"]
    if sort_col not in SAFE:
        sort_col = "created_at"

    col_sql = ", ".join(columns)
    cur = mysql.connection.cursor()
    cur.execute(f"SELECT COUNT(*) AS cnt FROM customer_orders WHERE {where}")
    row = cur.fetchone()
    total = row["cnt"] if row else 0

    cur.execute(f"""
        SELECT {col_sql}
        FROM customer_orders
        WHERE {where}
        ORDER BY {sort_col} {sort_dir}
        LIMIT %s OFFSET %s
    """, (per_page, offset))
    rows = cur.fetchall()
    cur.close()

    return _json_resp({
        "rows": rows, "total": total,
        "page": page, "perPage": per_page,
    })


# ─────────────────────────────────────────────────────────────
# Commit preview
# ─────────────────────────────────────────────────────────────

@app.route("/api/history/<int:hid>/preview", methods=["GET"])
def preview_commit(hid):
    """Return the layout stored in a commit for read-only preview."""
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT h.id, h.commit_msg, h.committed_at, h.layout, h.dashboard_id,
               d.name AS dashboard_name
        FROM dashboard_history h
        JOIN dashboard_layout d ON d.id = h.dashboard_id
        WHERE h.id = %s
    """, (hid,))
    row = cur.fetchone()
    cur.close()
    if not row:
        return _json_resp({"error": "Not found"}, 404)
    layout = row["layout"]
    if isinstance(layout, str):
        layout = json.loads(layout)
    return _json_resp({
        "id": row["id"],
        "commit_msg": row["commit_msg"],
        "committed_at": row["committed_at"],
        "dashboard_id": row["dashboard_id"],
        "dashboard_name": row["dashboard_name"],
        "layout": layout,
    })


if __name__ == "__main__":
    app.run(debug=Config.DEBUG, port=5000)