# Copy/paste installation — The Pussy Is Yours

**Recommended:** use the complete unified ZIP in a new folder so source versions are not mixed.

If you must paste individual source files, copy the entire text into the exact matching project paths:

1. `components/SocialApp.tsx` — navigation and integration of all five screens
2. `components/FriendsDashboard.tsx` — friends/requests/suggestions
3. `components/ExploreDashboard.tsx` — map/discovery/filters
4. `components/ProfileDashboard.tsx` — public and own profile
5. `components/ProfileAvatar.tsx` — profile image renderer
6. `components/ChatPanel.tsx` — real conversations
7. `components/FeedPanel.tsx` — posts, reactions, media and privacy
8. `components/StoriesStrip.tsx` — 24-hour stories
9. `components/HomeDashboard.tsx` — 3-column home dashboard
10. `lib/types.ts` — shared models
11. `lib/presence.ts` — realtime presence room
12. `app/globals.css` — complete unified style sheet

**Retain and keep consistent** the included unmodified project files (`components/StreetMap.tsx`, `components/NotificationCenter.tsx`, `lib/supabase.ts`, `lib/media.ts`, `package.json`, `app/*`, etc.). Do not mix previous Beta files with this release.

Use the existing `.env.local` with correct Supabase public credentials and `NEXT_PUBLIC_SITE_URL=https://thepussyisyours.com` only once the live HTTPS domain is ready. Google and Facebook Auth provider callback settings must also be updated for the deployed domain.

The 9 new `tpy_*` tables have been added to the existing connected Supabase project. See deployment checklist for the optional **not yet installed** notification preferences trigger migration.
