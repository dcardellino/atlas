-- Atlas — API token lifecycle (TASK-056, PRD § Edge Cases: "Ungültiges/abgelaufenes
-- Token → 401, Hinweis Token neu erzeugen"). Adds soft-revocation and optional
-- expiry to the shortcut tokens so /api/capture can tell a revoked/expired token
-- apart from an unknown one and answer with a specific 401. Idempotent; reloads
-- the PostgREST schema cache at the end.

alter table api_tokens add column if not exists revoked_at timestamptz;
alter table api_tokens add column if not exists expires_at timestamptz;

notify pgrst, 'reload schema';
