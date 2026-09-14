import { redirect } from 'next/navigation';

// Explore is hidden for now (2026-07-20) — the implementation is preserved in
// ./_disabled_page.tsx (not routable); restore by moving it back over this file
// and re-adding the nav item in app/(student)/layout.tsx.
export default function ExploreDisabled() {
  redirect('/dashboard');
}
