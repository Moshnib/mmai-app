// ============================================================
//  TAKE A COPY OF EVERYTHING THE DATABASE HOLDS
//
//  The code is safe: committed, on GitHub, and a clone plus the keys
//  listed in .env.local.example rebuilds the whole site. The DATA is
//  not. It lives in exactly one place, and some of it cannot be fetched
//  again from anywhere:
//
//    subscribers            people who gave an address. Nowhere else.
//    feedback_submissions   messages people sent. Nowhere else.
//    raw_indicators         the daily record since 19 August 2026. A
//                           source serves its CURRENT value; nothing
//                           will tell you what the US inflation reading
//                           was on 22 August, so the change feed's
//                           history cannot be reconstructed.
//    mmai_scores            the published score for each of those days.
//    bond_yields            20,000+ rows back to 2013, from a one-time
//                           backfill. Re-runnable in principle, and only
//                           while those sources still serve history.
//    gulf_indicators        the Gulf daily record.
//
//  Writes every row of every table to JSON, one file per table, plus a
//  manifest. The output directory is gitignored: it holds subscriber
//  email addresses and belongs in a private backup, never in a public
//  repository.
//
//    npx tsx scripts/backup-database.ts
//    npx tsx scripts/backup-database.ts --out "D:/mmai-backups"
// ============================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Every table worth keeping. Adding a table to the schema means adding
 *  it here — a table missing from this list is a table nobody is backing
 *  up, and nothing else will notice. */
const TABLES = [
  "subscribers",
  "feedback_submissions",
  "raw_indicators",
  "mmai_scores",
  "bond_yields",
  "gulf_indicators",
  // Added 19 September: the Observatory's table shipped on 14 September
  // and was never listed here, so no backup had it.
  "observatory_indicators",
] as const;

/** These two are deny-all under row-level security. An anon-key read
 *  returns zero rows and no error, which looks exactly like an empty
 *  table — so an empty result from the anon key is treated as a failure
 *  rather than a success. They are also the only two whose contents
 *  exist nowhere but this database. */
const NEEDS_SERVICE_ROLE = new Set(["subscribers", "feedback_submissions"]);

/** Supabase caps a single response. Paging keeps a large table whole
 *  rather than silently backing up its first thousand rows. */
const PAGE = 1000;

function outDir(): string {
  const i = process.argv.indexOf("--out");
  const base = i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : join(process.cwd(), "backups");
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return join(base, stamp);
}

/** Read a whole table, or report why not. */
async function readAll(client: SupabaseClient, table: string): Promise<{ rows: unknown[] } | { error: string }> {
  const rows: unknown[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await client.from(table).select("*").range(from, from + PAGE - 1);
    if (error) return { error: error.message };
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return { rows };
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || (!anonKey && !serviceKey)) {
    console.error("\nNo Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and a key in .env.local.\n");
    process.exit(1);
  }

  // TWO CLIENTS, AND A REASON.
  //
  // The service role reads past row-level security; the anon key cannot.
  // But SUPABASE_SERVICE_ROLE_KEY is deliberately a PLACEHOLDER in local
  // .env.local — it bypasses every protection the database has and lives
  // in Vercel only. The first version of this script tried that
  // placeholder, got "Invalid API key" on every table, and backed up
  // nothing at all while reporting six successes.
  //
  // Each table is now tried with the service role and retried with the
  // anon key, and the report says which key each one came from. Run
  // locally you get the four public tables and an explicit warning about
  // the two you did not. Run with the real service key you get all six.
  const admin = serviceKey ? createClient(url, serviceKey) : null;
  const publicClient = anonKey ? createClient(url, anonKey) : null;

  const dir = outDir();
  mkdirSync(dir, { recursive: true });

  const manifest: Record<string, number> = {};
  const readWith: Record<string, string> = {};
  const missed: string[] = [];
  let total = 0;

  console.log(`\nBacking up to ${dir}\n`);

  for (const table of TABLES) {
    let rows: unknown[] | null = null;
    let source = "";
    let lastError = "";

    for (const [label, client] of [["service role", admin], ["anon", publicClient]] as const) {
      if (!client) continue;
      const r = await readAll(client, table);
      if ("error" in r) { lastError = r.error; continue; }
      // Zero rows from the anon key on a deny-all table is RLS hiding
      // them, not an empty table. Accepting it would write an empty file
      // and call it a backup.
      if (r.rows.length === 0 && label === "anon" && NEEDS_SERVICE_ROLE.has(table)) {
        lastError = "row-level security hid every row (anon key cannot read this table)";
        continue;
      }
      rows = r.rows;
      source = label;
      break;
    }

    if (rows === null) {
      console.error(`  MISS  ${table.padEnd(22)}        ${lastError}`);
      missed.push(table);
      readWith[table] = "NOT CAPTURED";
      manifest[table] = 0;
      continue;
    }

    writeFileSync(join(dir, `${table}.json`), JSON.stringify(rows, null, 2), "utf8");
    manifest[table] = rows.length;
    readWith[table] = source;
    total += rows.length;
    console.log(`  ok    ${table.padEnd(22)} ${String(rows.length).padStart(6)} rows  via ${source}`);
  }

  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify(
      {
        takenAt: new Date().toISOString(),
        project: url,
        tables: manifest,
        readWith,
        notCaptured: missed,
        totalRows: total,
        restore:
          "Each file is a JSON array of rows exactly as stored. To restore: create the schema from " +
          "supabase/schema.sql, then insert each array into its table, then check these counts match.",
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`\n  ${total} rows captured across ${TABLES.length - missed.length} of ${TABLES.length} tables.`);

  if (missed.length > 0) {
    console.error(`\n  INCOMPLETE — not captured: ${missed.join(", ")}`);
    console.error("  Those tables are deny-all under row-level security and need the real");
    console.error("  SUPABASE_SERVICE_ROLE_KEY (Supabase dashboard > Project Settings > API).");
    console.error("  They are also the two whose contents exist nowhere else, so a backup");
    console.error("  without them is missing the only irreplaceable data on the site.\n");
    process.exit(1);
  }

  console.log("  Keep this folder somewhere that is not this laptop.\n");
}

main();
export {};
