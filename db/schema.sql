-- 수집 대상 캐릭터
CREATE TABLE IF NOT EXISTS characters (
  ocid           TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  world          TEXT NOT NULL,
  class          TEXT NOT NULL,
  last_collected DATE
);
CREATE INDEX IF NOT EXISTS characters_last_collected ON characters (last_collected NULLS FIRST);

-- 날짜별 스펙 스냅샷
CREATE TABLE IF NOT EXISTS snapshots (
  ocid          TEXT NOT NULL REFERENCES characters (ocid) ON DELETE CASCADE,
  date          DATE NOT NULL,
  class         TEXT NOT NULL,
  level         INT NOT NULL,
  combat_power  BIGINT NOT NULL,
  slots         JSONB NOT NULL, -- SlotState[]
  PRIMARY KEY (ocid, date)
);
CREATE INDEX IF NOT EXISTS snapshots_class_cp ON snapshots (class, date, combat_power);

-- 연속된 두 스냅샷 사이에서 감지한 스펙업
CREATE TABLE IF NOT EXISTS upgrade_events (
  id         BIGSERIAL PRIMARY KEY,
  ocid       TEXT NOT NULL REFERENCES characters (ocid) ON DELETE CASCADE,
  class      TEXT NOT NULL,
  date_from  DATE NOT NULL,
  date_to    DATE NOT NULL,
  slot       TEXT NOT NULL,
  kind       TEXT NOT NULL, -- item | starforce | potential | additional
  target     TEXT NOT NULL,
  from_value TEXT NOT NULL,
  to_value   TEXT NOT NULL,
  cp_before  BIGINT NOT NULL,
  cp_after   BIGINT NOT NULL,
  UNIQUE (ocid, date_to, slot, kind)
);
CREATE INDEX IF NOT EXISTS upgrade_events_class_cp ON upgrade_events (class, cp_before);
