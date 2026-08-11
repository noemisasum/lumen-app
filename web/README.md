# Lumen Web

Next.js frontend for the Lumen Treasury application shell.

The npm package name remains `lumen-app-web` to avoid unnecessary technical churn.

## Supabase env vars (Vercel integration)

This app expects these environment variables to exist (Vercel Supabase integration usually adds them automatically):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

For email-link signup to work, the values must match the same Supabase project and the project must be active. In Supabase Dashboard → Authentication → URL Configuration:

- Set the site URL to the deployed Lumen origin.
- Add redirect URLs for each deployment that can send auth links, including `https://your-domain.example/auth/callback` and local development `http://localhost:3000/auth/callback` when testing locally.

Do not commit Supabase keys or secrets to the repo. Configure them in the deployment environment or a local `.env.local` file.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000
