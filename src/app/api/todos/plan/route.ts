import { NextResponse } from 'next/server';
import { WD } from '@/lib/data';
import { TODO_COLS } from '@/lib/db';
import { weekdayOf } from '@/lib/date';
import { llmConfigured, llmSmart } from '@/lib/server/llm';
import { createClient } from '@/lib/supabase/server';
import { explainPrompt, parseExplain, parseTaskList, planTodos, statsSummary, taskPrompt, weekdayProfile } from '@/lib/todo-plan';
import type { Todo } from '@/lib/types';

// POST /api/todos/plan { text?: "чөлөөт бичвэр", today: "YYYY-MM-DD", replan?: boolean }
// text байвал AI ажлын жагсаалт болгож нэмнэ. Дараа нь товлоогүй (replan бол бүх дуусаагүй) ажлыг өдрүүдэд хуваарилна.
export const maxDuration = 60;

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = await req.json().catch(() => null) as { text?: unknown; today?: unknown; replan?: unknown } | null;
  const today = typeof body?.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;
  if (!today) return NextResponse.json({ error: 'invalid today' }, { status: 400 });
  const text = typeof body?.text === 'string' ? body.text.trim() : '';

  if (text) {
    const parsed = llmConfigured() ? parseTaskList((await llmSmart(taskPrompt(text, today), { temperature: 0.2, maxTokens: 1200, timeoutMs: 25_000 }))?.text ?? '', today) : [];
    // AI байхгүй/бүтэхгүй бол мөр бүрийг нэг ажил гэж үзнэ
    const rows = parsed.length ? parsed : text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 20).map(title => ({ title: title.slice(0, 200) }));
    const { error } = await supabase.from('todos').insert(rows);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const since = new Date(Date.now() - 180 * 864e5).toISOString().slice(0, 10);
  const [all, entries] = await Promise.all([
    supabase.from('todos').select(TODO_COLS).returns<Todo[]>(),
    supabase.from('mood_entries').select('entry_date,mood,intensity,sleep').gte('entry_date', since),
  ]);
  if (all.error) return NextResponse.json({ error: all.error.message }, { status: 500 });
  const todos = all.data ?? [];
  const stats = weekdayProfile(entries.data ?? [], todos.filter(t => t.done));

  const open = todos.filter(t => !t.done);
  const tasks = open.filter(t => body?.replan === true || !t.planned_date);
  const moving = new Set(tasks.map(t => t.id));
  // Өмнө товлосон ажлын ачааллыг тооцно
  const busy: Record<string, number> = {};
  for (const t of open) if (t.planned_date && !moving.has(t.id)) busy[t.planned_date] = (busy[t.planned_date] ?? 0) + t.minutes;

  const plan = planTodos(tasks, stats, today, busy);
  const byId = new Map(tasks.map(t => [t.id, t]));
  let summary = plan.length ? `${plan.length} ажлыг таны сэтгэл санаа, эрч хүч сайн өдрүүдэд тааруулж хуваариллаа.` : 'Хуваарилах шинэ ажил алга.';

  if (plan.length && llmConfigured()) {
    const rows = plan.map(p => { const t = byId.get(p.id)!; return { title: t.title, date: p.planned_date, day: WD[weekdayOf(p.planned_date)], effort: t.effort, note: p.reason }; });
    const r = parseExplain((await llmSmart(explainPrompt(rows, statsSummary(stats)), { temperature: 0.5, maxTokens: 1600, timeoutMs: 25_000 }))?.text ?? '', plan.length);
    r?.why.forEach((w, i) => { if (w) plan[i].reason = w; });
    if (r?.summary) summary = r.summary;
  }

  const results = await Promise.all(plan.map(p => supabase.from('todos').update({ planned_date: p.planned_date, reason: p.reason }).eq('id', p.id)));
  const failed = results.find(r => r.error);
  if (failed) return NextResponse.json({ error: failed.error!.message }, { status: 500 });

  const { data: fresh } = await supabase.from('todos').select(TODO_COLS).order('created_at').returns<Todo[]>();
  return NextResponse.json({ todos: fresh ?? [], summary });
}
