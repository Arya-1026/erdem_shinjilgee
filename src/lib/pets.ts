/* Хэрэглэгчийн сонгох 3D амьтад (public/pets/*.html, Ботгоо нь public/botgo/botgo.html).
   Бүгд нэг загвартай: сэтгэл санаа бүрт нүүрний хувирал, дээл, эффект нь өөрчлөгдөнө. */
export type PetId =
  | 'botgo' | 'unagaa' | 'khurgaa' | 'bujgoo' | 'myaugaa' | 'khasraa'
  | 'gakhaikhan' | 'bichee' | 'borchoo' | 'luugaa' | 'robo';

export type Pet = { id: PetId; name: string; emoji: string; src: string };

export const PETS: Pet[] = [
  { id: 'botgo', name: 'Ботгоо', emoji: '🐫', src: '/botgo/botgo.html' },
  { id: 'unagaa', name: 'Унагаа', emoji: '🐴', src: '/pets/unagaa.html' },
  { id: 'khurgaa', name: 'Хургаа', emoji: '🐑', src: '/pets/khurgaa.html' },
  { id: 'bujgoo', name: 'Бөжгөө', emoji: '🐰', src: '/pets/bujgoo.html' },
  { id: 'myaugaa', name: 'Мяугаа', emoji: '🐱', src: '/pets/myaugaa.html' },
  { id: 'khasraa', name: 'Хасраа', emoji: '🐶', src: '/pets/khasraa.html' },
  { id: 'gakhaikhan', name: 'Гахайхан', emoji: '🐷', src: '/pets/gakhaikhan.html' },
  { id: 'bichee', name: 'Бичээ', emoji: '🐵', src: '/pets/bichee.html' },
  { id: 'borchoo', name: 'Борчоо', emoji: '🐦', src: '/pets/borchoo.html' },
  { id: 'luugaa', name: 'Луугаа', emoji: '🐲', src: '/pets/luugaa.html' },
  { id: 'robo', name: 'Робо', emoji: '🤖', src: '/pets/robo.html' },
];

export const DEFAULT_PET: PetId = 'botgo';
export const petById = (id: string | null | undefined): Pet => PETS.find(p => p.id === id) ?? PETS[0];

/* Сонголтыг төхөөрөмж дээр хадгална (localStorage). Хуудсууд хооронд шууд шинэчлэгдэнэ. */
const KEY = 'setgel-pet';
const listeners = new Set<() => void>();

export function getPet(): PetId {
  try { return petById(localStorage.getItem(KEY)).id; } catch { return DEFAULT_PET; }
}
export function setPet(id: PetId) {
  try { localStorage.setItem(KEY, id); } catch { /* хувийн цонх гэх мэт: зөвхөн энэ удаад */ }
  listeners.forEach(l => l());
}
export function subscribePet(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}
