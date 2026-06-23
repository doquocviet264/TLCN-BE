# Deploy (Render)

This repo deploys as a Render **Web Service** (Node). `render.yaml` declares the
service and every env var it needs (secrets are marked `sync: false` so Render
prompts you to fill them in instead of storing real values in git).

## Order matters

Deploy in this order, because each service needs the URL of the one before it:

1. **recommendation-service** (`KLTN-DEEPFM` repo) → gives you its Render URL.
2. **TLCN-BE** (this repo) → needs the RS URL from step 1, gives you its own URL.
3. **TLCN-FE** (Vercel) → needs the BE URL from step 2, gives you its own URL.
4. Come back to **this repo's env vars** and fill in `CORS_ORIGINS` /
   `FRONTEND_URL` with the real FE URL from step 3, then redeploy.

## Steps

1. Push this repo to GitHub (already done if you're reading this from the repo).
2. On Render: **New > Blueprint**, point it at this repo. Render reads
   `render.yaml` and creates the `tlcn-be` web service.
3. Fill in every env var listed in `.env.example`. Most can be copied straight
   from your local `.env`. The ones that **must change** for production:
   - `CORS_ORIGINS`, `FRONTEND_URL`, `BASE_URL` → your real Vercel/Render URLs,
     not localhost.
   - `RECOMMENDATION_API` → the recommendation-service's Render URL.
   - `GOOGLE_CALLBACK_URL` → also add this exact URL as an authorized redirect
     URI in [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
     or Google login will fail.
   - `VNP_RETURN_URL`, `MOMO_REDIRECT_URL`, `MOMO_IPN_URL` → these are
     registered with VNPay/MoMo's merchant portals too. Payments will silently
     fail (or callbacks won't reach this server) until you update them there.
4. Deploy. Check `https://<your-service>.onrender.com/healthz` returns
   `{"ok":true}`.

## Known gaps (not blockers, but worth knowing)

- **CORS is currently wide open in production.** `src/app.js` has a stray
  block that makes the `CORS_ORIGINS` allowlist unreachable — every origin is
  accepted regardless of `NODE_ENV`. This was left as-is on purpose so the
  first deploy isn't broken by a misconfigured origin list. Once the real FE
  URL is confirmed working end-to-end, tighten this back up.
- `DB_HOST`/`DB_USER`/`DB_PASS`/`DB_NAME` (MySQL/Sequelize) are legacy and
  **not actually connected** by `server.js` — only `MONGODB_URI` matters. You
  can skip setting the MySQL vars entirely.
- Free tier Render web services spin down when idle and cold-start slowly —
  fine for a thesis demo, just don't be surprised by the first request after
  a period of inactivity taking ~30s.
