"""config.py – Application configuration loaded from .env"""
import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # ── MySQL ─────────────────────────────────────────────────
    MYSQL_HOST      = os.getenv("MYSQL_HOST",     "localhost")
    MYSQL_USER      = os.getenv("MYSQL_USER",     "root")
    MYSQL_PASSWORD  = os.getenv("MYSQL_PASSWORD", "")
    MYSQL_DB        = os.getenv("MYSQL_DB",       "dashforge_db")
    MYSQL_CURSORCLASS = "DictCursor"

    # ── Flask ─────────────────────────────────────────────────
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
    DEBUG      = os.getenv("FLASK_DEBUG", "true").lower() == "true"