# Isolated preview preparation

This preview requires a separate Supabase project and a Vercel preview deployment whose environment variables point only to that project. Do not reuse the existing hosted database, authentication users, class roster, or production secrets.

1. Create a disposable Supabase project, apply the repository migrations in order, and configure its Auth redirect URLs for the preview URL. Verify the project reference before any database operation.
2. Configure the Vercel **Preview** environment with this project's URL and keys, the preview site URL, and independently generated server secrets. Do not expose service-role keys or server secrets in browser variables or commit them.
3. Populate only synthetic test accounts and roster data through an explicitly reviewed isolated-preview procedure. The existing fixture loader is restricted to local databases; do not bypass its safeguard. A complete playable bank requires academically reviewed Published questions or a separately approved, clearly labelled synthetic test bank. Never publish AI drafts as reviewed content.
4. Verify sign-in, roster, Passport progress and conflict handling, both games, separate leaderboards, projection, and Realtime using the isolated project. Confirm Vercel preview, Supabase Auth, RLS, Realtime limits and CDN behavior separately from local/CI results.

Until separate project access and a safe preview-data procedure exist, full hosted preview is blocked. Keep PR #7 draft; this preparation does not authorize production deployment or a merge.
