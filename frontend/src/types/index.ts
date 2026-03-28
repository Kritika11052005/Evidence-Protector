export interface Gap {
  gap_number: number;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  pattern: string;
  mitre_id: string;
  severity: "CRITICAL" | "MEDIUM" | "LOW";
  score: number;
  score_reasons: string[];
  context_before: string[];
  context_after: string[];
}

export interface AnalysisResult {
  metadata: {
    file: string;
    threshold_seconds: number;
    generated_at: string;
    lines_processed: number;
    malformed_skipped: number;
  };
  summary: {
    total_gaps: number;
    critical: number;
    medium: number;
    low: number;
    avg_tamper_score: number;
  };
  gaps: Gap[];
  heatmap: Record<string, number>;
}
