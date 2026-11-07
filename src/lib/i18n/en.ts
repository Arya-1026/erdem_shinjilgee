/* Монгол бичвэр → англи орчуулга. Шинэ бичвэр нэмбэл i18n.test.ts дутууг нь мэдэгдэнэ. */
import { EN_DATA } from './en-data';
import { EN_UI_1 } from './en-ui-1';
import { EN_MOVIES } from './en-movies';
import { EN_UI_2 } from './en-ui-2';

export const EN: Record<string, string> = { ...EN_DATA, ...EN_UI_1, ...EN_UI_2, ...EN_MOVIES };
