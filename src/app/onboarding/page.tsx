import { Suspense } from 'react';
import { SetupNeeded } from '@/components/setup-needed';
import { getProfile, requireUser, SetupError } from '@/lib/server/dal';
import { HobbyPicker } from './hobby-picker';

export default function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  return (
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-4xl">🌙</div>}>
      <Onboarding searchParams={searchParams} />
    </Suspense>
  );
}

async function Onboarding({ searchParams }: { searchParams: PageProps<'/onboarding'>['searchParams'] }) {
  let res;
  try {
    res = await Promise.all([searchParams, getProfile(), requireUser()]);
  } catch (e) {
    if (e instanceof SetupError) return <SetupNeeded kind="db" detail={e.message} />;
    throw e;
  }
  const [{ edit }, profile, { supabase }] = res;
  const { count } = await supabase.from('mood_entries').select('id', { count: 'exact', head: true });
  return <HobbyPicker initial={profile.hobbies} initialTheme={profile.theme} editing={edit === '1'} canSeed={!count} />;
}
