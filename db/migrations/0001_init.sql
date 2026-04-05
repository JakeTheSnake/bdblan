-- bdblan initial schema
-- Run against a fresh MySQL 8 database.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS players (
  account_id        BIGINT UNSIGNED NOT NULL,
  persona_name      VARCHAR(255)    NOT NULL DEFAULT '',
  avatar_url        VARCHAR(512)    NULL,
  last_synced_at    DATETIME        NULL,
  PRIMARY KEY (account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS heroes (
  id              INT           NOT NULL,
  name            VARCHAR(128)  NOT NULL,
  localized_name  VARCHAR(128)  NOT NULL,
  img_url         VARCHAR(512)  NULL,
  icon_url        VARCHAR(512)  NULL,
  primary_attr    VARCHAR(16)   NULL,
  attack_type     VARCHAR(16)   NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lans (
  id                INT NOT NULL AUTO_INCREMENT,
  name              VARCHAR(255)    NOT NULL,
  start_date        DATE            NOT NULL,
  end_date          DATE            NOT NULL,
  host_account_id   BIGINT UNSIGNED NOT NULL,
  created_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_synced_at    DATETIME        NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_lans_host FOREIGN KEY (host_account_id) REFERENCES players(account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lan_players (
  lan_id      INT             NOT NULL,
  account_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (lan_id, account_id),
  CONSTRAINT fk_lp_lan     FOREIGN KEY (lan_id)     REFERENCES lans(id)               ON DELETE CASCADE,
  CONSTRAINT fk_lp_player  FOREIGN KEY (account_id) REFERENCES players(account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS matches (
  match_id          BIGINT UNSIGNED NOT NULL,
  start_time        BIGINT          NOT NULL,          -- unix seconds
  duration          INT             NOT NULL,          -- seconds
  radiant_win       BOOLEAN         NOT NULL,
  first_blood_time  INT             NULL,
  raw_json          JSON            NOT NULL,
  fetched_at        DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id),
  INDEX idx_matches_start_time (start_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lan_matches (
  lan_id    INT             NOT NULL,
  match_id  BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (lan_id, match_id),
  CONSTRAINT fk_lm_lan   FOREIGN KEY (lan_id)   REFERENCES lans(id)    ON DELETE CASCADE,
  CONSTRAINT fk_lm_match FOREIGN KEY (match_id) REFERENCES matches(match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS match_players (
  match_id          BIGINT UNSIGNED NOT NULL,
  player_slot       INT             NOT NULL,          -- 0-4 radiant, 128-132 dire
  account_id        BIGINT UNSIGNED NULL,              -- null for anonymous / private
  is_radiant        BOOLEAN         NOT NULL,
  hero_id           INT             NOT NULL,
  kills             INT             NOT NULL DEFAULT 0,
  deaths            INT             NOT NULL DEFAULT 0,
  assists           INT             NOT NULL DEFAULT 0,
  last_hits         INT             NOT NULL DEFAULT 0,
  denies            INT             NOT NULL DEFAULT 0,
  lh_at_10          INT             NULL,
  dn_at_10          INT             NULL,
  net_worth         INT             NULL,
  net_worth_at_10   INT             NULL,
  gpm               INT             NULL,
  xpm               INT             NULL,
  hero_damage       INT             NULL,
  tower_damage      INT             NULL,
  hero_healing      INT             NULL,
  PRIMARY KEY (match_id, player_slot),
  INDEX idx_mp_account (account_id),
  INDEX idx_mp_hero    (hero_id),
  CONSTRAINT fk_mp_match FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS match_objectives (
  id          BIGINT NOT NULL AUTO_INCREMENT,
  match_id    BIGINT UNSIGNED NOT NULL,
  time        INT             NOT NULL,      -- seconds into match
  type        VARCHAR(64)     NOT NULL,      -- CHAT_MESSAGE_TOWER_KILL, CHAT_MESSAGE_ROSHAN_KILL, CHAT_MESSAGE_MINIBOSS_KILL (tormentor), BUILDING_KILL, ...
  team        TINYINT         NULL,          -- 2=radiant, 3=dire
  key_name    VARCHAR(128)    NULL,          -- e.g. npc_dota_goodguys_tower2_mid
  slot        INT             NULL,
  player_slot INT             NULL,
  PRIMARY KEY (id),
  INDEX idx_mo_match_type_time (match_id, type, time),
  CONSTRAINT fk_mo_match FOREIGN KEY (match_id) REFERENCES matches(match_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
