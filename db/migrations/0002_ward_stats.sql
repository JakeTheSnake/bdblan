-- 0002: per-player ward + sentry-purchase stats on match_players.
--
-- Supports the "support (pos 4/5)" ward highscores on the LAN page. OpenDota
-- has no position field, so position is inferred per match: on each team, the
-- two players who bought the most sentry wards are the supports.
--
-- All five columns are nullable — they are only populated for matches OpenDota
-- has parsed (replay data). Unparsed matches leave them NULL and are excluded
-- from the averages.

SET NAMES utf8mb4;

ALTER TABLE match_players
  ADD COLUMN obs_placed     INT NULL AFTER hero_healing,
  ADD COLUMN sen_placed     INT NULL AFTER obs_placed,
  ADD COLUMN observer_kills INT NULL AFTER sen_placed,
  ADD COLUMN sentry_kills   INT NULL AFTER observer_kills,
  ADD COLUMN sentry_bought  INT NULL AFTER sentry_kills;

-- Backfill matches already ingested, reading from the stored raw payload.
-- purchase.ward_sentry is absent when the player bought no sentries, so for a
-- parsed match (obs_placed present) a missing key means 0, not unknown.
UPDATE match_players mp
JOIN matches m ON m.match_id = mp.match_id
JOIN JSON_TABLE(
  m.raw_json,
  '$.players[*]' COLUMNS (
    player_slot    INT PATH '$.player_slot',
    obs_placed     INT PATH '$.obs_placed',
    sen_placed     INT PATH '$.sen_placed',
    observer_kills INT PATH '$.observer_kills',
    sentry_kills   INT PATH '$.sentry_kills',
    sentry_bought  INT PATH '$.purchase.ward_sentry'
  )
) jt ON jt.player_slot = mp.player_slot
SET
  mp.obs_placed     = jt.obs_placed,
  mp.sen_placed     = jt.sen_placed,
  mp.observer_kills = jt.observer_kills,
  mp.sentry_kills   = jt.sentry_kills,
  mp.sentry_bought  = IF(jt.obs_placed IS NULL, NULL, COALESCE(jt.sentry_bought, 0));
