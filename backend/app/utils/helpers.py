import re
import os
from datetime import datetime

def clean_text(text: str) -> str:
    """Scrub raw text segments of duplicates, tabs, and layout spacing."""
    if not text:
        return ""
    # Replace multiple spaces/newlines
    text = re.sub(r'\s+', ' ', text)
    # Remove control characters
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\xff]', '', text)
    return text.strip()

def get_readable_size(size_in_bytes: int) -> str:
    """Convert bytes count to readable decimal values."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_in_bytes < 1024.0:
            return f"{size_in_bytes:.2f} {unit}"
        size_in_bytes /= 1024.0
    return f"{size_in_bytes:.2f} TB"

def get_current_timestamp() -> str:
    """Returns standard formatted datetime string."""
    return datetime.now().strftime("%Y-%m-%d %H:%M")
