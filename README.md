# 🌙 Сэтгэл: Mood Tracker

Өдөр бүрийн сэтгэл санааг бүртгэж, хэв маягийг харуулдаг вэб апп. Хобби, сэтгэл хөдлөлд тохирсон зөвлөмж, **хүн бүрт тусдаа сонгосон дуу** (YouTube, хүсвэл Spotify), AI туслах, сэтгэл зүйчийн захиалга санал болгоно.
Анхны прототип (нэг HTML файл) нь [legacy/index.html](legacy/index.html)-д хадгалагдсан.

## Архитектур

Нэг хүн, нэг repo, нэг хэл (TypeScript), үнэгүй хостинг.

```
Браузер (Next.js React, PWA)
  │  supabase-js (RLS)  ─────────────►  Supabase PostgreSQL + Auth
  │  YouTube / Spotify тоглуулагч       ▲        │ pg_cron (5 мин)
  │  fetch /api/*                        │        ▼ pg_net
  ▼                                      │   /api/cron/reminders → Resend имэйл + Web Push
Next.js Route Handlers (Vercel) ─────────┘
  ├─ /api/chat         түлхүүр үг + OpenAI Moderation → Groq gpt-oss-20b → OpenRouter → дүрэмд суурилсан хариулт
  ├─ /api/music/recs   хэрэглэгчийн амт → Groq-оор дуу санал болгох → YouTube хайлт (cache)
  ├─ /api/youtube/*    OAuth, playlist/like татах → Groq: дуу мөн эсэх + mood ангилах
  ├─ /api/spotify/*    (заавал биш) OAuth, playlist татах → mood ангилах
  ├─ /api/bookings     хуваарь шалгах + давхар захиалгаас хамгаалах + Resend
  ├─ /api/push/test    туршилтын push
  └─ /api/account      бүртгэл устгах
```

| Давхарга | Технологи | Файл |
|---|---|---|
| Frontend | Next.js 16 (App Router, Cache Components) + TypeScript | `src/app` |
| UI | Tailwind CSS 4 + shadcn/ui (Base UI) | `src/components/ui`, `src/app/globals.css` |
| Backend | Next.js Route Handlers | `src/app/api` |
| Өгөгдлийн сан | Supabase PostgreSQL + RLS | `supabase/migrations/` |
| Нэвтрэлт | Supabase Auth (имэйл, Google) | `src/app/login`, `src/app/auth/callback`, `src/proxy.ts` |
| Сануулга | pg_cron + pg_net → имэйл + Web Push | `supabase/migrations/0002_cron.sql`, `public/sw.js` |
| LLM | Groq `openai/gpt-oss-20b`, нөөц нь OpenRouter | `src/lib/server/llm.ts` |
| Crisis | Түлхүүр үг + OpenAI Moderation | `src/lib/crisis.ts`, `src/lib/server/moderation.ts` |
| Хөгжим | YouTube Data API + IFrame Player (үндсэн), Spotify Web API (заавал биш) | `src/lib/server/youtube.ts`, `src/lib/server/music-recs.ts`, `src/lib/server/spotify.ts` |
| График | Recharts | `src/components/charts.tsx` |
| Имэйл | Resend | `src/lib/server/email.ts` |
| Design system | «Emotion tracker»: Nunito фонт, дулаан суурь өнгө, emotion-* өнгө, 5 палитр (анх орохдоо сонгоно) | `src/app/globals.css`, `src/lib/palettes.ts` |
| Өдрийн дэмжлэг | Өнөөдрийн бүртгэлээс LLM дэмжлэгийн үг + 3 алхам гаргана, өдөрт нэг хадгална | `src/app/api/support`, `src/lib/support.ts` |
| Тест | Vitest | `src/**/*.test.ts` |
| Хостинг | Vercel | |

### Хөгжим: хүн бүрт өөр өөр дуу

**1. Танд зориулсан дуунууд** (бүх хэрэглэгчид, YouTube холбоогүй ч ажиллана): `/api/music/recs?mood=sad`
- Хэрэглэгчийн амтыг цуглуулна: сангаас нь хамгийн их сонсдог уран бүтээлчид, хобби, 👍/👎 дарсан дуунууд, өмнө санал болгосон дуунууд.
- Groq-оос "энэ хүн одоо гунигтай байна, ийм уран бүтээлчдийг сонсдог..." гэх мэт мэдээлэлд тулгуурлан 10 дуу санал болгуулна. Хоёр өөр хүнд хоёр өөр жагсаалт гарна.
- Дуу бүрийг YouTube дээр хайж, апп дотор тоглуулж болох бичлэгийг сонгоно (`videoEmbeddable`).
- `search.list` өдөрт 100 удаагийн хязгаартай. Тиймээс олдсон бичлэгийг `song_cache`-д хадгалж бүх хэрэглэгч хуваалцана. Нэг хүний mood тус бүрийн жагсаалт 7 хоног хадгалагдана. "↻ Шинэ дуунууд" товчоор шинэчилнэ.

**1б. Тайвшруулах ая** (`/api/music/recs?mood=anxious&kind=ambient`): үггүй хөгжим, байгалийн дуу, морин хуур, lo-fi. LLM тухайн mood, хобби, өнөөдрийн шалтгаанаас хамаарч сонгоно. 3 цаг хүртэлх бичлэг зөвшөөрнө.

- **Монгол дуу**: жагсаалтын тал нь `src/lib/mn-songs.ts` дахь шалгасан монгол дуу. LLM монгол дууны нэрийг зохиож хэлдэг, YouTube-ийн Music ангилалд ч ихэнх нь ордоггүй тул video_id-тай гараар жагсаасан (хайлтын квот зарцуулахгүй). Монгол дуугүй хуучин жагсаалт автоматаар шинэчлэгдэнэ.

**2. Миний сан** (YouTube эсвэл Spotify-аа холбосон үед)
- **YouTube**: like дарсан бичлэг болон өөрийн playlist-үүдийг татна (600 хүртэл). Groq эхлээд бичлэг бүр **дуу мөн эсэхийг** тодорхойлж vlog, podcast-ийг хасна. Дараа нь уран бүтээлч, дууны нэр, тохирох mood-ийг гаргана. Үр дүн `video_info`-д cache хийгдэнэ.
- **Spotify**: liked songs болон өөрийн playlist-үүдийг татна. Spotify 2024.11-ээс `audio-features`-ийг хаасан тул нэр, уран бүтээлчээр нь LLM ангилна.
- OAuth token-ууд AES-256-GCM-ээр шифрлэгдэж, RLS policy-гүй хүснэгтэд хадгалагдана. Тиймээс зөвхөн сервер уншина.

**3. Тоглуулах**
- **YouTube**: IFrame Player-ээр үнэгүй, бүтэн дуу тоглуулна. YouTube-ийн дүрмээр тоглуулагч **харагдаж байх ёстой** (≥200×200px, дээр нь юу ч давхарлахгүй). Тиймээс доод хэсэгт видеотой "dock" гарч, удирдлагын товчнууд нь видеоны доор байрлана.
- **Spotify**: Premium бол Web Playback SDK, бусад үед Embed-ээр тоглуулна. Апп эзэмшигч Premium байх ёстой.
- Хөгжмийн эх үүсвэр тохируулаагүй бол mood-ийн аялгууг браузер дээр үүсгэж тоглуулна (демо).

### Дуу сонгох зарчим

Дуу нь зөвхөн AI-ийн санал: анхдагч жагсаалт байхгүй. Нас, дуртай дуучин, төрөл, 👍/👎, тухайн mood-оос хамаарна. 👍 дарсан дуу `liked_songs`-д хадгалагдаж «Таалагдсан дуунууд»-д гарна.

- **Монгол дуу**: сонгосон дуучид болон нас, төрөлд тохирох дуучдыг (`src/lib/artists.ts`) YouTube-ээс хайж, LLM дуу мөн эсэх, mood-ийг ангилна. Хайлт 30 хоног cache-д хадгалагдаж, нэг хүсэлтэд дээд тал нь 3 шинэ хайлт хийнэ. AI эдгээр бодит бичлэгээс сонгодог тул дууны нэр зохиож чадахгүй.
- **Уурласан, түгшсэн үед** метал, хатуу дуу санал болгохгүй, хэрэглэгч метал сонгосон ч гэсэн. Судалгаагаар түгшүүрт удаан (60-80 bpm) хөгжим тусалдаг, түрэмгий төрөл сонгосон хүмүүст түгшүүр буурах нь бага байсан. Метал нь зөвхөн баяртай, энгийн mood-д гарна.
- Зарим бичлэг API-д embeddable гэсэн ч тоглуулагч дээр 150 алдаа өгдөг: тоглуулагч алгасаж дараагийнх руу шилжинэ.

### Төлөвлөгөө

`/todo`: ажлаа бичихэд AI ажлын жагсаалт болгож, `src/lib/todo-plan.ts` гарагийн дундаж сэтгэл санаа, эрч хүч, тухайн гарагт дуусгасан ажлын түүхээр хамгийн тохирох өдрийг сонгоно. Огноог алгоритм шийддэг (хугацаа, өдрийн ачаалал хэтрэхгүй), LLM зөвхөн тайлбарыг бичнэ. Сул өдөр ажил их бол урьдчилан анхааруулж, дасгал, сэтгэл зүйч санал болгоно.

### 3D дасгал

Биеэр хийдэг дасгалууд (амьсгал, алхалт, сунгалт, булчин суллах, энергитэй дасгал) three.js дээрх хүний загвартай хамт алхам алхмаар явна. Загвар нь кодоор үүссэн тул гадны модель файл хэрэггүй. Хөдөлгөөн бүр нь `src/lib/exercise-moves.ts` дахь цэвэр функц (`ANIMS`), алхмууд нь `EXERCISE_MOVES`. three.js нь зөвхөн дасгал нээхэд ачаалагдана. WebGL байхгүй бол цаг, заавар нь загваргүйгээр ажиллана.

### Кодын бүтэц

```
src/
  app/
    (app)/            нэвтэрсэн хэрэглэгчийн хуудсууд: home, chat, recs, stats, experts, profile
    expert/           сэтгэл зүйчийн портал (захиалга, уулзалтын холбоос, үйлчлүүлэгчийн тайлан)
    login/, onboarding/, auth/callback/
    api/              Route Handlers
    manifest.ts       PWA
  components/
    providers/        AppProvider (өгөгдөл + үйлдлүүд), PlayerProvider (демо / YouTube / Spotify)
    music.tsx         Танд зориулсан дуунууд, Миний сан
    dialogs/          бүртгэгдлээ, дасгал, амьсгал, кино, цаг захиалах цонхнууд
    ui/               shadcn компонентууд
  lib/
    analytics.ts      гаригийн дундаж, streak, таамаглал, ажиглалт
    music-suggest.ts  хүн бүрт дуу санал болгох prompt, задлагч
    mood-classify.ts  дуу/бичлэгийг mood-оор ангилах
    youtube-*.ts, spotify-*.ts  API-ийн хариу задлах, тоглуулагч
    push-client.ts    Web Push бүртгэл
    server/           зөвхөн сервер: DAL, LLM, YouTube, Spotify, push, имэйл, шифрлэлт
  proxy.ts            session шинэчлэх, нэвтрээгүй бол /login руу шилжүүлэх
supabase/
  migrations/         0001 үндсэн, 0002 cron, 0003 сэтгэл зүйч + push + Spotify, 0004 YouTube + дууны санал, 0005 өнгө + ая + өдрийн дэмжлэг, 0006 нас + дуртай дуучид + todo, 0007 Data API эрх, 0008 төлөвлөгөөний цаг + эможи
  setup.sql           0002-оос бусад бүх migration-ийг нэгтгэсэн файл (npm run db:bundle)
public/sw.js          push мэдэгдлийн service worker
```

## Ажиллуулах

> **Анхаар:** Апп-ыг локалд үргэлж **http://127.0.0.1:3000** хаягаар нээнэ (`localhost` биш). Spotify `localhost`-ийг зөвшөөрдөггүй, мөн session cookie хаяг бүрт тусдаа хадгалагддаг.

### 1. Supabase

1. [supabase.com](https://supabase.com) дээр үнэгүй төсөл үүсгэнэ.
2. **SQL Editor → New query** нээж, [supabase/setup.sql](supabase/setup.sql)-ийн бүх агуулгыг хуулж **Run** дарна. Энэ нь бүх хүснэгт, RLS, функцийг нэг дор үүсгэнэ.
3. **Authentication → URL Configuration**:
   - Site URL: `http://127.0.0.1:3000`
   - Redirect URLs: `http://127.0.0.1:3000/auth/callback`, `https://<таны-апп>.vercel.app/auth/callback`
4. **Нууц үгээ мартсан**: анхдагч байдлаар имэйлээр холбоос ирнэ (`/auth/callback` → `/reset-password`). Нэмэлт тохиргоо шаардлагагүй.
   Холбоосын оронд **код** илгээх бол эхлээд **Authentication → Emails → SMTP Settings**-д Resend (эсвэл Gmail SMTP) тохируулна. Supabase загвар засахыг зөвхөн өөрийн SMTP-тэй үед зөвшөөрдөг. Дараа нь **Templates → Reset password**-д кодыг нэмнэ:
   ```html
   <h2>Нууц үг сэргээх</h2>
   <p>Таны баталгаажуулах код: <b>{{ .Token }}</b></p>
   <p>Эсвэл <a href="{{ .ConfirmationURL }}">энд дарж</a> сэргээнэ.</p>
   ```
   Supabase-ийн үндсэн имэйл сервер цагт хэдхэн имэйл, зөвхөн төслийн гишүүдийн хаяг руу илгээдэг. Жинхэнэ хэрэглэгчидтэй болбол SMTP заавал хэрэгтэй.

### 2. YouTube (хувийн Gmail-ээр, үнэгүй)

Сургуулийн Google бүртгэлийг админ хаасан байж магадгүй тул **хувийн Gmail** ашиглана.

1. [console.cloud.google.com](https://console.cloud.google.com) → шинэ төсөл үүсгэнэ.
2. **APIs & Services → Library** → **YouTube Data API v3** → **Enable**.
3. **Credentials → Create credentials → API key**. Гарсан түлхүүрийг `YOUTUBE_API_KEY`-д хуулна. Үүгээр "Танд зориулсан дуунууд" ажиллана.
4. *(Өөрийн YouTube playlist холбох бол)* **OAuth consent screen** (Google Auth Platform):
   - User type: **External**, апп-ын нэр: Сэтгэл
   - Data access → Add scope: `.../auth/youtube.readonly`
   - **Audience → Test users**: апп-ыг ашиглах хүмүүсийн Gmail-ийг нэмнэ (100 хүртэл)
5. **Credentials → Create credentials → OAuth client ID** → Application type: **Web application**
   - Authorized redirect URI: `http://127.0.0.1:3000/api/youtube/callback`
   - Client ID-г `GOOGLE_CLIENT_ID`-д, Client secret-ийг `GOOGLE_CLIENT_SECRET`-д хуулна.

> Туршилтын (Testing) горимд Google-ийн зөвшөөрөл 7 хоногийн дараа дуусдаг. Хэрэглэгч YouTube-ээ дахин холбох шаардлагатай болно. Апп үүнийг автоматаар илрүүлж "дахин холбоно уу" гэж мэдэгдэнэ.

### 3. Spotify (заавал биш)

Апп эзэмшигч **Spotify Premium** байх ёстой (2026 оны дүрэм).
1. [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → **Create app** дарна. Redirect URI нь `http://127.0.0.1:3000/api/spotify/callback`, APIs-д **Web API**, **Web Playback SDK** сонгоно.
2. Client ID, secret-ээ `.env.local`-д хуулна. **User Management**-д хэрэглэгчдийг нэмнэ (5 хүртэл).

### 4. Орчны хувьсагч

```bash
cp .env.example .env.local
npm run keys            # TOKEN_ENCRYPTION_KEY, CRON_SECRET, VAPID түлхүүрүүдийг үүсгэнэ → .env.local-д хуулна
```

| Хувьсагч | Байхгүй бол |
|---|---|
| Supabase-ийн 3 түлхүүр | **Апп ажиллахгүй** |
| `GROQ_API_KEY` | Чат дүрэмд суурилна. Дууны санал хүн бүрт адилхан, ангилал түлхүүр үгээр явагдана |
| `YOUTUBE_API_KEY` | "Танд зориулсан дуунууд" хэсэг харагдахгүй |
| `GOOGLE_CLIENT_*` | "YouTube холбох" харагдахгүй |
| `SPOTIFY_*` | "Spotify холбох" харагдахгүй |
| `OPENAI_API_KEY` | Crisis-ийг зөвхөн түлхүүр үгээр шүүнэ |
| `RESEND_API_KEY` | Имэйлийг зөвхөн server log-д бичнэ |
| `*VAPID*` | Push мэдэгдлийн тохиргоо харагдахгүй |

### 5. Эхлүүлэх

```bash
npm install
npm run dev             # http://127.0.0.1:3000
npm test                # unit тест
```

### 6. Deploy (Vercel)

1. GitHub руу push хийгээд Vercel дээр import хийнэ.
2. `.env.local`-ийн утгуудыг Vercel → Settings → Environment Variables-д хуулна. `NEXT_PUBLIC_APP_URL`-ийг Vercel хаягаар солино.
3. Supabase URL Configuration, Google OAuth client, Spotify Dashboard-д Vercel хаягийг нэмнэ.
4. **Сануулга**: Supabase SQL Editor дээр:
   ```sql
   select vault.create_secret('https://<таны-апп>.vercel.app', 'app_url');
   select vault.create_secret('<CRON_SECRET-ийн утга>', 'cron_secret');
   ```
   Үүний дараа `0002_cron.sql`, `0010_purge_cron.sql`-ийг ажиллуулна. Сүүлийнх нь устгах хүсэлт гаргаад 30 хоног нэвтрээгүй бүртгэлийг өдөр бүр бүрмөсөн устгана.

### Сэтгэл зүйчийн эрх олгох

Сэтгэл зүйч эхлээд апп-д энгийн хэрэглэгчээр бүртгүүлнэ. Дараа нь админ SQL Editor дээр түүний бүртгэлийг холбоно:

```sql
update experts set user_id = (select id from auth.users where email = 'psychologist@example.com') where id = 'p1';
```

Ингэсний дараа тухайн хүн `/expert` портал руу орж захиалгуудаа харна. Уулзалтын (Google Meet, Zoom) холбоос оруулж, үйлчлүүлэгч зөвшөөрсөн бол 30 хоногийн mood тайланг нь харна. Хувийн тэмдэглэл хуваалцагдахгүй.
Шинэ сэтгэл зүйч, цагийн хуваарийг `experts`, `expert_slots` хүснэгтэд нэмнэ.

### Сануулга

Локал болон өөрийн сервер дээр `src/instrumentation.ts` сануулгыг 5 минут тутамд шалгана (`CRON_SECRET` хэрэгтэй, dev серверийг дахин асаасны дараа ажиллана). Supabase-ийн pg_cron нь localhost руу хандаж чадахгүй тул зөвхөн Vercel-д `0002_cron.sql` хэрэгтэй. Апп нээлттэй үед браузер өөрөө мөн сануулна.

### Түгээмэл алдаа

| Алдаа | Шалтгаан, засах арга |
|---|---|
| «Supabase-ийн түлхүүр тохируулаагүй байна» дэлгэц (`/setup`) | `.env.local`-д Supabase-ийн 3 түлхүүр алга. Бөглөөд `npm run dev`-ийг дахин эхлүүлнэ. |
| «Өгөгдлийн сангийн хүснэгтүүд үүсээгүй байна» (`Could not find the table 'public.profiles'`) | Supabase SQL Editor дээр `supabase/setup.sql`-ийг бүтнээр нь ажиллуулаагүй. |
| `Route "/home": Next.js encountered the unstable value Date.now()` | Засагдсан: `getAppData()` дотор `connection()` дуудаж байна. Хуучин `.next` хавтас үлдсэн бол устгаад дахин эхлүүлнэ. |
| `permission denied for table ...` | Шинэ Supabase төсөл хүснэгтэд эрх автоматаар олгодоггүй. [0007_grants.sql](supabase/migrations/0007_grants.sql)-ийг SQL Editor дээр ажиллуулна. |
| Spotify/YouTube холбоход `wrong-host` | Апп-ыг `localhost` биш `http://127.0.0.1:3000` хаягаар нээнэ. |

## Аюулгүй байдал

- Хүснэгт бүр дээр **RLS** асаалттай. Хэрэглэгч зөвхөн өөрийн мөрийг уншиж, бичнэ.
- Сэтгэл зүйч бусдын өгөгдлийг зөвхөн `security definer` функцээр, өөрт нь хийгдсэн захиалга болон үйлчлүүлэгч зөвшөөрсөн тохиолдолд л харна.
- YouTube, Spotify-ийн refresh token клиент рүү хэзээ ч гарахгүй. Spotify SDK-д зөвхөн богино хугацаат access token өгнө.
- OAuth `state`-ийг httpOnly cookie-оор шалгаж CSRF-ээс хамгаална.
- Давхар захиалгаас `unique (expert_id, booking_date, slot)` constraint хамгаална.
- Crisis илэрвэл LLM-ийг огт дуудахгүй, 103 / 108 утасны дугаар болон сэтгэл зүйчийн холбоосыг шууд харуулна.
- Гарах үед тухайн төхөөрөмжийн push бүртгэл цуцлагдана.

## Хязгаарлалт

- **YouTube хайлт** өдөрт 100 удаа хийх боломжтой. Нэг хүний нэг mood-ийн шинэ жагсаалт 6 хүртэл хайлт хийнэ, cache-д байгаа дуу хайлт зарцуулахгүй. Олон хэрэглэгчтэй болбол Google-ээс квот нэмүүлэх хүсэлт гаргана.
- **Киноны постер** Wikipedia-гийн сервэрээс шууд ачаалагдана (`src/lib/data.ts`), ачаалагдахгүй бол 🎬 харагдана. Постер нь зохиогчийн эрхтэй тул олон нийтэд гаргахдаа TMDB API-д шилжүүлэх нь зөв.
- **YouTube тоглуулагч** харагдаж байх ёстой тул дэлгэцийн доод хэсгийг эзэлнэ. Зөвхөн дууг нь далд тоглуулах нь YouTube-ийн дүрмээр хориотой.
- **Spotify Development Mode**: 5 хэрэглэгч хүртэл, апп эзэмшигч Premium байх ёстой.
- **Дууны ангилал, санал** нь LLM-ийн таамаг тул 100% нарийвчлалтай биш. 👍/👎 үнэлгээгээр цаг хугацааны явцад сайжирна.
- **iPhone дээр push** авахын тулд Safari-аас "Нүүр дэлгэцэнд нэмэх" хийсэн байх ёстой (iOS 16.4+).
- **Видео/чат уулзалт** апп дотор биш, сэтгэл зүйчийн оруулсан гадны холбоосоор (Meet, Zoom) явагдана.
