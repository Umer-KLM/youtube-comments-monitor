-- Keep the database inside the 500 MB free plan (26 Nov 2026).
-- Safe to run again.
--
-- items_platform_status_score duplicated items_status_score: platform is
-- always 'youtube', so (status, score) serves every query (~15 MB).
drop index if exists items_platform_status_score;

-- The cleanup job now also deletes keyword-filtered comments after 3 days
-- (src/lib/config.ts FILTERED_KEEP_DAYS). After a large delete, Postgres reuses
-- the freed space for new rows but does not shrink the files. To give the
-- space back at once (it locks the tables for a few seconds), run by hand:
--   vacuum full items;
--   vacuum full videos;
