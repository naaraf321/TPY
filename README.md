# The Pussy Is Yours — Unified Social Dashboard

A cohesive Next.js 15/React/TypeScript social-network beta, using the five user-approved mockups as **visual references** for Home, Friends, Explore, Messages and Profile. Black/magenta premium branding, mobile-first responsive layouts, real Supabase user records, and no voice/video calling controls.

## Pages

- **Home** — stories, real posts, public map preview, real member recommendations and direct chat previews.
- **Friends** — requests, accept/decline, friends search, suggested accounts, follow/unfollow, profile navigation, and direct chat links.
- **Explore** — real street map, approximate public pins, live presence, distance filter, online/recent/trending/interest filters, real suggestions.
- **Messages** — direct chat, text, media and voice notes, receipts, message starring, notification muting, pinning, search and mobile layout. No audio/video calling.
- **Profile** — personal cover and avatar uploads, edit name/handle/bio/interests, public posts, visible media, 24-hour stories, follower stats, follow/friend/message actions, saved posts, block/report.
- **Notifications / Settings / Admin** — existing realtime notifications, personal account settings and RLS-protected moderation UI.

No synthetic social users, posts, likes, counts, stories, or messages are inserted. The mockups contain illustrative people; the app shows only data the actual members provide.

## Run

1. Extract this project into a new folder instead of copying isolated files from incompatible releases.
2. Copy `.env.example` to `.env.local`, fill in your Supabase **publishable** key, and keep `.env.local` out of Git.
3. `npm install`
4. `npm run typecheck`
5. `npm run build`
6. `npm run dev`

The author's environment cannot access the npm registry, so these npm commands were **not successfully run here**. The source passed TypeScript syntax parsing (39 files), local-import resolution, and ZIP integrity checks. This does **not** establish production readiness.

## Backend

The connected Supabase project `xllsgkdixmcgqenlinwh` has received additive migrations for the unified interface (9 new `tpy_*` tables, profile-media storage, stories storage, follows/bookmarks/preferences, chat settings/starred messages, moderation and a secure unfriend function). Existing `tgy_*` data was left intact during this release.

- The included `supabase/004_premium_release.sql` is the earlier baseline reference; **do not rerun it blindly** on this project because much of it is already deployed.
- `supabase/005_notification_preferences_optional.sql` remains **undeployed**: applying it after review is required for stored notification preferences to suppress server-generated events and for new-follower alerts.
- An administrator must separately review site safety, the RLS policies, user deletion process, media-cleanup scheduling, public domain configuration, background push notifications, map tile provider limits, and applicable privacy requirements.
- Existing message storage does not provide end-to-end encryption.

See `DEPLOYMENT-CHECKLIST.md` for exact setup and manual two-account verification instructions.
