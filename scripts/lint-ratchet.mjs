#!/usr/bin/env node
// Lint-"ratchet": de codebase heeft een grote lint-achterstand (zie BASELINE).
// Daarom: nieuwe bestanden moeten foutloos zijn, gewijzigde bestanden mogen
// niet méér fouten krijgen dan op het aftakpunt (merge-base) met de basisbranch.
// Gebruik: node scripts/lint-ratchet.mjs [basis-ref]   (standaard origin/main)
import { execFileSync } from "node:child_process";
import { ESLint } from "eslint";

const basis = process.argv[2] ?? "origin/main";
const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();

const mergeBase = git("merge-base", "HEAD", basis);
const lijst = git(
  "diff",
  "--name-status",
  "--diff-filter=AMR",
  mergeBase,
  "HEAD",
  "--",
  "*.ts",
  "*.tsx",
  "*.mjs",
)
  .split("\n")
  .filter(Boolean)
  .map((r) => r.split("\t"))
  .map(([status, a, b]) => ({
    status: status[0],
    pad: b ?? a,
    oud: status[0] === "R" ? a : (b ?? a),
  }))
  .filter((f) => f.pad !== "src/routeTree.gen.ts");

const eslint = new ESLint();
const telFouten = (res) => res.reduce((n, r) => n + r.errorCount, 0);
let mislukt = false;

for (const f of lijst) {
  const nu = telFouten(await eslint.lintFiles([f.pad]));
  if (f.status === "A") {
    if (nu > 0) {
      mislukt = true;
      console.log(`✗ nieuw bestand ${f.pad}: ${nu} fout(en) — moet 0 zijn`);
    } else console.log(`✓ nieuw ${f.pad}`);
    continue;
  }
  let oudeTekst = "";
  try {
    oudeTekst = git("show", `${mergeBase}:${f.oud}`);
  } catch {
    oudeTekst = "";
  }
  const voor = oudeTekst
    ? telFouten(await eslint.lintText(oudeTekst + "\n", { filePath: f.pad }))
    : 0;
  if (nu > voor) {
    mislukt = true;
    console.log(`✗ ${f.pad}: ${voor} → ${nu} fouten (mag niet stijgen)`);
  } else console.log(`✓ ${f.pad}: ${voor} → ${nu}`);
}

if (!lijst.length) console.log("Geen gewijzigde bronbestanden.");
process.exit(mislukt ? 1 : 0);
