# Moving the website from Vercel to Appwrite Sites

Vercel is paid up to **December 15, 2026**. Everything below can happen before then, and
nothing changes for visitors until the domain is switched (step 5).

## Done

| What | Where it lives now |
|---|---|
| QuickBooks connect + payment notices | `quickbooks-sync` at **https://nss-quickbooks.nyc.appwrite.run** (`GET /callback`, `POST /webhook`). It also accepts the old `/api/quickbooks/*` proxy until that is deleted. |
| Status page data | `service-status` at **https://nss-status.nyc.appwrite.run** (open CORS). The status page reads it first, then the old `/api/status`. |
| The site on Appwrite | Site **`nss-web`** (React, static, `npm ci` → `npm run build` → `./dist`, fallback `index.html`), with the 25 `VITE_*` production variables copied from Vercel. Preview: **https://nextstarsoccer.appwrite.network** (deployed by hand for now; builds in ~3 min). |
| Site videos | Streamed from the Storage **videos** bucket (`src/constants/siteVideos.ts`): web-ready copies `site-hero-1080`, `site-hero-720`, `site-fundamentals`, `coach-<slug>-<n>`. Taken out of `public/`, so a deploy is ~309 MB on Appwrite instead of 1.44 GB. Live on Vercel since Nov 19. |

## Still to do

### 1. QuickBooks (you, in the Intuit developer portal) — any time
In the Intuit app's **production** settings:
- Redirect URI: `https://nss-quickbooks.nyc.appwrite.run/callback`
- Webhook endpoint: `https://nss-quickbooks.nyc.appwrite.run/webhook` (Payment, BillPayment, Purchase)

Then in Appwrite → Functions → `quickbooks-sync` → Variables, add `QUICKBOOKS_CLIENT_ID`,
`QUICKBOOKS_CLIENT_SECRET`, `QUICKBOOKS_WEBHOOK_VERIFIER`, and connect from Coach Payments → Payouts.
These addresses don't depend on where the website is hosted, so this never needs redoing.

### 2. Connect GitHub (you, in the Appwrite console)
Sites → `nss-web` → Settings → Git repository → connect `aglassdev/nextStarSoccerWeb`,
production branch `main`. Pushes to `main` then deploy to Appwrite as they do to Vercel.

### 3. Test on the preview address
Checked Nov 19: every page and deep link loads; the home and coach videos play from Storage;
the preview can reach the Appwrite backend. Still to try there: sign in, pay a bill (Stripe),
admin dashboard, `/status`.

Known differences on Appwrite Sites:
- **App-links file served as `application/octet-stream`** (Vercel: `application/json`).
  There's no setting for it. Apple may accept it; check right after the switch with
  `https://app-site-association.cdn-apple.com/a/v1/www.nextstarsoccer.com` and by opening a
  website link on an iPhone. If links stop opening the app, switch DNS back while it's fixed.
- **No partial file responses**, so videos must stay in Storage (done).
- **Every file is served `max-age=0, must-revalidate`**: repeat visits re-check files instead
  of using cached copies for a day. Slightly slower, nothing breaks.
- Vercel's analytics scripts 404 there; they're removed in step 6.

### 4. DNS: export the records from Vercel (you)
DNS for nextstarsoccer.com is hosted by Vercel (`ns1/ns2.vercel-dns.com`); the domain is
registered at Name.com. The Vercel account on this Mac can't read the records, so export them
from the dashboard of the account that owns the domain. Known records today:

| Name | Type | Value |
|---|---|---|
| `@` | MX | `1 aspmx.l.google.com`, `5 alt1/alt2.aspmx.l.google.com`, `10 alt3/alt4.aspmx.l.google.com` (Google email) |
| `@` | TXT | `google-site-verification=7YbDF8tHOK2PB4XJ7T8s6ZUy4Dnh1dvwSqiwgJBgXzM` |
| `_dmarc` | TXT | `v=DMARC1; p=none;` |
| `@`, `www`, `status` (+ a likely `*` catch-all) | A | Vercel — these become Appwrite |

Copy **every** other record too (DKIM for Amazon SES or Google, anything else), or email breaks.

### 5. Switch the domain (cutover, before Dec 15)
1. In Appwrite: Sites → `nss-web` → Domains → add `nextstarsoccer.com`, `www.nextstarsoccer.com`,
   `status.nextstarsoccer.com` (redirect the bare domain to `www`, as today).
2. Appwrite asks for its nameservers (`ns1.appwrite.zone`, `ns2.appwrite.zone`) for the bare domain.
   Recreate every record from step 4 in Appwrite's DNS first, then change the nameservers at Name.com.
   Propagation can take up to 48 hours; keep Vercel live until it finishes.
3. Check: site, status subdomain, email in and out (Google + support@ through SES), app links.

### 6. Clean up (after the switch)
Delete `api/` and `vercel.json`, remove `@vercel/analytics` and `@vercel/speed-insights`
(imported in `src/App.tsx`), then cancel Vercel Pro. Consider Appwrite's deployment retention
setting (Sites → `nss-web` → Settings): every deploy is ~309 MB of storage, kept 30 days.

## Videos
Until Oct 15–16 the videos streamed from Appwrite Storage and kept stalling (black screen 5–10 s),
so they moved onto the site (commits `eeb727e`, `d0f8a8b`). Those Storage files were the
originals, with the playback index at the end. On Nov 19 the web-ready copies went into Storage
and the site streams them again (`b75ea3a`): no stalls in testing, about 0.45 s to the first
1 MB (Vercel's CDN: ~0.17 s). Appwrite Sites itself can't stream video, so this is required for
the move. If stalls come back, the fix is a video host, not putting them back in `public/`.
