-- 0003: per-player courier_kills on match_players.
--
-- Feeds the "Courier kills" highscore on the LAN page. Nullable like the other
-- optional stat columns (hero_damage, tower_damage): absent on the rare match
-- where OpenDota omits it. Aggregations COALESCE NULL to 0.

SET NAMES utf8mb4;

ALTER TABLE match_players
  ADD COLUMN courier_kills INT NULL AFTER hero_healing;

-- Backfill matches already ingested, reading from the stored raw payload.
UPDATE match_players mp
JOIN matches m ON m.match_id = mp.match_id
JOIN JSON_TABLE(
  m.raw_json,
  '$.players[*]' COLUMNS (
    player_slot   INT PATH '$.player_slot',
    courier_kills INT PATH '$.courier_kills'
  )
) jt ON jt.player_slot = mp.player_slot
SET mp.courier_kills = jt.courier_kills;
