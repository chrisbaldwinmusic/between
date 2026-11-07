// Survey retention, to match both privacy notices ("24 months, then only anonymised totals"):
// 24 months after someone answered, the written answer and the postcode half are removed from the survey
// response (and the postcode half from a check-in). What stays is the multiple-choice answers with no text,
// no postcode and no identifier, which is what the combined figures are built from.
// Run by the daily cron in worker/gate.js.

import { cutoff } from './comments.js';

export const SURVEY_RETENTION_MONTHS = 24;

export async function runRetention(db, now = new Date()) {
  const before = cutoff(now, SURVEY_RETENTION_MONTHS);
  const survey = await db
    .prepare(`UPDATE feedback_responses SET venue_wants = NULL, outward_postcode = NULL
              WHERE created_at < ? AND (venue_wants IS NOT NULL OR outward_postcode IS NOT NULL)`)
    .bind(before).run();
  const checkins = await db
    .prepare(`UPDATE checkins SET outward_postcode = NULL WHERE created_at < ? AND outward_postcode IS NOT NULL`)
    .bind(before).run();
  return { survey: survey.meta?.changes ?? 0, checkins: checkins.meta?.changes ?? 0 };
}
