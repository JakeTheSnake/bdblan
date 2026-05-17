-- 0004: per-player lane assignment on match_players.
--
-- Supports the "lane win rate" highscore on the LAN page. lane_role is
-- OpenDota's heuristic lane classification: 1 = safe, 2 = mid, 3 = off,
-- 4 = jungle. Nullable — only populated for parsed matches; unparsed matches
-- leave it NULL and are excluded from the lane win rate.

SET NAMES utf8mb4;

ALTER TABLE match_players
  ADD COLUMN lane_role INT NULL AFTER sentry_bought;

-- Backfill matches already ingested, reading from the stored raw payload.
UPDATE match_players mp
JOIN matches m ON m.match_id = mp.match_id
JOIN JSON_TABLE(
  m.raw_json,
  '$.players[*]' COLUMNS (
    player_slot INT PATH '$.player_slot',
    lane_role   INT PATH '$.lane_role'
  )
) jt ON jt.player_slot = mp.player_slot
SET mp.lane_role = jt.lane_role;
