-- Remove user-visible notifications created by automated discovery/audit probes.
-- Idempotent: no-op when rows are already gone.

DELETE FROM public.notifications
WHERE COALESCE(title, message, '') ~* '(DISCOVERY_PROBE|AUDIT-[0-9]+ .*probe)';
