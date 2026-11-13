# Deploying a client (GitHub + Vercel)

One GitHub repo = the template. One Vercel project per client, all pointing at that repo. Each client differs only by
environment variables and a domain, so you never edit code per client.

## One-time setup
1. `git init && git add . && git commit -m "template" && git branch -M main`
2. Create an empty **private** repo on GitHub, then `git remote add origin <url> && git push -u origin main`.
   (`.gitignore` already keeps `node_modules`, `dist` and any `.env` files out.)

## For every client
1. **Deriv app**: create the client's app at Deriv's developer dashboard and copy its App ID.
   Add the client's final domain (e.g. `https://app.clientdomain.com`) as an allowed redirect URL on that app,
   otherwise login will bounce back with an error. (The app sends users back to the site's own address.)
2. **Vercel** > Add New > Project > import the repo. Framework: leave as detected (`vercel.json` already sets the
   build command `npm run build` and output folder `dist`, and the single-page-app rewrite).
3. **Settings > Environment Variables** (Production): add at least
   - `NEXT_PUBLIC_DERIV_APP_ID` = the client's App ID
   - `NEXT_PUBLIC_DERIV_APP_NAME` = the client's app name
   - `NEXT_PUBLIC_DERIV_ENV` = `production`
   - `NEXT_PUBLIC_DERIV_REFERRAL_LINK` = your referral link (optional)
   Optional branding: logo, colours, tagline, Telegram / WhatsApp / TikTok links. The full list with comments is in `.env.example`.
4. **Deploy.** Variables are baked in at build time, so after changing any variable use Deployments > Redeploy.
5. **Domain**: Settings > Domains > add the client's domain, then set the DNS record Vercel shows
   (CNAME for a subdomain, A record for the root domain). HTTPS is automatic.
6. Logo: replace `public/logo.svg` in the repo (same file for all clients) or set `NEXT_PUBLIC_LOGO_URL` to a hosted image per client.

Without the variables the app still builds, but login is disabled (no App ID) and it shows the default name.

## Notes
- The app uses `#` links (`/#free_bots`), so no extra routing setup is needed for deep links.
- Updating every client: push to `main`; every Vercel project built from that repo redeploys itself.
- A "full ownership" client: give them their own copy of the repo (fork or transfer) and their own Vercel project; they then no longer get your updates.
- Verified in a test build: name, tagline, tab colour, social icons (including hiding one) and the App ID in the Deriv login URL all follow the variables.

## Running locally (`npm run dev`)
`.env.production` holds this project's values (App ID, name, referral link, `NEXT_PUBLIC_DERIV_ENV=production`) and is read by both
`npm run dev` and `npm run build`, so nothing else is needed. For a new client either edit that file or set the same names in Vercel
(Vercel's variables win over the file). `.env.example` lists every optional variable. Use `.env` / `.env.local` for private overrides; they are git-ignored.
Without `NEXT_PUBLIC_DERIV_ENV=production` the app talks to Deriv's staging server and hangs on "Initializing Deriv Bot account...".
