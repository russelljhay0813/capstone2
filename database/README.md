# Database files

- `piat.db` is the backend's default SQLite database for a clean checkout.
- `piat.db.reset-backup-20260924-225101.db` is a preserved reset backup.
- `data.db` is retained as a legacy, unused database file.

Set `PIAT_DB_PATH` to select another database. For backward compatibility, the backend uses an existing `backend/piat.db` before falling back to `database/piat.db`.
