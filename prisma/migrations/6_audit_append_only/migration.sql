-- Audit trail hardening.
--   1. Snapshot the actor's @username on each entry, so the trail stays readable
--      after a rename or an account deletion.
--   2. Shorten every stored IP address to its network (IPv4 /24, IPv6 /48).
--   3. Make the table append-only at the database level.

-- 1. Username snapshot, backfilled from current usernames.
ALTER TABLE "AuditLog" ADD COLUMN "actorUsername" TEXT;
UPDATE "AuditLog" AS a SET "actorUsername" = u."username" FROM "User" AS u WHERE u."id" = a."userId";

-- 2. Shorten IPs. Anything that isn't a valid address (e.g. "cli") is kept as is.
CREATE FUNCTION "bp_anonymize_ip"(ip TEXT) RETURNS TEXT AS $$
BEGIN
  IF family(ip::inet) = 4 THEN
    RETURN host(network(set_masklen(ip::inet, 24)));
  END IF;
  RETURN host(network(set_masklen(ip::inet, 48)));
EXCEPTION WHEN others THEN
  RETURN ip;
END
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE "AuditLog" SET "ipAddress" = "bp_anonymize_ip"("ipAddress");
DROP FUNCTION "bp_anonymize_ip"(TEXT);

-- 3. Append-only: no UPDATE, DELETE or TRUNCATE, from the app, scripts or raw SQL.
--    (The database owner can still drop the trigger deliberately, e.g. for a
--    documented retention clean-up; that leaves its own trace in the migrations.)
CREATE FUNCTION "audit_log_append_only"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not allowed', TG_OP;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AuditLog_no_update_or_delete"
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_append_only"();

CREATE TRIGGER "AuditLog_no_truncate"
  BEFORE TRUNCATE ON "AuditLog"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_append_only"();
