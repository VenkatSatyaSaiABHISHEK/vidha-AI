import os
import psutil
from pathlib import Path
from typing import Dict, Any, List
from ..config import DATA_DIR
from ..utils.logger import get_recent_logs

class SystemService:
    @staticmethod
    def get_directory_size(path: Path) -> float:
        """Computes directory size in Gigabytes (GB)."""
        if not path.exists():
            return 0.0
        total_size = 0
        for dirpath, _, filenames in os.walk(path):
            for f in filenames:
                fp = os.path.join(dirpath, f)
                # skip if symbolic link
                if not os.path.islink(fp):
                    try:
                        total_size += os.path.getsize(fp)
                    except OSError:
                        pass
        return total_size / (1024 * 1024 * 1024)

    @classmethod
    def get_telemetry_metrics(cls) -> Dict[str, Any]:
        """Gathers machine hardware stats for the dashboard charts."""
        cpu_usage = psutil.cpu_percent(interval=None)
        ram = psutil.virtual_memory()
        
        # Calculate local database folder allocation
        local_db_size = cls.get_directory_size(DATA_DIR)
        
        return {
            "cpu_percent": cpu_usage,
            "ram_used_gb": round(ram.used / (1024 * 1024 * 1024), 2),
            "ram_total_gb": round(ram.total / (1024 * 1024 * 1024), 2),
            "ram_percent": ram.percent,
            "storage_used_gb": round(local_db_size, 3),
            "storage_limit_gb": 10.0  # Simulating a local limit parameter
        }

    @staticmethod
    def get_console_logs() -> List[str]:
        """Pipes latest lines from the app.log file to populate the terminal emulator."""
        return get_recent_logs(30)
