"""Эдийн засгийн тооцоо. Ажиллуулах: python paper/eval/econ_model.py
Оролтын утгуудыг шинэчлэхэд өгүүллийн 2, 5-р хүснэгтийг дахин бөглөнө."""
import math

FX = 3576            # ₮/$, Монголбанк, 2026-06-16
INFRA_USD = 20 + 25  # Vercel Pro + Supabase Pro, сард
CALLS = 60           # нэг идэвхтэй хэрэглэгчийн сарын LLM дуудлага (таамаг)
CLS_CALLS, CLS_IN, CLS_OUT = 30, 450, 100  # хямралын утгын ангилал (таамаг)
TOK_IN, TOK_OUT = 3000, 500          # нэг дуудлагын токен (таамаг)
P_IN, P_OUT = 0.15, 0.60             # $/1 сая токен, Groq gpt-oss-120b
WAGE = 2_800_000     # ₮/сар, улсын дундаж цалин
FTE = 0.75           # 0.5 хөгжүүлэгч + 0.25 сэтгэл зүйч
SESSIONS = 100       # нэг зөвлөгчийн сарын уулзалт (таамаг)
STUDENTS = 147_300   # 2020-2021 хичээлийн жил

I = INFRA_USD * FX
v = (CALLS * (TOK_IN * P_IN + TOK_OUT * P_OUT) + CLS_CALLS * (CLS_IN * P_IN + CLS_OUT * P_OUT)) / 1e6 * FX
S = FTE * WAGE
F = I + S

def unit_cost(m): return (F + v * m) / m
def breakeven(p): return math.ceil(F / (p - v))
def installs(m, r): return math.ceil(m / r)

if __name__ == '__main__':
    print(f'I={I:,.0f} v={v:,.1f} S={S:,.0f} F={F:,.0f}')
    print(f'c(1000)={unit_cost(1000):,.0f}  session={WAGE / SESSIONS:,.0f}  ratio={WAGE / SESSIONS / unit_cost(1000):.1f}')
    for p in (2000, 3000, 5000): print(f'p={p}: M*={breakeven(p):,}')
    m = breakeven(3000)
    for r in (0.033, 0.10, 0.20, 0.40):
        u = installs(m, r); print(f'r={r:.1%}: U={u:,} ({u / STUDENTS:.1%} of students)')
    print(f'3 months x c(1000) x NNT 11.5 = {3 * unit_cost(1000) * 11.5:,.0f}; 8 sessions = {8 * WAGE / SESSIONS:,.0f}')
