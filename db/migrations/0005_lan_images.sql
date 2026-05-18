-- 0005: images attached to a LAN.
--
-- Admins upload photos/screenshots to a LAN; they show as a thumbnail gallery
-- on the LAN page. Both the full image and a client-generated thumbnail are
-- stored inline as BLOBs so the page renders fast from the small thumbnails.
-- MEDIUMBLOB caps each column at 16 MB; uploads are limited to ~15 MB.

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS lan_images (
  id          INT NOT NULL AUTO_INCREMENT,
  lan_id      INT NOT NULL,
  filename    VARCHAR(255)  NULL,
  mime_type   VARCHAR(100)  NOT NULL,
  image_data  MEDIUMBLOB    NOT NULL,
  thumb_mime  VARCHAR(100)  NOT NULL,
  thumb_data  MEDIUMBLOB    NOT NULL,
  uploaded_at DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_lan_images_lan (lan_id),
  CONSTRAINT fk_lan_images_lan FOREIGN KEY (lan_id)
    REFERENCES lans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
