import logging
import sys
from pathlib import Path
from ..config import DATA_DIR

LOG_FILE = DATA_DIR / "app.log"

# Setup configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_FILE, encoding="utf-8")
    ]
)

def get_logger(name: str):
    return logging.getLogger(name)

def get_recent_logs(limit: int = 50):
    """Utility to return latest lines from the app.log file."""
    if not LOG_FILE.exists():
        return []
    try:
        with open(LOG_FILE, "r", encoding="utf-8") as f:
            lines = f.readlines()
            return [line.strip() for line in lines[-limit:]]
    except Exception:
        return []
