# Lumen Web

Next.js frontend for the Lumen Treasury application shell.

The npm package name remains `lumen-app-web` to avoid unnecessary technical churn.

## Supabase env vars (Vercel integration)

This app expects these environment variables to exist (Vercel Supabase integration usually adds them automatically):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-side API routes that write private integration records also require:

- `SUPABASE_SERVICE_ROLE_KEY`

For email/password signup and login to work, the values must match the same Supabase project and the project must be active. The current production Supabase project autoconfirms new email/password users, so signup should not depend on a confirmation email. If email confirmation is re-enabled in Supabase later, password signup will send a confirmation email. In Supabase Dashboard → Authentication → URL Configuration:

- Set the site URL to the deployed Lumen origin.
- Add redirect URLs for each deployment that can receive email confirmation callbacks, including `https://your-domain.example/auth/callback` and local development `http://localhost:3000/auth/callback` when testing locally.

Do not commit Supabase keys or secrets to the repo. Configure them in the deployment environment or a local `.env.local` file.

## Xero OAuth env vars

The Xero connection routes expect these server-only environment variables:

- `XERO_CLIENT_ID`
- `XERO_CLIENT_SECRET`
- `XERO_REDIRECT_URI`
- `XERO_TOKEN_ENCRYPTION_KEY`

Set `XERO_TOKEN_ENCRYPTION_KEY` to generated key material, not a passphrase or arbitrary string. The app accepts either a 32-byte base64 key or a 64-character hex key and fails Xero connection startup if the value is missing or invalid.

Safe generation commands:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

The app encrypts the Xero token set with AES-GCM before writing it to `public.xero_connections`, which is locked to server-side service-role access by the migration.

Configure the Xero app callback URLs to include:

- Production: `https://app.lumen-labs.io/api/xero/callback`
- Local development: `http://localhost:3000/api/xero/callback`

For production, set `XERO_REDIRECT_URI=https://app.lumen-labs.io/api/xero/callback`. For local development, set `XERO_REDIRECT_URI=http://localhost:3000/api/xero/callback` in `.env.local`.

Apply `supabase/xero_oauth.sql` after the base Supabase schema. The Xero tables have RLS enabled, no client-role grants or policies, and are intended to be accessed only by API routes using `SUPABASE_SERVICE_ROLE_KEY`. Browser code should use `/api/xero/status` rather than querying these tables directly.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000
