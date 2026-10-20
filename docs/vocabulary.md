# Project vocabulary

- **Supabase** — A backend platform that provides a PostgreSQL database and user sign-in. In this project, it could store notes shared across a user's devices.
- **PostgreSQL** — A database that stores structured data in tables, such as one row per daily note.
- **Auth (authentication)** — Verifies who a user is when they sign in. Authorization determines which notes they may access.
- **Row-level security (RLS)** — Database rules that control access to individual rows. We would configure these rules so each user can access only their own notes.
- **IndexedDB** — A database inside the browser. The app currently uses it to save notes on that device for offline access; it does not synchronize them between devices by itself.
- **Firebase Firestore** — Google's cloud document database. It is an alternative to Supabase, with support for offline caching and synchronization when configured.
- **Canonical notation** — The reference form used consistently across languages. For GanZhi, this means keeping characters such as 甲子 and adding pronunciation or explanations for English and Russian readers.


sexagenary
A sexagenary refers to something that relates to the number 60, proceeds by sixties, or represents a 60-year period.
Sexagenary cycle 在中文中通常被称为干支、干支纪法、六十花甲或六十干支。