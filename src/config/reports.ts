// Reasons on the "Report this site" form (docs/CONTENT-POLICY.md, "Not allowed").
export const REPORT_REASONS = [
  "porn",
  "minors",
  "illegal",
  "hate",
  "threats",
  "private",
  "stolen",
  "impersonation",
  "spam",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
