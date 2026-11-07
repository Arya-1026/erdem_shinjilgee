import { Suspense } from 'react';
import { SetupNeeded } from '@/components/setup-needed';
import { pickHobbyCats } from '@/lib/custom-hobbies';
import { HOBBIES } from '@/lib/data';
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
  const [{ count }, catsRes] = await Promise.all([
    supabase.from('mood_entries').select('id', { count: 'exact', head: true }),
    // 0025 migration ороогүй бол алдаа буцна: тэр үед ангилалгүй гэж үзнэ
    supabase.from('profiles').select('hobby_cats').eq('id', profile.id).maybeSingle<{ hobby_cats: unknown }>(),
  ]);
  const initialCats = pickHobbyCats(catsRes.data?.hobby_cats, profile.hobbies, Object.keys(HOBBIES));
  return <HobbyPicker initial={profile.hobbies} initialCats={initialCats} initialTheme={profile.theme} initialBirthYear={profile.birth_year} initialArtists={profile.fav_artists} editing={edit === '1'} canSeed={!count} />;
}
