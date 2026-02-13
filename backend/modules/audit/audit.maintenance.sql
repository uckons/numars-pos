-- Audit logging maintenance pattern (retention + archive + index)

-- 1) Indexes for common filters
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);

-- 2) Archive table (same shape + archived_at)
CREATE TABLE IF NOT EXISTS audit_logs_archive (
  id BIGINT,
  user_id INT,
  action TEXT,
  target TEXT,
  created_at TIMESTAMP,
  archived_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3) Move old rows to archive (example: older than 180 days)
INSERT INTO audit_logs_archive (id, user_id, action, target, created_at)
SELECT id, user_id, action, target, created_at
FROM audit_logs
WHERE created_at < NOW() - INTERVAL '180 days';

DELETE FROM audit_logs
WHERE created_at < NOW() - INTERVAL '180 days';

-- 4) Optional helper function to run periodically (pg_cron / scheduler)
CREATE OR REPLACE FUNCTION audit_logs_archive_old(p_retention_days INT DEFAULT 180)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  moved_count INT;
BEGIN
  INSERT INTO audit_logs_archive (id, user_id, action, target, created_at)
  SELECT id, user_id, action, target, created_at
  FROM audit_logs
  WHERE created_at < NOW() - make_interval(days => p_retention_days);

  GET DIAGNOSTICS moved_count = ROW_COUNT;

  DELETE FROM audit_logs
  WHERE created_at < NOW() - make_interval(days => p_retention_days);

  RETURN moved_count;
END;
$$;
