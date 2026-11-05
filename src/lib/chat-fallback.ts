/* ---------- Дүрэмд суурилсан хариулт ----------
   LLM (Groq/OpenRouter) ажиллахгүй үед /api/chat үүнийг ашиглана. */
import { lastMood } from './analytics';
import { translator, type Translate } from './i18n';
import { scoredRecs } from './recs';
import type { ChatMode, Entry, RecType } from './types';

type Ctx = { name: string; hobbies: string[]; entries: Entry[]; feedback: Record<string, number>; mode: ChatMode };

export function fallbackReply(text: string, ctx: Ctx, tr: Translate = translator('mn')) {
  const t = text.toLowerCase(), m = lastMood(ctx.entries), hobby = ctx.hobbies[0];
  const top = (type: RecType) => scoredRecs(m, ctx.hobbies, ctx.feedback).filter(r => r.type === type).slice(0, 3).map(r => `• ${tr(r.title)}: ${tr(r.sub)}`).join('\n');
  if (/найз охин|найз залуу|хайрт|харилцаа|салсан|маргалд|girlfriend|boyfriend|partner|husband|wife|relationship|broke up|argu/.test(t)) return tr('Ойрын хүнтэйгээ харилцаа хүндрэх үнэхээр шаналгаатай. 💜 Ийм үед бодол дахин дахин эргэлдээд, бусад зүйлд анхаарал төвлөрүүлэхэд хэцүү болдог.\n\n• Мессежээр маргалдахын оронд хоёулаа тайван үед ярих цаг товло\n• «Чи үргэлж…» биш «Би … үед … мэдэрсэн» гэж эхэлж хэлээд үз\n• Өнөөдөр өөртөө зориулж 10 минут алх, бодлоо цэгцэл\n\nЯг юу хамгийн их гомдоож байна вэ?\nACTIONS: partner, walk');
  if (/стресс|ажил|хичээл|шалгалт|дарамт|ачаалал|stress|work|job|school|study|exam|overwhelm|pressure/.test(t)) return tr('Ачаалал ихтэй байгааг чинь ойлгож байна. 😔\n\n• Хийх ажлуудаа хамгийн чухал 3 зүйл болгон жагсаа\n• 25 минут ажиллаад 5 минут амар (Pomodoro)\n• Яг одоо 1 минут: 4 секунд амьсгал аваад 6 секунд гарга\n\nЯг юу хамгийн их дарамт болж байна вэ?\nACTIONS: plan, breath');
  if (/нойр|унтаж|унтах|нойргүй|sleep|insomnia/.test(t)) return tr('Нойр сэтгэл санаанд маш их нөлөөлдөг. 🌙\n\n• Унтахаас 1 цагийн өмнө утсаа тавь\n• Өдөр бүр нэг цагт унтаж, нэг цагт бос\n• Оройн цагаар кофе, энергийн ундаа бүү уу\n• Орондоо ороод 4-7-8 амьсгалын дасгал хий\n\nСүүлийн үед дунджаар хэдэн цаг унтаж байна?\nACTIONS: relax, ambient');
  if (/ганцаар|хэн ч|ойлгохгүй|lonely|alone|nobody/.test(t)) return tr('Ганцаардах мэдрэмж үнэхээр хэцүү. Энэ тухай ярьсанд баярлалаа. 💜\n\nӨнөөдөр итгэдэг нэг хүндээ богино мессеж бичээд үзэх үү? Мөн {0} нь шинэ хүмүүстэй танилцах сайн арга.\n\nСүүлд хэнтэй сайхан ярилцсанаа санаж байна уу?\nACTIONS: walk, music', hobby ? tr('«{0}» сонирхогчдын бүлэгт нэгдэх', tr(hobby)) : tr('сонирхлын бүлэгт нэгдэх'));
  if (/уур|бухимд|залхаж|angry|anger|furious|frustrat|annoyed/.test(t)) return tr('Уурлах бол хүний хэвийн мэдрэмж. Гол нь түүнийгээ хэрхэн илэрхийлэх вэ гэдэг. 🌊\n\n• 10 хүртэл удаан тоол\n• Хүйтэн ус уу эсвэл нүүрээ угаа\n• 5 минут хурдан алх\n• Бодлоо цаасан дээр бичээд, дараа нь урж хая\n\nЮу чамайг ингэж бухимдуулав?\nACTIONS: breath, walk');
  if (/дуу|хөгжим|playlist|song|music/.test(t)) return tr('«{0}» үед танд тохирох дууг AI сонгож өгнө: «Зөвлөмж» хэсгийн 🎵 Дуу цэсээс харна уу.', tr(m.label));
  if (/кино|цуврал|анимэ|movie|film|series|anime/.test(t)) return tr('Одоогийн сэтгэл санаанд тохирох кинонууд: 🎬\n{0}', top('movie'));
  if (/баяр|сайхан|аз жаргал|гоё|амжилт|happy|great|good news|success/.test(t)) return tr('Ямар сайхан юм бэ! 🎉 Энэ мэдрэмжийг юу авчирсныг тэмдэглээд аваарай.\n\nЭнэ эрч хүчээ {0} зарцуулбал ямар вэ?', hobby ? `«${tr(hobby)}»` : tr('дуртай зүйлдээ'));
  return tr({
    calm: 'Ойлголоо. Хэсэг зогсоод өөрийгөө мэдэрцгээе. 🌿\n\nНүдээ аниад 3 удаа гүнзгий амьсгаа. Хөл чинь газарт хүрч байгааг мэдэр.\n\nОдоо биеийн аль хэсэг хамгийн их чангарч байна вэ?',
    motivate: 'Чи үүнийг даван туулж чадна! 💪 Өмнө нь ч хэцүү үеийг давж байсан.\n\nӨнөөдөр хийж чадах ганцхан жижиг алхам юу вэ? Жишээ нь 10 минут алхах, өрөөгөө цэгцлэх, эсвэл нэг хүнд залгах.',
    listen: 'Би сонсож байна. 👂 Энэ талаар илүү дэлгэрэнгүй ярьж өгөөч. Чамд яг юу мэдрэгдэж байна вэ?',
  }[ctx.mode]);
}

export function greeting(name: string, todayMoodLabel?: string, tr: Translate = translator('mn')) {
  return todayMoodLabel
    ? tr('Сайн уу, {0}! 🌙 Өнөөдөр «{1}» гэж тэмдэглэсэн байна. Юу болсныг ярьж өгөх үү? Би сонсоод, хамтдаа хөнгөвчлөх арга хайя.', name, todayMoodLabel)
    : tr('Сайн уу, {0}! 🌙 Өнөөдөр сэтгэл санаа чинь ямар байна? Юу ч хамаагүй ярилцаж болно, би сонсоход бэлэн.', name);
}
