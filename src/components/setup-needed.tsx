// Тохиргоо дутуу үед (Supabase түлхүүр эсвэл хүснэгт алга) алдааны оронд харуулах заавар.
// Сервер, клиент хоёуланд ажиллана (hook ашиглаагүй).

const STEPS = {
  env: {
    title: 'Supabase-ийн түлхүүр тохируулаагүй байна',
    lead: 'Апп ажиллахын тулд .env.local файлд Supabase-ийн 3 түлхүүр хэрэгтэй.',
    steps: [
      <>Төслийн хавтсанд <code>.env.example</code>-ийг <code>.env.local</code> нэрээр хуулна.</>,
      <>supabase.com → төсөл → <b>Project Settings → API Keys</b> хэсгээс <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>, <code>SUPABASE_SECRET_KEY</code>-ийг хуулна.</>,
      <>Dev серверээ зогсоогоод (<code>Ctrl+C</code>) <code>npm run dev</code>-ээр дахин эхлүүлнэ.</>,
    ],
  },
  db: {
    title: 'Өгөгдлийн сангийн хүснэгтүүд үүсээгүй байна',
    lead: 'Supabase холбогдсон ч хүснэгт, багана дутуу байна. Шинэ төсөл бол supabase/setup.sql, өмнө нь setup.sql ажиллуулсан бол зөвхөн шинэ migration-ийг ажиллуулна.',
    steps: [
      <>supabase.com → төсөл → <b>SQL Editor → New query</b> нээнэ.</>,
      <>Шинэ төсөл: <code>supabase/setup.sql</code>. Хуучин төсөл: <code>supabase/migrations/0006_personal.sql</code>. Файлын <b>бүх</b> агуулгыг хуулж буулгаад <b>Run</b> дарна.</>,
      <>&quot;Success&quot; гарсны дараа энэ хуудсыг дахин ачаална (F5).</>,
    ],
  },
} as const;

export function SetupNeeded({ kind, detail }: { kind: keyof typeof STEPS; detail?: string }) {
  const s = STEPS[kind];
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-8">
      <div className="card-x w-full max-w-[560px]">
        <div className="text-4xl">🛠️</div>
        <h1 className="mt-2 mb-1 text-xl font-bold">{s.title}</h1>
        <p className="mb-3 text-muted-foreground">{s.lead}</p>
        <ol className="list-decimal space-y-2 pl-5 [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:text-[.85em]">
          {s.steps.map((step, i) => <li key={i}>{step}</li>)}
        </ol>
        {detail && <p className="mt-4 text-xs break-words text-muted-foreground">Дэлгэрэнгүй: {detail}</p>}
        <p className="mt-4 text-xs text-muted-foreground">Бүрэн зааврыг README.md-ийн «Ажиллуулах» хэсгээс харна уу.</p>
      </div>
    </div>
  );
}
