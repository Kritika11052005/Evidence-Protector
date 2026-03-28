# Evidence Protector

**Detect suspicious time gaps in server log files indicating possible log tampering.**

Evidence Protector is a forensic CLI tool that streams through server logs, finds anomalous time gaps, scores them for tamper likelihood, and maps each to a MITRE ATT&CK technique — all with zero external dependencies.

---

## Quick Start

```bash
# Basic analysis (default 300s threshold)
python integrity_check.py sample.log

# Custom threshold (60 seconds)
python integrity_check.py sample.log --threshold 60

# Export beautiful HTML report
python integrity_check.py sample.log --threshold 60 --export html

# Export machine-readable JSON
python integrity_check.py sample.log --threshold 60 --export json

# Multi-file correlation
python integrity_check.py server1.log --threshold 60 --correlate server2.log server3.log
```

---

## Architecture

```
6 modules (single file):

Input Layer → Parse Layer → Detection Engine → Score & Fingerprint → Correlator → Report Layer
     │             │              │                    │                  │              │
  argparse    strptime()     deque(3)            weighted        cross-file          terminal
  file I/O    try/except     streaming           scoring          overlap           json/html
                             generator           MITRE ID        detection           heatmap
```

| Module | Responsibility |
|--------|----------------|
| `input_layer` | CLI argument parsing, file validation |
| `parse_line` | Timestamp extraction with error handling |
| `detect_gaps` | Streaming gap detection with context windows |
| `score_and_fingerprint` | Tamper confidence scoring (0-100) + MITRE ATT&CK mapping |
| `correlate_logs` | Multi-file gap overlap detection (coordinated wipe detection) |
| `report` | Terminal output, ASCII heatmap, JSON export, HTML export |

---

## Features

- **Gap Detection** — Streams line-by-line, never loads the full file into memory
- **Tamper Scoring** — Weighted 0-100 score based on duration, auth context, time-of-day
- **MITRE ATT&CK Mapping** — Each gap classified as POST-AUTH LOG WIPE, OFF-HOURS REMOVAL, etc.
- **ASCII Heatmap** — 24-hour visual distribution of suspicious gaps
- **HTML Report** — Dark cybersecurity-themed, self-contained report with progress bars and color-coded cards
- **Cross-File Correlation** — Detects coordinated gaps across multiple servers

---

## Why This Approach

We chose a streaming, single-file architecture to maximise portability and minimise resource usage. By iterating line-by-line with `open()` and using a `collections.deque(maxlen=3)` rolling buffer, the tool can analyse multi-gigabyte log files without ever loading more than a few lines into memory. Every line parse is wrapped in `try/except` so malformed or corrupted entries never crash the analysis — they are silently counted and reported. The weighted scoring system was designed to surface the gaps most likely to represent deliberate tampering (post-authentication, off-hours, clustered) while still flagging lesser anomalies for review.

---

## Tradeoffs

1. **Single-file architecture vs. package structure** — Keeping everything in one file makes it trivial to copy/deploy but harder to unit-test individual modules in isolation. For a hackathon prototype this is the right call; for production, we would split into a proper package.

2. **Heuristic scoring vs. ML-based detection** — The fixed-weight scoring system (+40 for duration, +25 for auth context, etc.) is transparent and explainable but cannot adapt to novel attack patterns. A production system would combine these heuristics with baseline statistical analysis.

3. **Standard library only vs. richer tooling** — Avoiding external dependencies ensures zero-friction deployment on any system with Python 3.8+, but means we forgo libraries like `rich` for prettier terminal output or `pandas` for more sophisticated time-series analysis.

---

## Sample Data

`sample.log` contains 50 lines with 3 deliberately planted gaps:

| Gap | Location | Type | Trigger |
|-----|----------|------|---------|
| #1 | Line ~15 | 8 min gap after `user root authenticated` | POST-AUTH LOG WIPE |
| #2 | Line ~30 | 12 min gap at 03:00 AM | OFF-HOURS EVIDENCE REMOVAL |
| #3 | Line ~45 | Two small gaps within 5 min of each other | RAPID LOG FLOODING |

---

## License

MIT
