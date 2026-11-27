# Render deployment guide

## What this project is

This repository is a React + TypeScript + Vite single-page frontend. It uses Supabase for its database and calls Supabase Edge Functions for order placement, funding operations, and notifications. It is **not** an Express/Node API server.

## Deploy the frontend as a Render Static Site

The included `render.yaml` configures:

- Build command: `npm ci && npm run build`
- Publish directory: `dist`
- SPA fallback: rewrite unknown paths to `/index.html`

### Dashboard deployment

1. Push the contents of this folder to a Git repository (private is recommended).
2. In Render, choose **New + > Static Site** and connect that repository.
3. Use the repository root as the Root Directory (the `package.json` file must be at the root).
4. Set Build Command to `npm ci && npm run build`.
5. Set Publish Directory to `dist`.
6. Add these build-time environment variables in the Render service settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
7. Deploy. The rewrite rule in `render.yaml` is needed so direct visits and refreshes of app paths resolve to the SPA.

If using Render Blueprints, select **New + > Blueprint** and connect the repository containing `render.yaml`. Review the service settings and add the two environment variables before/when deploying.

## Supabase services are separate from Render

Render Static Sites only publish the built frontend. The `supabase/` folder is retained in this package and contains SQL migrations and Edge Function source. Those are deployed to the existing Supabase project separately, using the Supabase CLI and the correct project reference:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
supabase functions deploy place-order
supabase functions deploy funding
supabase functions deploy send-notification
```

Do not run database migrations against a production project until you have reviewed them and taken a backup. Confirm each Edge Function's required secrets and access policies in the Supabase dashboard before enabling it.

## Secrets and safety

- The original `.env` file is intentionally **not included** in this deployment ZIP. Use `.env.example` as a template.
- Never commit `.env`, Supabase service-role keys, exchange API secrets, or Telegram bot tokens to Git or the frontend.
- Vite exposes variables prefixed with `VITE_` in the browser bundle. Only the Supabase anon/publishable key belongs in `VITE_SUPABASE_ANON_KEY`; it must be protected by correct Supabase Row Level Security policies.
- Exchange API credentials and other private secrets must not be embedded in frontend code or exposed to visitors.
- The application contains live order and withdrawal-related Edge Function code. Keep paper mode enabled and do not connect funded exchange accounts until the functions, authorization, database policies, and exchange permissions have been independently reviewed and tested. Use restricted API keys with withdrawals disabled.

## Important limitation

This package configures the frontend for Render. It does not convert Supabase Edge Functions into a Render backend, and it does not create or migrate a Supabase project. Keep the existing Supabase project and deploy its migrations/functions separately as described above.
