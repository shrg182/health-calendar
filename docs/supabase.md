# Supabase project setup

- **Project name:** `health-calendar`.
- **Database password:** generate one and save it in your password manager.
- **Region:** Americas.
- **Enable Data API:** on.
- **Automatically expose new tables:** off.
- **Enable automatic RLS:** off; [schema.sql](../supabase/schema.sql) enables RLS and restricts notes to their owner.

Click **Create new project** and wait for the dashboard. Continue with [sync setup](../README.md#enable-synchronization).

## Current status

The schema is installed, and browser-to-browser sync works. A rollback-only database test passed on October 20, 2026, verifying account isolation, conflict checks, and denied anonymous access.

For phone use, deploy to [Daymark](https://shrg182.github.io/health-calendar/). Set the Supabase **Site URL** to `https://shrg182.github.io/health-calendar/` so confirmation emails return to the hosted app. Real phone testing is still required.
