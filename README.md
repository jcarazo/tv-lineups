# tv-lineups

Personal web app to manage TV broadcaster lineups per country and export them as
`lineup-<cc>-<slug>.json` files in the format consumed by the player app
(the original Spain file is kept as `tests/fixtures/lineup-es.json`).
Exported files are written to `lineups/`.

- **Countries** are picked from the ISO 3166 list. Each country owns its **channels**,
  which are never shared between countries.
- A country can have many **lineups**. A lineup places country channels at a **dial**,
  and the same channel can have a different dial in each lineup.
- Channels need a name, logo URL, ≥1 keyword (stored in UPPERCASE), ≥1 EPG id and a category.
  Imported channels that miss any of these are flagged **Incomplete**, and their lineups can't be exported.
- **Logos** are checked on the server: when saved, on demand, daily (`LOGO_CHECK_CRON`) and before an export.
  The lineup view also flags images that fail in the browser and logos you mark as *looks wrong*.
- **Export** shows the generated JSON and a diff against the file on disk, then writes the file.
  It never deletes or renames files.

## Run with Docker

```sh
docker compose up --build        # http://localhost:3000
```

- `./data` holds the SQLite database.
- Exports are written to `./lineups` (mounted at `/export`).
- To load the legacy Spain lineup, use **Import** with `tests/fixtures/lineup-es.json`, or run
  `npm install && npm run seed` once on the host before starting. Both use the same `./data/app.db`.
  The seed creates "Spain Legacy" (exported as `lineups/lineup-es-legacy.json`).
- Channel-only files for new countries live in `imports/` (use **Import → Channels only**).

## Develop

```sh
npm install
npm run seed       # optional: import the legacy Spain lineup as "Spain Legacy"
npm run dev        # exports go to lineups/ unless EXPORT_DIR is set
npm test           # vitest: domain rules, import/export round trip, logo checker
npm run typecheck && npm run lint
```

| Env var           | Default            | Purpose                                        |
| ----------------- | ------------------ | ---------------------------------------------- |
| `DATABASE_URL`    | `./data/app.db`    | SQLite file                                    |
| `EXPORT_DIR`      | `./lineups`        | Where lineup JSON files are written            |
| `LOGO_CHECK_CRON` | `0 3 * * *`        | Scheduled logo re-check; `off` disables it     |

Schema changes: edit `lib/db/schema.ts`, then `npm run db:generate`. Migrations run automatically on startup.
