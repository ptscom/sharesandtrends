/**
 * Build public/top1000.json from Upstox BOD (NSE_EQ only).
 * Run: node scripts/generate-top1000.mjs
 */
import { gunzipSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const URL =
  "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz";
const LIMIT = 1000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "public", "top1000.json");

const res = await fetch(URL);
if (!res.ok) throw new Error(`Download failed: ${res.status}`);
const buf = Buffer.from(await res.arrayBuffer());
const rows = JSON.parse(gunzipSync(buf).toString("utf8"));

const symbols = [];
const seen = new Set();
for (const row of rows) {
  if (row.segment !== "NSE_EQ" || row.instrument_type !== "EQ") continue;
  const sym = String(row.trading_symbol ?? "").trim().toUpperCase();
  if (!sym || seen.has(sym)) continue;
  seen.add(sym);
  symbols.push(sym);
  if (symbols.length >= LIMIT) break;
}

symbols.sort((a, b) => a.localeCompare(b));

const payload = {
  generatedAt: new Date().toISOString().slice(0, 10),
  method: "NSE_EQ from Upstox BOD (first 1000 unique trading symbols, sorted A–Z)",
  symbols,
};

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${symbols.length} symbols to ${outPath}`);
