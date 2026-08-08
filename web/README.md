# Lumen Web

Next.js frontend for the Lumen Treasury application shell.

The npm package name remains `lumen-app-web` to avoid unnecessary technical churn.

## Supabase env vars (Vercel integration)

This app expects these environment variables to exist (Vercel Supabase integration usually adds them automatically):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000
