import { createClient } from "@supabase/supabase-js";
import { emptyLedger, type Ledger } from "./ledger";
export type Settings = { url: string; key: string };
const DATA_KEY = "verimark-ledger-v1";
const SETTINGS_KEY = "verimark-connection-v1";
export const readSettings = (): Settings =>
  JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{"url":"","key":""}') as Settings;
export const saveSettings = (s: Settings) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
export const readLocal = (): Ledger =>
  JSON.parse(localStorage.getItem(DATA_KEY) ?? JSON.stringify(emptyLedger())) as Ledger;
export const saveLocal = (l: Ledger) => localStorage.setItem(DATA_KEY, JSON.stringify(l));
function client(s: Settings) {
  return createClient(s.url, s.key, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function readRemote(s: Settings): Promise<{ ledger: Ledger; revision: number }> {
  const { data, error } = await client(s)
    .from("verimark_ledger")
    .select("payload,revision")
    .eq("id", "main")
    .maybeSingle();
  if (error) throw new Error(`Database: ${error.message}`);
  return data
    ? { ledger: data["payload"] as Ledger, revision: Number(data["revision"]) }
    : { ledger: emptyLedger(), revision: -1 };
}
export async function saveRemote(s: Settings, ledger: Ledger, revision: number): Promise<number> {
  const db = client(s);
  const next = revision + 1;
  if (revision === -1) {
    const { error } = await db
      .from("verimark_ledger")
      .insert({ id: "main", payload: ledger, revision: next });
    if (error) throw new Error(`Database: ${error.message}`);
  } else {
    const { data, error } = await db
      .from("verimark_ledger")
      .update({ payload: ledger, revision: next })
      .eq("id", "main")
      .eq("revision", revision)
      .select("id");
    if (error) throw new Error(`Database: ${error.message}`);
    if (!data?.length)
      throw new Error("Another controller changed the ledger. Reload before trying again.");
  }
  return next;
}
export const setupSQL = `-- Demonstration only: anonymous writes are not production authorization.
-- Use an isolated project with synthetic student data.
CREATE TABLE public.verimark_ledger (
  id text PRIMARY KEY,
  payload jsonb NOT NULL,
  revision integer NOT NULL DEFAULT 0
);
GRANT SELECT, INSERT, UPDATE ON public.verimark_ledger TO anon;
GRANT ALL ON public.verimark_ledger TO service_role;
ALTER TABLE public.verimark_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY demo_read ON public.verimark_ledger FOR SELECT TO anon USING (true);
CREATE POLICY demo_insert ON public.verimark_ledger FOR INSERT TO anon WITH CHECK (id = 'main');
CREATE POLICY demo_update ON public.verimark_ledger FOR UPDATE TO anon USING (id = 'main') WITH CHECK (id = 'main');`;
