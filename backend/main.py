import os
import json
import asyncio
import shutil
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel

# Import existing logic (ensure backend/ is in sys.path or use relative import)
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import integrity_check

app = FastAPI(title="Evidence Protector API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class AnalysisRequest(BaseModel):
    threshold: int = 60

@app.post("/analyze/demo")
async def analyze_demo(req: AnalysisRequest):
    logfile = "HDFS_2k.log"
    if not os.path.exists(logfile):
        # Check if it was moved to backend/
        logfile = os.path.join(os.path.dirname(__file__), "HDFS_2k.log")
        if not os.path.exists(logfile):
            raise HTTPException(status_code=404, detail="Demo log file not found")
    
    gaps, processed, skipped = integrity_check.detect_gaps(logfile, req.threshold)
    
    # Build result
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

    heatmap = integrity_check.build_heatmap(gaps)

    return {
        "metadata": {
            "file": "HDFS_2k.log",
            "threshold_seconds": req.threshold,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "lines_processed": processed,
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
        "heatmap": heatmap,
    }

@app.post("/analyze/upload")
async def analyze_upload(file: UploadFile = File(...), threshold: int = Form(60)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    gaps, processed, skipped = integrity_check.detect_gaps(file_path, threshold)
    
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

    heatmap = integrity_check.build_heatmap(gaps)

    return {
        "metadata": {
            "file": file.filename,
            "threshold_seconds": threshold,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "lines_processed": processed,
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
        "heatmap": heatmap,
    }

async def terminal_streamer(filepath: str, threshold: int):
    # Simulate the terminal output by yielding lines
    # We need to run the logic but yield the same strings print_gap_report and print_summary would produce
    
    lines = []
    lines.append(f"Analyzing {os.path.basename(filepath)} with threshold {threshold}s...")
    lines.append("══════════════════════════════════════════════════")
    
    gaps, processed, skipped = integrity_check.detect_gaps(filepath, threshold)
    
    for gap in gaps:
        mitre_desc = integrity_check.MITRE_DESCRIPTIONS.get(gap["mitre_id"], "Indicator Removal on Host")
        lines.append("══════════════════════════════════════════════════")
        lines.append(f"[{gap['severity']}] GAP #{gap['gap_number']} DETECTED")
        lines.append("══════════════════════════════════════════════════")
        lines.append(f"Start Time   : {gap['start_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"End Time     : {gap['end_time'].strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"Duration     : {integrity_check.format_duration(gap['duration_seconds'])}")
        lines.append(f"Pattern      : {gap['pattern']}")
        lines.append(f"MITRE ATT&CK : {gap['mitre_id']} -- {mitre_desc}")
        lines.append(f"Tamper Score : {gap['score']}/100")
        reasons_str = " | ".join(gap["score_reasons"]) if gap["score_reasons"] else "none"
        lines.append(f"Reasons      : {reasons_str}")
        lines.append("")
        lines.append("-- Context Before Gap --")
        for bline in gap["context_before"]:
            lines.append(f"  {bline}")
        lines.append("")
        lines.append("-- Context After Gap --")
        for aline in gap["context_after"]:
            lines.append(f"  {aline}")
        lines.append("══════════════════════════════════════════════════")
        lines.append("")

    # Summary
    lines.append("+" + "=" * 50 + "+")
    lines.append("|" + "FORENSIC SUMMARY REPORT".center(50) + "|")
    lines.append("+" + "=" * 50 + "+")
    lines.append(f"Log File          : {os.path.basename(filepath)}")
    lines.append(f"Threshold         : {threshold} seconds")
    lines.append(f"Lines Processed   : {processed:,}")
    lines.append(f"Malformed Skipped : {skipped}")
    lines.append(f"Total Gaps Found  : {len(gaps)}")
    lines.append("-" * 50)
    
    heatmap_buckets = integrity_check.build_heatmap(gaps)
    heatmap_lines = integrity_check.render_heatmap_terminal(heatmap_buckets)
    for hl in heatmap_lines:
        lines.append(hl)
    lines.append("-" * 50)
    
    if len(gaps) > 0:
        lines.append("Recommendation: Gaps detected. Investigation advised.")
    else:
        lines.append("Recommendation: No gaps detected. Log integrity intact.")
    
    for line in lines:
        yield f"data: {line}\n\n"
        await asyncio.sleep(0.03)  # 30ms delay as requested

@app.get("/stream/demo")
async def stream_demo(threshold: int = 60):
    logfile = os.path.join(os.path.dirname(__file__), "HDFS_2k.log")
    return StreamingResponse(terminal_streamer(logfile, threshold), media_type="text/event-stream")

@app.get("/stream/upload")
async def stream_upload(filename: str, threshold: int = 60):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Uploaded file not found")
    return StreamingResponse(terminal_streamer(file_path, threshold), media_type="text/event-stream")

@app.get("/download/json")
async def download_json(filename: str, threshold: int = 60):
    # For simplicity, we regenerate the JSON. In a real app we might cache it.
    file_path = os.path.join(UPLOAD_DIR, filename) if filename != "HDFS_2k.log" else os.path.join(os.path.dirname(__file__), "HDFS_2k.log")
    
    if not os.path.exists(file_path):
        # Fallback to backend/HDFS_2k.log if it's the demo file
        if filename == "HDFS_2k.log":
            file_path = os.path.join(os.path.dirname(__file__), "HDFS_2k.log")
        else:
            raise HTTPException(status_code=404, detail="File not found")

    gaps, processed, skipped = integrity_check.detect_gaps(file_path, threshold)
    
    # Temporarily write to a file to return it
    temp_json = f"report_{filename}.json"
    
    serializable_gaps = []
    for g in gaps:
        sg = dict(g)
        sg["start_time"] = g["start_time"].strftime("%Y-%m-%d %H:%M:%S")
        sg["end_time"] = g["end_time"].strftime("%Y-%m-%d %H:%M:%S")
        serializable_gaps.append(sg)

    report = {
        "metadata": {
            "file": filename,
            "threshold_seconds": threshold,
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "lines_processed": processed,
            "malformed_skipped": skipped,
        },
        "summary": {
            "total_gaps": len(gaps),
            "critical": sum(1 for g in gaps if g["severity"] == "CRITICAL"),
            "medium": sum(1 for g in gaps if g["severity"] == "MEDIUM"),
            "low": sum(1 for g in gaps if g["severity"] == "LOW"),
            "avg_tamper_score": round(sum(g["score"] for g in gaps) / len(gaps)) if gaps else 0,
        },
        "gaps": serializable_gaps,
    }
    
    with open(temp_json, "w") as f:
        json.dump(report, f, indent=2)
        
    return FileResponse(path=temp_json, filename="report.json", media_type="application/json")

@app.get("/download/html")
async def download_html(filename: str, threshold: int = 60):
    # Same logic for HTML
    file_path = os.path.join(UPLOAD_DIR, filename) if filename != "HDFS_2k.log" else os.path.join(os.path.dirname(__file__), "HDFS_2k.log")
    
    if not os.path.exists(file_path):
        if filename == "HDFS_2k.log":
            file_path = os.path.join(os.path.dirname(__file__), "HDFS_2k.log")
        else:
            raise HTTPException(status_code=404, detail="File not found")

    gaps, processed, skipped = integrity_check.detect_gaps(file_path, threshold)
    
    # We can use integrity_check.export_html but it writes to 'report.html'
    # To avoid collisions, we should probably modify it to return a string or take a path.
    # Since I can't modify it, I'll just let it write and then move it.
    
    current_cwd = os.getcwd()
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    try:
        integrity_check.export_html(filename, threshold, processed, skipped, gaps)
        # It writes to report.html
        temp_html = os.path.abspath("report.html")
    finally:
        os.chdir(current_cwd)
        
    return FileResponse(path=temp_html, filename="report.html", media_type="text/html")
