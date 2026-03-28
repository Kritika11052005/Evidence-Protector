#!/usr/bin/env python3
"""
Evidence Protector — Log Tampering Detection Tool
Detects suspicious time gaps in server log files indicating possible log tampering.
Standard library only. Streams line-by-line. Never crashes on malformed input.

Architecture (6 modules, single file):
  Module 1: input_layer          — argparse, file validation
  Module 2: parse_line           — timestamp extraction
  Module 3: detect_gaps          — streaming generator, yields gap dicts
  Module 4: score_and_fingerprint — tamper score + MITRE pattern per gap
  Module 5: correlate_logs       — multi-file gap overlap detection
  Module 6: report               — terminal output + json/html export
"""

import argparse
import collections
import json
import os
import sys
from datetime import datetime


# ════════════════════════════════════════════════════════════════════
# Module 1: input_layer — argparse, file validation
# ════════════════════════════════════════════════════════════════════

def input_layer():
    """Parse CLI arguments and validate file paths."""
    parser = argparse.ArgumentParser(
        prog="integrity_check.py",
        description="Evidence Protector — Detect suspicious time gaps in server logs.",
        epilog="Example: python integrity_check.py server.log --threshold 60 --export html",
    )
    parser.add_argument("logfile", help="Path to the primary log file to analyse")
    parser.add_argument(
        "--threshold",
        type=int,
        default=300,
        help="Gap threshold in seconds (default: 300)",
    )
    parser.add_argument(
        "--export",
        choices=["json", "html"],
        default=None,
        help="Export report to json or html",
    )
    parser.add_argument(
        "--correlate",
        nargs="+",
        default=None,
        help="Additional log files for cross-file correlation",
    )

    args = parser.parse_args()

    # Validate primary log file
    if not os.path.isfile(args.logfile):
        print(f"[ERROR] File not found: {args.logfile}")
        sys.exit(1)

    # Validate correlation files
    if args.correlate:
        for fpath in args.correlate:
            if not os.path.isfile(fpath):
                print(f"[ERROR] Correlation file not found: {fpath}")
                sys.exit(1)

    return args


# ════════════════════════════════════════════════════════════════════
# Module 2: parse_line — timestamp extraction
# ════════════════════════════════════════════════════════════════════

TIMESTAMP_FMT = "%y%m%d %H%M%S"


def parse_line(line):
    """
    Extract a datetime from a log line.
    Returns (datetime, stripped_line) or (None, stripped_line) on failure.
    """
    stripped = line.rstrip("\n\r")
    try:
        parts = stripped.split()
        if len(parts) < 2:
            return None, stripped
        ts_str = parts[0] + " " + parts[1]
        dt = datetime.strptime(ts_str, TIMESTAMP_FMT)
        return dt, stripped
    except (ValueError, IndexError):
        return None, stripped


# ════════════════════════════════════════════════════════════════════
# Module 3: detect_gaps — streaming generator
# ════════════════════════════════════════════════════════════════════

def detect_gaps(filepath, threshold):
    """
    Stream through a log file line-by-line.
    Yields gap dicts whenever a time gap > threshold seconds is found.
    Also returns (lines_processed, skipped_lines) via the .gi_frame trick —
    we package that as a final yield of a summary dict.
    """
    buffer_before = collections.deque(maxlen=3)
    prev_dt = None
    prev_line = None
    gap_number = 0
    lines_processed = 0
    skipped_lines = 0

    # We collect all gaps first because we need "nearby gap" info for
    # RAPID LOG FLOODING detection, and context-after requires reading ahead.
    gaps_raw = []  # list of dicts without score/pattern yet

    try:
        with open(filepath, "r", encoding="utf-8", errors="replace") as fh:
            lines_iter = iter(fh)
            for line in lines_iter:
                lines_processed += 1
                dt, stripped = parse_line(line)

                if dt is None:
                    skipped_lines += 1
                    buffer_before.append(stripped)
                    continue

                if prev_dt is not None:
                    try:
                        delta = (dt - prev_dt).total_seconds()
                    except Exception:
                        delta = 0

                    if delta > threshold:
                        gap_number += 1
                        context_before = list(buffer_before)

                        # Collect context after (up to 3 lines)
                        context_after = [stripped]
                        for _ in range(2):
                            try:
                                next_line = next(lines_iter)
                                lines_processed += 1
                                ndt, nstripped = parse_line(next_line)
                                if ndt is None:
                                    skipped_lines += 1
                                context_after.append(nstripped)
                                # Update state so gap detection continues correctly
                                if ndt is not None:
                                    dt = ndt
                                    stripped = nstripped
                            except StopIteration:
                                break

                        gaps_raw.append({
                            "gap_number": gap_number,
                            "start_time": prev_dt,
                            "end_time": dt if gap_number else dt,
                            "duration_seconds": int(delta),
                            "context_before": context_before,
                            "context_after": context_after,
                            "preceding_line": prev_line if prev_line else "",
                        })

                prev_dt = dt
                prev_line = stripped
                buffer_before.append(stripped)

    except Exception as e:
        print(f"[WARNING] Error reading {filepath}: {e}")

    # Now score and fingerprint each gap (needs full list for RAPID detection)
    scored_gaps = []
    for gap in gaps_raw:
        scored = score_and_fingerprint(gap, gaps_raw)
        scored_gaps.append(scored)

    return scored_gaps, lines_processed, skipped_lines


# ════════════════════════════════════════════════════════════════════
# Module 4: score_and_fingerprint — tamper score + MITRE pattern
# ════════════════════════════════════════════════════════════════════

AUTH_KEYWORDS = ("login", "auth", "session", "user", "sudo", "root")
SHUTDOWN_KEYWORDS = ("shutdown", "restart", "reboot", "sigterm", "halt")

MITRE_DESCRIPTIONS = {
    "T1070": "Indicator Removal on Host",
    "T1070.001": "Indicator Removal on Host: Clear Linux Logs",
    "T1070.002": "Indicator Removal on Host: Clear Linux Audit Logs",
}


def score_and_fingerprint(gap, all_gaps):
    """Calculate tamper score (0-100) and assign MITRE ATT&CK pattern."""
    duration = gap["duration_seconds"]
    preceding = gap["preceding_line"].lower()
    start_hour = gap["start_time"].hour

    # ── Tamper Confidence Score ──
    score = 0
    reasons = []

    if duration > 300:
        score += 40
        reasons.append("duration>5min (+40)")

    if any(kw in preceding for kw in AUTH_KEYWORDS):
        score += 25
        reasons.append("post-auth gap (+25)")

    if 2 <= start_hour <= 5:
        score += 22
        reasons.append("night-window 02-05h (+22)")

    if duration > 1800:
        score += 13
        reasons.append("duration>30min (+13)")

    score = min(score, 100)

    if score >= 70:
        severity = "CRITICAL"
    elif score >= 40:
        severity = "MEDIUM"
    else:
        severity = "LOW"

    # ── Attack Pattern Fingerprinting ──
    has_auth = any(kw in preceding for kw in AUTH_KEYWORDS)
    surrounding_text = " ".join(gap["context_before"] + gap["context_after"]).lower()
    has_shutdown = any(kw in surrounding_text for kw in SHUTDOWN_KEYWORDS)

    # Check proximity to other gaps for RAPID LOG FLOODING
    is_near_other_gap = False
    for other in all_gaps:
        if other["gap_number"] == gap["gap_number"]:
            continue
        try:
            time_between = abs(
                (gap["start_time"] - other["end_time"]).total_seconds()
            )
            if time_between <= 600:  # within 10 minutes
                is_near_other_gap = True
                break
        except Exception:
            pass

    if has_auth and duration > 300:
        pattern = "POST-AUTH LOG WIPE"
        mitre_id = "T1070.001"
    elif 2 <= start_hour <= 5 and duration > 600:
        pattern = "OFF-HOURS EVIDENCE REMOVAL"
        mitre_id = "T1070"
    elif duration < 600 and is_near_other_gap:
        pattern = "RAPID LOG FLOODING"
        mitre_id = "T1070.002"
    elif has_shutdown:
        pattern = "PRE-SHUTDOWN CLEANUP"
        mitre_id = "T1070"
    else:
        pattern = "UNCLASSIFIED GAP"
        mitre_id = "T1070"

    gap["score"] = score
    gap["score_reasons"] = reasons
    gap["severity"] = severity
    gap["pattern"] = pattern
    gap["mitre_id"] = mitre_id

    return gap


# ════════════════════════════════════════════════════════════════════
# Module 5: correlate_logs — multi-file gap overlap detection
# ════════════════════════════════════════════════════════════════════

def correlate_logs(primary_file, primary_gaps, correlate_files, threshold):
    """
    Run gap detection on each additional file and find overlapping gaps
    (within 60 seconds) across files.
    Returns a list of correlation dicts.
    """
    OVERLAP_WINDOW = 60  # seconds

    # Gather gaps per file
    all_file_gaps = {primary_file: primary_gaps}
    for fpath in correlate_files:
        gaps, _, _ = detect_gaps(fpath, threshold)
        all_file_gaps[fpath] = gaps

    filenames = list(all_file_gaps.keys())
    coordinated = []
    seen = set()

    for i, file_a in enumerate(filenames):
        for gap_a in all_file_gaps[file_a]:
            matching_files = {file_a}
            matching_window_start = gap_a["start_time"]
            matching_window_end = gap_a["end_time"]

            for j, file_b in enumerate(filenames):
                if file_a == file_b:
                    continue
                for gap_b in all_file_gaps[file_b]:
                    try:
                        # Check overlap within OVERLAP_WINDOW seconds
                        start_diff = abs(
                            (gap_a["start_time"] - gap_b["start_time"]).total_seconds()
                        )
                        end_diff = abs(
                            (gap_a["end_time"] - gap_b["end_time"]).total_seconds()
                        )
                        if start_diff <= OVERLAP_WINDOW or end_diff <= OVERLAP_WINDOW:
                            matching_files.add(file_b)
                            if gap_b["start_time"] < matching_window_start:
                                matching_window_start = gap_b["start_time"]
                            if gap_b["end_time"] > matching_window_end:
                                matching_window_end = gap_b["end_time"]
                    except Exception:
                        pass

            if len(matching_files) > 1:
                key = (
                    frozenset(matching_files),
                    matching_window_start.strftime("%Y%m%d%H%M%S"),
                )
                if key not in seen:
                    seen.add(key)
                    coordinated.append({
                        "files": sorted(matching_files),
                        "file_count": len(matching_files),
                        "window_start": matching_window_start,
                        "window_end": matching_window_end,
                    })

    return coordinated


# ════════════════════════════════════════════════════════════════════
# Module 6: report — terminal output + json/html export
# ════════════════════════════════════════════════════════════════════

# ── 6a: Hourly Heatmap ──

def build_heatmap(gaps):
    """Build a dict of hour -> gap count."""
    buckets = {h: 0 for h in range(24)}
    for gap in gaps:
        hour = gap["start_time"].hour
        buckets[hour] = buckets.get(hour, 0) + 1
    return buckets


def render_heatmap_terminal(buckets):
    """Render the ASCII heatmap to a list of strings."""
    blocks = {0: "░", 1: "▒", 2: "▓"}
    lines = []
    lines.append("HOURLY GAP HEATMAP")
    lines.append("══════════════════════════════════════════════════")
    for row_start in range(0, 24, 6):
        row_parts = []
        for h in range(row_start, row_start + 6):
            count = buckets.get(h, 0)
            char = blocks.get(count, "█")
            row_parts.append(f" {h:02d}h {char} ")
        lines.append("".join(row_parts))
    lines.append("══════════════════════════════════════════════════")

    # Find peak window
    peak_hour = max(buckets, key=buckets.get)
    if buckets[peak_hour] > 0:
        lines.append(f"Peak suspicious window: {peak_hour:02d}:00-{(peak_hour+1)%24:02d}:00")
    else:
        lines.append("Peak suspicious window: None (no gaps detected)")

    return lines


# ── 6b: Terminal Report ──

def format_duration(seconds):
    """Format seconds to human-readable string."""
    minutes = seconds // 60
    secs = seconds % 60
    return f"{seconds} seconds ({minutes} min {secs} sec)"


def print_gap_report(gap):
    """Print a single gap report block to terminal."""
    mitre_desc = MITRE_DESCRIPTIONS.get(gap["mitre_id"], "Indicator Removal on Host")
    print("══════════════════════════════════════════════════")
    print(f"[{gap['severity']}] GAP #{gap['gap_number']} DETECTED")
    print("══════════════════════════════════════════════════")
    print(f"Start Time   : {gap['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"End Time     : {gap['end_time'].strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Duration     : {format_duration(gap['duration_seconds'])}")
    print(f"Pattern      : {gap['pattern']}")
    print(f"MITRE ATT&CK : {gap['mitre_id']} -- {mitre_desc}")
    print(f"Tamper Score : {gap['score']}/100")
    reasons_str = " | ".join(gap["score_reasons"]) if gap["score_reasons"] else "none"
    print(f"Reasons      : {reasons_str}")
    print()
    print("-- Context Before Gap --")
    for line in gap["context_before"]:
        print(f"  {line}")
    print()
    print("-- Context After Gap --")
    for line in gap["context_after"]:
        print(f"  {line}")
    print("══════════════════════════════════════════════════")
    print()


def print_summary(logfile, threshold, lines_processed, skipped, gaps):
    """Print the forensic summary report."""
    total = len(gaps)
    critical = sum(1 for g in gaps if g["severity"] == "CRITICAL")
    medium = sum(1 for g in gaps if g["severity"] == "MEDIUM")
    low = sum(1 for g in gaps if g["severity"] == "LOW")
    avg_score = (
        round(sum(g["score"] for g in gaps) / total) if total > 0 else 0
    )

    heatmap_buckets = build_heatmap(gaps)
    heatmap_lines = render_heatmap_terminal(heatmap_buckets)

    print()
    print("+" + "=" * 50 + "+")
    print("|" + "FORENSIC SUMMARY REPORT".center(50) + "|")
    print("+" + "=" * 50 + "+")
    print(f"Log File          : {logfile}")
    print(f"Threshold         : {threshold} seconds")
    print(f"Lines Processed   : {lines_processed:,}")
    print(f"Malformed Skipped : {skipped}")
    print(f"Total Gaps Found  : {total}")
    print("-" * 50)
    print(f"CRITICAL gaps     : {critical}")
    print(f"MEDIUM gaps       : {medium}")
    print(f"LOW gaps          : {low}")
    print(f"Avg Tamper Score  : {avg_score}/100")
    print("-" * 50)
    for hl in heatmap_lines:
        print(hl)
    print("-" * 50)

    if critical > 0:
        print("Recommendation: CRITICAL gaps detected. Immediate investigation advised.")
    elif medium > 0:
        print("Recommendation: MEDIUM-risk gaps found. Review recommended.")
    elif total > 0:
        print("Recommendation: LOW-risk gaps found. Routine check sufficient.")
    else:
        print("Recommendation: No gaps detected. Log integrity appears intact.")
    print()


def print_correlation_report(coordinated):
    """Print the cross-file correlation report."""
    if not coordinated:
        return
    print()
    print("CROSS-FILE CORRELATION REPORT")
    print("══════════════════════════════════════════════════")
    for item in coordinated:
        print(f"[!!!] COORDINATED GAP DETECTED across {item['file_count']} files")
        ws = item["window_start"].strftime("%H:%M:%S")
        we = item["window_end"].strftime("%H:%M:%S")
        print(f"      Time window : {ws} -> {we}")
        print(f"      Files affected : {', '.join(item['files'])}")
        print(f"      Significance : Same gap on multiple servers = likely coordinated wipe")
        print()
    print("══════════════════════════════════════════════════")
    print()


# ── 6c: JSON Export ──

def export_json(logfile, threshold, lines_processed, skipped, gaps):
    """Write report.json."""
    total = len(gaps)
    critical = sum(1 for g in gaps if g["severity"] == "CRITICAL")
    medium = sum(1 for g in gaps if g["severity"] == "MEDIUM")
    low = sum(1 for g in gaps if g["severity"] == "LOW")
    avg_score = round(sum(g["score"] for g in gaps) / total) if total > 0 else 0

    serializable_gaps = []
    for g in gaps:
        sg = dict(g)
        sg["start_time"] = g["start_time"].strftime("%Y-%m-%d %H:%M:%S")
        sg["end_time"] = g["end_time"].strftime("%Y-%m-%d %H:%M:%S")
        serializable_gaps.append(sg)

    report = {
        "metadata": {
            "file": logfile,
            "threshold_seconds": threshold,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "lines_processed": lines_processed,
            "malformed_skipped": skipped,
        },
        "summary": {
            "total_gaps": total,
            "critical": critical,
            "medium": medium,
            "low": low,
            "avg_tamper_score": avg_score,
        },
        "gaps": serializable_gaps,
    }

    out_path = "report.json"
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2, ensure_ascii=False)
    print(f"[+] JSON report written to {out_path}")


# ── 6d: HTML Export ──

def export_html(logfile, threshold, lines_processed, skipped, gaps):
    """Write a self-contained report.html with dark cybersecurity theme."""
    total = len(gaps)
    critical = sum(1 for g in gaps if g["severity"] == "CRITICAL")
    medium = sum(1 for g in gaps if g["severity"] == "MEDIUM")
    low = sum(1 for g in gaps if g["severity"] == "LOW")
    avg_score = round(sum(g["score"] for g in gaps) / total) if total > 0 else 0

    severity_colors = {
        "CRITICAL": "#ff4444",
        "MEDIUM": "#ff8800",
        "LOW": "#ffcc00",
    }

    heatmap_buckets = build_heatmap(gaps)

    def heatmap_color(count):
        if count == 0:
            return "#1a1f36"
        elif count == 1:
            return "#2a4a3a"
        elif count == 2:
            return "#3a7a4a"
        else:
            return "#00ff88"

    # Build heatmap HTML cells
    heatmap_cells = ""
    for h in range(24):
        c = heatmap_buckets.get(h, 0)
        bg = heatmap_color(c)
        heatmap_cells += (
            f'<div class="heat-cell" style="background:{bg};">'
            f'<span class="heat-hour">{h:02d}h</span>'
            f'<span class="heat-count">{c}</span></div>\n'
        )

    # Build gap cards
    gap_cards = ""
    for g in gaps:
        border_color = severity_colors.get(g["severity"], "#666")
        mitre_desc = MITRE_DESCRIPTIONS.get(g["mitre_id"], "Indicator Removal on Host")
        reasons_str = " | ".join(g["score_reasons"]) if g["score_reasons"] else "none"

        ctx_before = "\n".join(f"  {l}" for l in g["context_before"])
        ctx_after = "\n".join(f"  {l}" for l in g["context_after"])

        score_pct = g["score"]
        if score_pct >= 70:
            bar_color = "#ff4444"
        elif score_pct >= 40:
            bar_color = "#ff8800"
        else:
            bar_color = "#ffcc00"

        gap_cards += f"""
        <div class="gap-card" style="border-left: 4px solid {border_color};">
            <div class="gap-header">
                <span class="severity-badge" style="background:{border_color};">{g['severity']}</span>
                <span class="gap-title">GAP #{g['gap_number']}</span>
            </div>
            <div class="gap-meta">
                <div class="meta-row"><span class="meta-label">Start Time</span><span class="meta-value">{g['start_time'].strftime('%Y-%m-%d %H:%M:%S')}</span></div>
                <div class="meta-row"><span class="meta-label">End Time</span><span class="meta-value">{g['end_time'].strftime('%Y-%m-%d %H:%M:%S')}</span></div>
                <div class="meta-row"><span class="meta-label">Duration</span><span class="meta-value">{format_duration(g['duration_seconds'])}</span></div>
                <div class="meta-row"><span class="meta-label">Pattern</span><span class="meta-value" style="color:#00ff88;">{g['pattern']}</span></div>
                <div class="meta-row"><span class="meta-label">MITRE ATT&CK</span><span class="meta-value">{g['mitre_id']} &mdash; {mitre_desc}</span></div>
            </div>
            <div class="score-section">
                <div class="score-label">Tamper Score: {g['score']}/100</div>
                <div class="score-bar-bg"><div class="score-bar-fill" style="width:{score_pct}%;background:{bar_color};"></div></div>
                <div class="score-reasons">{reasons_str}</div>
            </div>
            <div class="context-section">
                <div class="context-title">Context Before Gap</div>
                <pre class="context-block">{ctx_before}</pre>
                <div class="context-title">Context After Gap</div>
                <pre class="context-block">{ctx_after}</pre>
            </div>
        </div>
        """

    peak_hour = max(heatmap_buckets, key=heatmap_buckets.get)
    peak_text = (
        f"{peak_hour:02d}:00 - {(peak_hour+1)%24:02d}:00"
        if heatmap_buckets[peak_hour] > 0
        else "None"
    )

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Evidence Protector - Forensic Report</title>
<style>
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=Inter:wght@300;400;600;700&display=swap');

    * {{ margin: 0; padding: 0; box-sizing: border-box; }}
    body {{
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        background: #0a0e1a;
        color: #c8d6e5;
        min-height: 100vh;
        line-height: 1.6;
    }}
    .container {{ max-width: 1100px; margin: 0 auto; padding: 40px 20px; }}

    /* Header */
    .header {{
        text-align: center;
        margin-bottom: 40px;
        padding: 40px 20px;
        background: linear-gradient(135deg, #0d1526 0%, #141e33 100%);
        border-radius: 16px;
        border: 1px solid #1a2744;
        position: relative;
        overflow: hidden;
    }}
    .header::before {{
        content: '';
        position: absolute;
        top: 0; left: 0; right: 0;
        height: 3px;
        background: linear-gradient(90deg, transparent, #00ff88, transparent);
    }}
    .header h1 {{
        font-size: 2.2em;
        font-weight: 700;
        color: #00ff88;
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-bottom: 8px;
        text-shadow: 0 0 30px rgba(0, 255, 136, 0.3);
    }}
    .header .subtitle {{
        font-size: 1em;
        color: #7f8fa6;
        font-weight: 300;
    }}

    /* Stats bar */
    .stats-bar {{
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin-bottom: 36px;
    }}
    .stat-card {{
        background: linear-gradient(135deg, #111827 0%, #1a2332 100%);
        border-radius: 12px;
        padding: 24px;
        text-align: center;
        border: 1px solid #1e2d44;
        transition: transform 0.2s, border-color 0.2s;
    }}
    .stat-card:hover {{
        transform: translateY(-2px);
        border-color: #00ff88;
    }}
    .stat-number {{
        font-size: 2.4em;
        font-weight: 700;
        color: #ffffff;
        display: block;
    }}
    .stat-number.critical {{ color: #ff4444; }}
    .stat-number.score {{ color: #00ff88; }}
    .stat-label {{
        font-size: 0.85em;
        color: #7f8fa6;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-top: 4px;
    }}

    /* Meta info */
    .meta-info {{
        background: #111827;
        border-radius: 12px;
        padding: 20px 28px;
        margin-bottom: 36px;
        border: 1px solid #1e2d44;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
    }}
    .meta-info-item {{ font-size: 0.9em; }}
    .meta-info-item span:first-child {{ color: #7f8fa6; margin-right: 8px; }}
    .meta-info-item span:last-child {{ color: #e0e0e0; font-weight: 600; }}

    /* Section titles */
    .section-title {{
        font-size: 1.3em;
        font-weight: 700;
        color: #00ff88;
        margin: 36px 0 20px;
        padding-bottom: 8px;
        border-bottom: 2px solid #1a2744;
        text-transform: uppercase;
        letter-spacing: 1px;
    }}

    /* Heatmap */
    .heatmap-grid {{
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
        margin-bottom: 12px;
    }}
    .heat-cell {{
        border-radius: 8px;
        padding: 14px 8px;
        text-align: center;
        border: 1px solid #1e2d44;
        transition: transform 0.15s;
    }}
    .heat-cell:hover {{ transform: scale(1.05); }}
    .heat-hour {{
        display: block;
        font-size: 0.8em;
        color: #7f8fa6;
        font-weight: 600;
    }}
    .heat-count {{
        display: block;
        font-size: 1.4em;
        font-weight: 700;
        color: #fff;
        margin-top: 2px;
    }}
    .peak-text {{
        text-align: center;
        color: #7f8fa6;
        font-size: 0.9em;
        margin-top: 8px;
    }}
    .peak-text span {{ color: #00ff88; font-weight: 600; }}

    /* Gap cards */
    .gap-card {{
        background: linear-gradient(135deg, #111827 0%, #151d2e 100%);
        border-radius: 12px;
        padding: 28px;
        margin-bottom: 24px;
        border: 1px solid #1e2d44;
    }}
    .gap-header {{
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 20px;
    }}
    .severity-badge {{
        padding: 4px 14px;
        border-radius: 20px;
        font-size: 0.75em;
        font-weight: 700;
        color: #fff;
        text-transform: uppercase;
        letter-spacing: 1px;
    }}
    .gap-title {{
        font-size: 1.2em;
        font-weight: 700;
        color: #fff;
    }}
    .gap-meta {{
        display: grid;
        gap: 8px;
        margin-bottom: 20px;
    }}
    .meta-row {{
        display: flex;
        justify-content: space-between;
        padding: 6px 0;
        border-bottom: 1px solid #1a2035;
    }}
    .meta-label {{
        color: #7f8fa6;
        font-size: 0.9em;
    }}
    .meta-value {{
        color: #e0e0e0;
        font-weight: 600;
        font-size: 0.9em;
    }}

    /* Score */
    .score-section {{
        margin: 20px 0;
        padding: 16px;
        background: #0d1220;
        border-radius: 8px;
    }}
    .score-label {{
        font-weight: 700;
        color: #fff;
        margin-bottom: 10px;
        font-size: 1em;
    }}
    .score-bar-bg {{
        width: 100%;
        height: 10px;
        background: #1a2035;
        border-radius: 5px;
        overflow: hidden;
    }}
    .score-bar-fill {{
        height: 100%;
        border-radius: 5px;
        transition: width 0.5s ease;
    }}
    .score-reasons {{
        margin-top: 8px;
        font-size: 0.82em;
        color: #7f8fa6;
        font-style: italic;
    }}

    /* Context */
    .context-section {{ margin-top: 20px; }}
    .context-title {{
        font-size: 0.85em;
        font-weight: 600;
        color: #00ff88;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }}
    .context-block {{
        font-family: 'JetBrains Mono', 'Courier New', monospace;
        font-size: 0.82em;
        background: #080c16;
        color: #b0c4de;
        padding: 14px;
        border-radius: 6px;
        overflow-x: auto;
        margin-bottom: 14px;
        border: 1px solid #1a2035;
        line-height: 1.7;
    }}

    /* Footer */
    .footer {{
        text-align: center;
        margin-top: 50px;
        padding: 20px;
        color: #4a5568;
        font-size: 0.8em;
    }}
</style>
</head>
<body>
<div class="container">

    <div class="header">
        <h1>Evidence Protector</h1>
        <div class="subtitle">Forensic Log Integrity Analysis Report</div>
    </div>

    <div class="stats-bar">
        <div class="stat-card">
            <span class="stat-number">{total}</span>
            <span class="stat-label">Total Gaps</span>
        </div>
        <div class="stat-card">
            <span class="stat-number critical">{critical}</span>
            <span class="stat-label">Critical</span>
        </div>
        <div class="stat-card">
            <span class="stat-number">{medium}</span>
            <span class="stat-label">Medium</span>
        </div>
        <div class="stat-card">
            <span class="stat-number">{low}</span>
            <span class="stat-label">Low</span>
        </div>
        <div class="stat-card">
            <span class="stat-number score">{avg_score}</span>
            <span class="stat-label">Avg Tamper Score</span>
        </div>
    </div>

    <div class="meta-info">
        <div class="meta-info-item"><span>Log File:</span><span>{logfile}</span></div>
        <div class="meta-info-item"><span>Threshold:</span><span>{threshold}s</span></div>
        <div class="meta-info-item"><span>Lines Processed:</span><span>{lines_processed:,}</span></div>
        <div class="meta-info-item"><span>Malformed Skipped:</span><span>{skipped}</span></div>
    </div>

    <div class="section-title">Hourly Gap Heatmap</div>
    <div class="heatmap-grid">
        {heatmap_cells}
    </div>
    <div class="peak-text">Peak suspicious window: <span>{peak_text}</span></div>

    <div class="section-title">Detected Gaps</div>
    {gap_cards}

    <div class="footer">
        Generated by Evidence Protector &mdash; {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    </div>

</div>
</body>
</html>"""

    out_path = "report.html"
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(html)
    print(f"[+] HTML report written to {out_path}")


# ════════════════════════════════════════════════════════════════════
# Main
# ════════════════════════════════════════════════════════════════════

def main():
    # Fix Windows console encoding for Unicode box-drawing characters
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    args = input_layer()

    print()
    print("=" * 52)
    print(" EVIDENCE PROTECTOR - Log Integrity Analyser")
    print("=" * 52)
    print(f" Target  : {args.logfile}")
    print(f" Threshold: {args.threshold}s")
    print("=" * 52)
    print()

    # Run gap detection
    gaps, lines_processed, skipped = detect_gaps(args.logfile, args.threshold)

    # Print each gap
    for gap in gaps:
        print_gap_report(gap)

    # Print summary
    print_summary(args.logfile, args.threshold, lines_processed, skipped, gaps)

    # Correlation
    if args.correlate:
        coordinated = correlate_logs(
            args.logfile, gaps, args.correlate, args.threshold
        )
        print_correlation_report(coordinated)

    # Export
    if args.export == "json":
        export_json(args.logfile, args.threshold, lines_processed, skipped, gaps)
    elif args.export == "html":
        export_html(args.logfile, args.threshold, lines_processed, skipped, gaps)

    print("[*] Analysis complete.")


if __name__ == "__main__":
    main()
