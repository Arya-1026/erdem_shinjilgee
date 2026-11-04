import { Suspense } from 'react';
import { AppShell } from '@/components/app-shell';
import { AppProvider } from '@/components/providers/app-provider';
import { PlayerProvider } from '@/components/providers/player-provider';
import { SetupNeeded } from '@/components/setup-needed';
import { getAppData, SetupError, type AppData as Data } from '@/lib/server/dal';

// Session уншдаг хэсэг <Suspense> дотор байна (Cache Components-ийн шаардлага).
// Хэрэглэгчийн өгөгдлийг нэг удаа ачаалж, хуудас хооронд шилжихэд дахин татахгүй.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<Splash />}>
      <AppData>{children}</AppData>
    </Suspense>
  );
}

async function AppData({ children }: { children: React.ReactNode }) {
  let data: Data;
  try {
    data = await getAppData();
  } catch (e) {
    // supabase/setup.sql ажиллуулаагүй бол алдааны оронд заавар харуулна (redirect() зэрэг бусдыг дамжуулна)
    if (e instanceof SetupError) return <SetupNeeded kind="db" detail={e.message} />;
    throw e;
  }
  return (
    <AppProvider initial={data}>
      <PlayerProvider>
        <AppShell>{children}</AppShell>
      </PlayerProvider>
    </AppProvider>
  );
}

function Splash() {
  return <div className="grid min-h-dvh place-items-center text-5xl" aria-label="Ачаалж байна">🌙</div>;
}
