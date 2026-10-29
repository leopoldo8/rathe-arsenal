export const RECORD_CREDITS_SQL = `INSERT INTO firecrawl_usage (month, credits) VALUES ($1, $2)
  ON CONFLICT (month) DO UPDATE SET credits = firecrawl_usage.credits + EXCLUDED.credits`;
