"""
sheets_sync.py  —  Live timetable from Google Sheets
-----------------------------------------------------
Sheet layout (one tab per weekday):
  Row 0  : day title  (merged, "MONDAY" …)
  Row 1  : slot numbers 1…9
  Row 2  : time ranges  "08:00-8:50", "08:55-9:45" …
  Row 3  : "CLASSROOMS" header — skip
  Row 4+ : venue in col-A; non-empty cell = occupied, empty = free

Lab spillover rule: a booked lab slot blocks that slot + next 2 cols.
"""

import io
import logging
import re
import threading
from datetime import datetime, time, timezone

import requests
import pandas as pd

log = logging.getLogger(__name__)

SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1sivXTIf9JvaqP2k6B7-468SyZXTcOAvKyyVW4HJRxeQ/export?format=xlsx"
)

_CACHE_TTL = 3600   # seconds; refresh sheet at most once per hour

LAB_ROOMS = {
    'LLC Academic Block I (R7) (50)',
    'C-20 Academic Block II (50)',
    'Eng Lang Room  Academic Block II (50)',
    'Academic Block I LAB-1 (49)',
    'Academic Block I CY LAB-2 (48)',
    'Academic Block I LAB-3 (47)',
    'Academic Block I LAB-4 (48)',
    'Academic Block III LAB-5 (52)',
    'Academic Block II DS LAB-6 (52)',
    'Academic Block II LAB-7 (49)',
    'Academic Block II CY LAB-8 (49)',
    'Academic Block II AI/ML LAB-9 (48)',
    'Academic Block II LAB-10 (48)',
    'Academic Block II LAB-11 (48)',
    'Academic Block II Lab-12 (48)',
    'Academic Block II Lab-13 (48)',
    'Academic Block II Microprocessor and Interfacing Lab',
    'Academic Block II Electronics Lab',
    'Academic Block II Engineering Workshop Lab',
    'Academic Block II Electromechanical Systems Lab',
    'Academic Block II Power Lab',
    'Academic Block II Physics Lab',
}

WEEKDAY_NAMES = {
    0: 'MONDAY', 1: 'TUESDAY', 2: 'WEDNESDAY',
    3: 'THURSDAY', 4: 'FRIDAY',
}

# ── Shared raw-bytes cache (one download = all tabs) ─────────────────────────
_raw_lock       = threading.Lock()
_raw_bytes: bytes | None   = None
_raw_fetched_at: datetime | None = None

# ── Per-day parsed cache ──────────────────────────────────────────────────────
# _day_cache[day_name] = {
#   'fetched_at': datetime,
#   'slot_times': [(slot_num, start_time, end_time), ...],
#   'rooms':      { room_name: set_of_occupied_slot_nums }
# }
_day_cache: dict = {}
_day_lock = threading.Lock()


# ── Low-level helpers ─────────────────────────────────────────────────────────

def _is_empty(val) -> bool:
    if val is None:
        return True
    if isinstance(val, float) and pd.isna(val):
        return True
    return str(val).strip() == ''


def _parse_slot_time(raw: str) -> tuple | None:
    """'08:00-8:50' → (time(8,0), time(8,50)) or None."""
    m = re.match(r'(\d{1,2}:\d{2})\s*[-\u2013]\s*(\d{1,2}:\d{2})', str(raw).strip())
    if not m:
        return None
    try:
        s = datetime.strptime(m.group(1), '%H:%M').time()
        e = datetime.strptime(m.group(2), '%H:%M').time()
        return s, e
    except ValueError:
        return None


def _fetch_raw() -> bytes | None:
    """Download the full xlsx (all tabs) with TTL cache."""
    global _raw_bytes, _raw_fetched_at
    now = datetime.now(timezone.utc)
    with _raw_lock:
        if _raw_bytes and _raw_fetched_at:
            if (now - _raw_fetched_at).total_seconds() < _CACHE_TTL:
                return _raw_bytes
        try:
            resp = requests.get(SHEET_URL, timeout=20)
            resp.raise_for_status()
            _raw_bytes      = resp.content
            _raw_fetched_at = now
            log.info("Google Sheet downloaded (%d bytes)", len(_raw_bytes))
            return _raw_bytes
        except Exception as exc:
            log.warning("Sheet download failed: %s — DB-only mode", exc)
            return _raw_bytes   # return stale if available


def _parse_day_df(df: pd.DataFrame) -> dict:
    """
    Parse one day's DataFrame into:
      {
        'slot_times': [(slot_num, start_time, end_time), ...],
        'rooms':      { room_name: set_of_occupied_slot_nums }
      }
    """
    time_row  = df.iloc[2]
    slot_cols = [c for c in df.columns[1:] if not _is_empty(time_row[c])]

    # Build ordered list of slot info
    slot_num_row = df.iloc[1]
    slot_times   = []   # (slot_num, start, end)
    col_to_slot  = {}   # col_index → slot_num
    for c in slot_cols:
        parsed = _parse_slot_time(time_row[c])
        if not parsed:
            continue
        try:
            snum = int(slot_num_row[c])
        except (ValueError, TypeError):
            snum = len(slot_times) + 1
        slot_times.append((snum, parsed[0], parsed[1]))
        col_to_slot[c] = snum

    valid_cols = [c for c in slot_cols if c in col_to_slot]

    rooms_dict = {}  # room_name → set of occupied slot_nums

    for _, row in df.iloc[4:].iterrows():
        venue = str(row.iloc[0]).strip()
        SKIP = {'nan', 'classrooms', 'engineering labs', 'computing labs', 'labs', 'venues', 'lab'}
        if _is_empty(venue) or venue.lower() in SKIP or 'engineering lab' in venue.lower() and len(venue) < 30:
            continue

        is_lab = venue in LAB_ROOMS
        occ    = set()   # occupied slot_nums

        # First pass: mark directly booked
        for c in valid_cols:
            if not _is_empty(row[c]):
                occ.add(col_to_slot[c])

        # Lab spillover: each booked slot → block self + next 2 cols
        if is_lab:
            extra = set()
            for i, c in enumerate(valid_cols):
                if not _is_empty(row[c]):
                    for j in range(i, min(i + 3, len(valid_cols))):
                        extra.add(col_to_slot[valid_cols[j]])
            occ |= extra

        rooms_dict[venue] = occ

    return {'slot_times': slot_times, 'rooms': rooms_dict}


def _get_day_data(day_name: str) -> dict | None:
    """Return cached (or freshly parsed) data for a weekday tab."""
    now = datetime.utcnow()
    with _day_lock:
        cached = _day_cache.get(day_name)
        if cached:
            if (now - cached['fetched_at']).total_seconds() < _CACHE_TTL:
                return cached
        # cache miss / stale
        raw = _fetch_raw()
        if raw is None:
            return None
        try:
            xls = pd.ExcelFile(io.BytesIO(raw), engine='openpyxl')
            tab = next((n for n in xls.sheet_names if n.strip().upper() == day_name), None)
            if tab is None:
                log.warning("Tab '%s' not found in sheet", day_name)
                return None
            df   = xls.parse(tab, header=None)
            data = _parse_day_df(df)
            data['fetched_at'] = now
            _day_cache[day_name] = data
            log.info("Parsed & cached %d rooms for %s", len(data['rooms']), day_name)
            return data
        except Exception as exc:
            log.error("Sheet parse error for %s: %s", day_name, exc)
            return None


# ── Public API ────────────────────────────────────────────────────────────────

def prefetch_all_days():
    """
    Pre-warm the cache for all 5 weekdays in background threads.
    Call once at app startup.
    """
    def _fetch(day):
        try:
            _get_day_data(day)
            log.info("Prefetched %s", day)
        except Exception as exc:
            log.warning("Prefetch failed for %s: %s", day, exc)

    for day in WEEKDAY_NAMES.values():
        t = threading.Thread(target=_fetch, args=(day,), daemon=True)
        t.start()


def get_sheet_blocked_rooms(query_date, query_start: time, query_end: time) -> set:
    """
    Set of venue names blocked during [query_start, query_end) on query_date.
    Falls back to empty set on any failure.
    """
    day_name = WEEKDAY_NAMES.get(query_date.weekday())
    if not day_name:
        return set()

    data = _get_day_data(day_name)
    if not data:
        return set()

    slot_times = data['slot_times']   # [(slot_num, start, end)]
    # Which slot_nums overlap the query window?
    overlapping_slots = {
        snum for snum, s, e in slot_times
        if s < query_end and e > query_start
    }
    if not overlapping_slots:
        return set()

    blocked = set()
    for venue, occ in data['rooms'].items():
        if occ & overlapping_slots:   # any overlap
            blocked.add(venue)

    log.debug("Sheet blocked for %s %s-%s: %d", query_date, query_start, query_end, len(blocked))
    return blocked


def get_room_free_windows(day_name: str, room_name: str) -> list:
    """
    Return list of free time windows for room_name on day_name.
    Each entry: { 'slot': int, 'start': 'HH:MM', 'end': 'HH:MM' }
    """
    data = _get_day_data(day_name)
    if not data:
        return []

    occ        = data['rooms'].get(room_name, set())
    slot_times = data['slot_times']

    return [
        {
            'slot':  snum,
            'start': s.strftime('%H:%M'),
            'end':   e.strftime('%H:%M'),
        }
        for snum, s, e in slot_times
        if snum not in occ
    ]


def is_room_free_for_window(day_name: str, room_name: str,
                             query_start: time, query_end: time) -> bool:
    """
    True only if room_name has ZERO occupied slots overlapping [query_start, query_end).
    """
    data = _get_day_data(day_name)
    if not data:
        return True   # can't tell → don't block

    occ        = data['rooms'].get(room_name, set())
    slot_times = data['slot_times']

    for snum, s, e in slot_times:
        if s < query_end and e > query_start:
            if snum in occ:
                return False
    return True


# ── Room catalogue (for DB seeding) ──────────────────────────────────────────

def _parse_capacity(venue: str) -> int | None:
    m = re.search(r'\((\d+)\)\s*$', venue.strip())
    return int(m.group(1)) if m else None


def _derive_location(venue: str) -> str:
    """
    Return a human-readable location string from the venue name.

    Buildings:
      Academic Block I  = CS Building
      Academic Block II = EE Building
      Academic Block III = Block III

    EE-building floors (letter prefix A-E):
      A = Ground Floor, B = 1st, C = 2nd, D = 3rd, E = 4th

    CS-building floors:
      LAB-1..4 = 1st Floor; LLC / R7 rooms = Ground Floor

    Other:
      LLC / Eng Lang = Ground Floor Lab
    """
    v = venue.strip()

    # Building
    if 'Academic Block II' in v:
        building = 'EE Building'
    elif 'Academic Block I' in v:
        building = 'CS Building'
    elif 'Academic Block III' in v:
        building = 'Block III'
    else:
        building = ''

    # Floor
    floor = ''
    # EE building (Academic Block II): letter prefix A–E indicates floor
    ee_letter = re.match(r'^([A-Ea-e])-?\d+\b', v)
    # CS building (Academic Block I): letter prefix E1–E6 → 1st floor, R/S → ground
    cs_e_match = re.match(r'^[Ee]-?\d+\b', v)

    if ee_letter and building == 'EE Building':
        floors = {'A': 'Ground Floor', 'B': '1st Floor', 'C': '2nd Floor',
                  'D': '3rd Floor', 'E': '4th Floor'}
        floor = floors.get(ee_letter.group(1).upper(), '')
    elif building == 'CS Building':
        lab_m = re.search(r'LAB-?(\d+)', v, re.IGNORECASE)
        if cs_e_match:
            floor = '1st Floor'                          # E1-E6: 1st floor CS
        elif lab_m:
            floor = '1st Floor' if int(lab_m.group(1)) <= 4 else ''
        elif re.match(r'^[RSrs]', v):
            floor = 'Ground Floor'                       # R/S rooms: ground
        else:
            floor = 'Ground Floor'
    elif 'LLC' in v or 'Eng Lang' in v:
        floor = 'Ground Floor'
    # S2 seminar hall
    elif re.match(r'^S2\b', v, re.IGNORECASE):
        floor = 'Ground Floor' 

    parts = [p for p in [building, floor] if p]
    return ', '.join(parts)


def get_all_sheet_rooms() -> list:
    """
    Return every unique venue from all weekday tabs (Mon-Fri) as:
      { room_number, room_type, capacity, location }
    """
    all_rooms_map = {}
    
    for day_num, day_name in WEEKDAY_NAMES.items():
        data = _get_day_data(day_name)
        if not data:
            continue
            
        for venue in data['rooms']:
            if venue in all_rooms_map:
                continue
                
            cap = _parse_capacity(venue)
            if 'S-2 Academic Block I' in venue:
                cap = 100
            
            all_rooms_map[venue] = {
                'room_number': venue,
                'room_type':   'lab' if venue in LAB_ROOMS else 'classroom',
                'capacity':    cap if cap else 30,
                'location':    _derive_location(venue),
            }

    rooms = list(all_rooms_map.values())
    log.info("Sheet room catalogue: %d rooms from all weekdays", len(rooms))
    return rooms

    log.info("Sheet room catalogue: %d rooms", len(rooms))
    return rooms


def get_slot_times(day_name: str) -> list:
    """
    Return the slot schedule for a weekday as a list:
      [{ 'slot': 1, 'start': '08:00', 'end': '08:50' }, ...]
    Used by the frontend to build the slot-picker UI.
    """
    data = _get_day_data(day_name)
    if not data:
        return []
    return [
        {'slot': snum, 'start': s.strftime('%H:%M'), 'end': e.strftime('%H:%M')}
        for snum, s, e in data['slot_times']
    ]
