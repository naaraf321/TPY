# The Pussy Is Yours — Deployment & Two-Account Test

## Environment

- Copy `.env.example` to `.env.local`.
- Add your Supabase **publishable** key. Never use service-role keys in `NEXT_PUBLIC_*` variables.
- Set `NEXT_PUBLIC_SITE_URL=https://thepussyisyours.com` only when the domain is deployed on HTTPS.
- Update Google and Facebook consent branding, Supabase Auth URL configuration and authorized redirect URLs to include `/auth/callback` on the live domain.
- Install dependencies using `npm install`. Then run `npm run typecheck`, `npm run build`, `npm run dev`. This release has not completed a full npm build in the authoring environment because the registry could not be reached.

## Supabase integration

The connected Supabase project `xllsgkdixmcgqenlinwh` received additive tables for stories, follows, bookmarks, user settings, moderation requests, private messaging preferences, starred messages, public profile media, and an authenticated unfriend RPC. No user data or posts were deleted in this release.

The earlier `004_premium_release.sql` is a reproducible baseline for environments that have only the original `tgy_*` database. On the connected project, **do not blindly rerun it**; many definitions already exist. The new `005_notification_preferences_optional.sql` was **not applied automatically**. Review it before execution. Until installed, notification preference toggles do not suppress server-created notifications, and follows do not generate server-side alerts.

Known production gaps: full WebRTC calling intentionally excluded; true end-to-end encryption not provided; background notifications require a push service; account deletion requests are not automatic; media expiry needs a scheduled cleanup; avatar/cover photos are publicly readable; large-media processing and content moderation enforcement need operational services; privilege audits and rate-limiting still need review. Supabase security advisor flags authenticated SECURITY DEFINER RPC functions and leaked-password protection being disabled. See https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Functional two-user test

1. On two independent browsers/devices, grant location and sign in with different Google/Facebook accounts.
2. Create a public identity on each account; upload a profile image and cover; test privacy/onboarding and `@username` deep links.
3. Test Streets map, public approximation and hide location. Confirm distinct accounts remain distinct when in the same building.
4. Send, accept, decline and remove friend requests; follow and unfollow another person.
5. Create Public, Friends and Only Me posts; verify each is visible only to the intended audience. Test photo/video uploads, reactions, comments, shared HTTPS links and saved posts.
6. Create a 24-hour story and test visibility from the other account.
7. Send a message, image, document and voice note. Verify chat receipts, message starring and muted/pinned settings. Check behavior after reload and on mobile.
8. Verify notification delivery for new messages, friend requests, reactions, comments and profile visits. Old activity doesn't create retroactive notifications.
9. Verify report/block controls, moderation permissions, signed image URLs, deletion request, device layouts and keyboard navigation.
10. Deploy to a staging HTTPS domain before public launch. Verify production build, map tile rate limits, DNS, OAuth redirects, TLS, sitemap, Open Graph, backups, alerting, abuse prevention and legal/privacy disclosures.

Do not replace all old Supabase tables or overwrite environment secrets.
