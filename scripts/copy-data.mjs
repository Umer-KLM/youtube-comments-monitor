// One-off: copy every app table from the old Supabase project to the new one.
//
// 1. Run migrations 0001, 0003 and 0004 in the NEW project first (not 0002).
// 2. Make a file .env.migrate (git-ignored, like every .env*) with:
//      OLD_SUPABASE_URL=https://old.supabase.co
//      OLD_SUPABASE_SERVICE_ROLE_KEY=...
//      NEW_SUPABASE_URL=https://new.supabase.co
//      NEW_SUPABASE_SERVICE_ROLE_KEY=...
// 3. node --env-file=.env.migrate scripts/copy-data.mjs
//
// Safe to run again: rows are upserted on their primary key. It prints the
// row count of every table in both projects at the end.
import { createClient } from "@supabase/supabase-js";

const need = ["OLD_SUPABASE_URL", "OLD_SUPABASE_SERVICE_ROLE_KEY", "NEW_SUPABASE_URL", "NEW_SUPABASE_SERVICE_ROLE_KEY"];
for (const k of need) if (!process.env[k]) throw new Error(`Missing ${k} (see the top of this file)`);
if (process.env.OLD_SUPABASE_URL === process.env.NEW_SUPABASE_URL) throw new Error("OLD and NEW point to the same project");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const oldDb = createClient(process.env.OLD_SUPABASE_URL, process.env.OLD_SUPABASE_SERVICE_ROLE_KEY, opts);
const newDb = createClient(process.env.NEW_SUPABASE_URL, process.env.NEW_SUPABASE_SERVICE_ROLE_KEY, opts);

// Parents before children (tags references items).
const TABLES = [
  { name: "topics", key: "phrase" },
  { name: "channels", key: "channel_id" },
  { name: "videos", key: "video_id" },
  { name: "items", key: "id" },
  { name: "tags", key: "item_id" },
  { name: "runs", key: "id" },
  { name: "jobs", key: "id" },
  { name: "sweep_units", key: "id" },
  { name: "quota_ledger", key: "quota_day" },
];
const PAGE = 1000;

async function count(db, table) {
  const { count: n, error } = await db.from(table).select("*", { count: "exact", head: true });
  if (error) throw new Error(`count ${table}: ${error.message}`);
  return n ?? 0;
}

for (const t of TABLES) {
  let copied = 0;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await oldDb.from(t.name).select("*").order(t.key).range(from, from + PAGE - 1);
    if (error) throw new Error(`read ${t.name}: ${error.message}`);
    if (!data.length) break;
    const res = await newDb.from(t.name).upsert(data, { onConflict: t.key });
    if (res.error) throw new Error(`write ${t.name}: ${res.error.message}`);
    copied += data.length;
    if (data.length < PAGE) break;
  }
  console.log(`${t.name}: copied ${copied}`);
}

console.log("\ntable            old      new");
let mismatch = false;
for (const t of TABLES) {
  const [a, b] = await Promise.all([count(oldDb, t.name), count(newDb, t.name)]);
  if (a !== b) mismatch = true;
  console.log(`${t.name.padEnd(14)} ${String(a).padStart(6)}   ${String(b).padStart(6)}${a === b ? "" : "   <- differs"}`);
}

console.log(`
${mismatch ? "Some counts differ: run the script again." : "All counts match."}
Then run this in the NEW project's SQL editor so new jobs and sweep units get fresh ids:
  select setval(pg_get_serial_sequence('jobs', 'id'), coalesce((select max(id) from jobs), 1));
  select setval(pg_get_serial_sequence('sweep_units', 'id'), coalesce((select max(id) from sweep_units), 1));`);
