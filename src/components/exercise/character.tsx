'use client';

import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/components/providers/locale-provider';

/** Дасгал үзүүлэх 3D дүр. Анх хүн, хэрэглэгч муур, туулай руу сольж болно. Сонголтыг энэ төхөөрөмж дээр санана. */
export type Character = 'cat' | 'rabbit' | 'human';
export const CHARACTERS: [Character, string, string][] = [['human', '🧍', 'Хүн'], ['cat', '🐱', 'Мяугаа'], ['rabbit', '🐰', 'Бөжгөө']];
// v2: анхдагч хүн болсон тул туршилтын үеийн сонголтыг тооцохгүй
const KEY = 'setgel-ex-character-v2';
export const DEFAULT_CHARACTER: Character = 'human';
const isCharacter = (v: unknown): v is Character => CHARACTERS.some(([c]) => c === v);

const subs = new Set<() => void>();
function get(): Character {
  try { const v = localStorage.getItem(KEY); return isCharacter(v) ? v : DEFAULT_CHARACTER; } catch { return DEFAULT_CHARACTER; }
}
function set(c: Character) {
  try { localStorage.setItem(KEY, c); } catch { /* хувийн цонх */ }
  subs.forEach(f => f());
}

export const useCharacter = () => useSyncExternalStore(f => { subs.add(f); return () => subs.delete(f); }, get, () => DEFAULT_CHARACTER);

export function CharacterPicker({ className }: { className?: string }) {
  const tr = useT();
  const cur = useCharacter();
  return (
    <div role="radiogroup" aria-label={tr('Дасгал үзүүлэх дүр')} className={cn('flex gap-1 rounded-full bg-background/85 p-1 text-sm shadow-sm', className)}>
      {CHARACTERS.map(([c, emoji, name]) => (
        <button key={c} type="button" role="radio" aria-checked={cur === c} title={tr(name)} aria-label={tr(name)} onClick={() => set(c)}
          className={cn('grid size-8 place-items-center rounded-full text-lg transition', cur === c ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
