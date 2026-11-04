import { SetupNeeded } from '@/components/setup-needed';

// .env.local-д Supabase-ийн түлхүүр алга үед proxy.ts энд шилжүүлнэ
export default function SetupPage() {
  return <SetupNeeded kind="env" />;
}
