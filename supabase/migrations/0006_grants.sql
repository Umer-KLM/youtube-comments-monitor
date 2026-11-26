-- Let the app's server key reach the tables and functions (26 Nov 2026).
-- Safe to run again.
--
-- Supabase projects created from late 2026 no longer grant the API roles
-- access to tables and functions made in the SQL editor. Without this the app
-- gets "permission denied for table ..." (Postgres error 42501) on every call.
-- Only service_role (the server-only secret key) is granted; anon and
-- authenticated (the publishable key) stay locked out, and row-level security
-- stays on as a second lock.

grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Tables, sequences and functions added later by a migration get the same.
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
