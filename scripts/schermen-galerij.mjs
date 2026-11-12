#!/usr/bin/env node
// Maakt van een map schermafdrukken een galerij die je op GitHub (ook op je telefoon) en in de
// browser kan bekijken: README.md (GitHub toont de beelden) en index.html (lokaal of als bijlage).
// Gebruik: node scripts/schermen-galerij.mjs [map] [titel]
// Met een tweede map "voor" (SCHERMEN_VOOR=pad) komen voor en na naast elkaar.
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const map = process.argv[2] ?? "docs/foodloapp-v2/schermen/actueel";
const titel = process.argv[3] ?? "Foodloapp: de schermen zoals ze nu zijn";
const voorMap = process.env["SCHERMEN_VOOR"];

const pngs = (m) =>
  existsSync(m)
    ? readdirSync(m)
        .filter((f) => /\.(png|jpe?g)$/.test(f))
        .sort()
    : [];
const naamVan = (f) =>
  basename(f)
    .replace(/\.(png|jpe?g)$/, "")
    .replace(/^[a-z-]+?-\d\d-/, "")
    .replace(/-/g, " ");
const themaVan = (f) => f.match(/^([a-z-]+?)-\d\d-/)?.[1] ?? "overig";

const beelden = pngs(map);
if (!beelden.length) {
  console.error(`Geen schermafdrukken in ${map}. Draai eerst: npm run schermen`);
  process.exit(1);
}
const voor = new Set(voorMap ? pngs(voorMap) : []);
const groepen = new Map();
for (const f of beelden) groepen.set(themaVan(f), [...(groepen.get(themaVan(f)) ?? []), f]);
const datum = new Date().toLocaleDateString("nl-BE", { dateStyle: "long" });

let md = `# ${titel}\n\nStand ${datum}. Alleen verzonnen voorbeeldgegevens (nep-databank).\n`;
let html = "";
for (const [thema, lijst] of groepen) {
  md += `\n## Thema: ${thema}\n\n`;
  html += `<h2>Thema: ${thema}</h2><div class="rij">`;
  for (const f of lijst) {
    const naam = naamVan(f);
    if (voor.has(f)) {
      const v = relative(map, join(voorMap, f));
      md += `### ${naam}\n\n| Voor | Na |\n|---|---|\n| <img src="${v}" width="260"> | <img src="${f}" width="260"> |\n\n`;
      html += `<figure><figcaption>${naam}</figcaption><div class="paar"><img src="${v}" alt="Voor: ${naam}"><img src="${f}" alt="Na: ${naam}"></div></figure>`;
    } else {
      md += `<img src="${f}" alt="${naam}" width="260"> `;
      html += `<figure><img src="${f}" alt="${naam}"><figcaption>${naam}</figcaption></figure>`;
    }
  }
  md += "\n";
  html += "</div>";
}
writeFileSync(join(map, "README.md"), md);
writeFileSync(
  join(map, "index.html"),
  `<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titel}</title>
<style>body{font:16px/1.5 system-ui,sans-serif;margin:16px;background:#faf7f2;color:#222}h1{font-size:1.5rem}
.rij{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;max-width:280px}img{width:100%;border:1px solid #ddd;border-radius:12px}
.paar{display:grid;grid-template-columns:1fr 1fr;gap:6px}figcaption{font-weight:600;margin:4px 0}</style>
<h1>${titel}</h1><p>Stand ${datum}. Alleen verzonnen voorbeeldgegevens.</p>${html}</html>`,
);
console.log(`Galerij: ${join(map, "README.md")} en index.html (${beelden.length} beelden)`);
