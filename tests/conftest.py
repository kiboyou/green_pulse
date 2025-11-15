import sys
from pathlib import Path

# Ensure 'src' is importable as top-level package for tests
ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'src'
if str(SRC) not in sys.path:
    sys.path.insert(0, str(SRC))
