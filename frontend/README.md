# PaLaro frontend

Next.js 16 (App Router) frontend for [PaLaro](../README.md). It reads the
FastAPI API, renders the prediction dashboard, browse archive, team directory,
and team profiles.

## Run locally

```powershell
npm install
Copy-Item ..\.env.example .env.local
npm run dev
```

`NEXT_PUBLIC_API_URL` is the only frontend environment variable. It defaults
to `http://localhost:8000` when unset, so the app runs without an `.env.local`
during local development.

Open `http://localhost:3000`.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npx tsc --noEmit` | Type check |

See the [root README](../README.md) for database, backend, data ingestion, model
training, and API documentation.
