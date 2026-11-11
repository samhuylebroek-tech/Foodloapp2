// Mini-PostgREST in het geheugen voor de nep-Supabase (alleen voor E2E-tests).
// Ondersteunt de queryvormen die Foodlo gebruikt: select (incl. eenvoudige
// embedding), eq/neq/gt/gte/lt/lte/in/is/not.is/ilike/like/or (beperkt),
// order, limit/range, single/maybeSingle, count, insert, upsert, update, delete.
import { randomUUID } from "node:crypto";

/** Standaard `max-rows` van Supabase. */
const MAX_RIJEN = 1000;

/** Kolomstandaarden zoals in de echte tabellen (anders ontbreken ze na een insert). */
const STANDAARD = {
  shopping_items: { checked: false, note: null, recipe_id: null },
  recipes: { is_concept: false, deleted_at: null, tags: [], image_url: null },
  meal_plan: { custom_title: null, soort: null, group_id: null },
};

export function maakDb(seed = {}) {
  const tabellen = new Map(Object.entries(structuredClone(seed)));
  const t = (naam) => {
    if (!tabellen.has(naam)) tabellen.set(naam, []);
    return tabellen.get(naam);
  };
  return {
    tabellen,
    t,
    reset: (s = seed) => {
      tabellen.clear();
      for (const [k, v] of Object.entries(structuredClone(s))) tabellen.set(k, v);
    },
  };
}

function waarde(ruw) {
  if (ruw === "null") return null;
  if (ruw === "true") return true;
  if (ruw === "false") return false;
  const zonderAanhalingstekens = ruw.replace(/^"(.*)"$/, "$1");
  // "%" komt voor in ilike-patronen (bv. "%zalm%") en is dan geen escape.
  try {
    return decodeURIComponent(zonderAanhalingstekens);
  } catch {
    return zonderAanhalingstekens;
  }
}

function vergelijk(rij, kolom, op, arg) {
  const v = rij[kolom];
  const num = (x) => (typeof v === "number" ? Number(x) : x);
  switch (op) {
    case "eq":
      return String(v) === String(waarde(arg));
    case "neq":
      return String(v) !== String(waarde(arg));
    case "gt":
      return v > num(waarde(arg));
    case "gte":
      return v >= num(waarde(arg));
    case "lt":
      return v < num(waarde(arg));
    case "lte":
      return v <= num(waarde(arg));
    case "is":
      return arg === "null" ? v === null || v === undefined : v === waarde(arg);
    case "in": {
      const lijst = arg
        .replace(/^\(|\)$/g, "")
        .split(",")
        .map((x) => waarde(x));
      return lijst.map(String).includes(String(v));
    }
    case "like":
    case "ilike": {
      const re = new RegExp(
        "^" +
          waarde(arg)
            .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
            .replace(/[*%]/g, ".*") +
          "$",
        op === "ilike" ? "i" : "",
      );
      return re.test(String(v ?? ""));
    }
    case "cs": {
      const lijst = waarde(arg)
        .replace(/^\{|\}$/g, "")
        .split(",")
        .filter(Boolean);
      return Array.isArray(v) && lijst.every((x) => v.includes(x));
    }
    default:
      return true; // onbekende operator: niet filteren
  }
}

function pasFilter(rijen, params) {
  let uit = rijen;
  for (const [kolom, expr] of params) {
    if (["select", "order", "limit", "offset", "on_conflict", "columns"].includes(kolom)) continue;
    if (kolom === "or") continue; // niet ondersteund: geen filter (ruimer, nooit strenger)
    const m = expr.match(/^(not\.)?([a-z]+)\.(.*)$/s);
    if (!m) continue;
    const [, niet, op, arg] = m;
    uit = uit.filter((r) => (niet ? !vergelijk(r, kolom, op, arg) : vergelijk(r, kolom, op, arg)));
  }
  return uit;
}

function sorteer(rijen, order) {
  if (!order) return rijen;
  const sleutels = order.split(",").map((s) => s.split("."));
  return [...rijen].sort((a, b) => {
    for (const [k, richting] of sleutels) {
      if (a[k] === b[k]) continue;
      const r = a[k] > b[k] ? 1 : -1;
      return richting === "desc" ? -r : r;
    }
    return 0;
  });
}

/** Eenvoudige embedding: "recipe_ingredients(*)" bij recipes via recipe_id, of "recipes(*)" via recipe_id. */
function embed(db, tabel, rijen, select) {
  if (!select) return rijen;
  const embeds = [...select.matchAll(/([a-z_]+)(?:!([a-z_]+))?\(([^()]*)\)/g)];
  if (!embeds.length) return rijen;
  return rijen.map((rij) => {
    const kopie = { ...rij };
    for (const [, naam] of embeds) {
      const doel = db.t(naam);
      const enkelvoud = tabel.replace(/s$/, "");
      if (doel.some((d) => `${enkelvoud}_id` in d)) {
        kopie[naam] = doel.filter((d) => d[`${enkelvoud}_id`] === rij.id);
      } else if (`${naam.replace(/s$/, "")}_id` in rij) {
        kopie[naam] = doel.find((d) => d.id === rij[`${naam.replace(/s$/, "")}_id`]) ?? null;
      } else {
        kopie[naam] = [];
      }
    }
    return kopie;
  });
}

export function rest(db, { method, tabel, params, body, headers }) {
  const prefer = headers["prefer"] ?? "";
  const accept = headers["accept"] ?? "";
  const enkel = accept.includes("vnd.pgrst.object");
  const rijen = db.t(tabel);
  const select = params.get("select");
  const kop = {};
  const metRepresentatie = prefer.includes("return=representation");

  const antwoord = (status, data) => {
    if (enkel) {
      const lijst = Array.isArray(data) ? data : [data];
      if (lijst.length !== 1) {
        return {
          status: 406,
          body: {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: `Results contain ${lijst.length} rows`,
          },
          kop,
        };
      }
      return { status, body: lijst[0], kop };
    }
    return { status, body: data, kop };
  };

  if (method === "GET" || method === "HEAD") {
    let uit = sorteer(pasFilter(rijen, params), params.get("order"));
    const totaal = uit.length;
    const offset = Number(params.get("offset") ?? 0);
    // Zoals echte Supabase (PostgREST `max-rows` = 1000): nooit meer dan 1000 rijen per
    // verzoek, ook niet bij `.limit(50000)`. Zo vallen ongepagineerde queries op (BUG-093).
    const gevraagd = params.get("limit") ? Number(params.get("limit")) : Infinity;
    uit = uit.slice(offset, offset + Math.min(gevraagd, MAX_RIJEN));
    if (prefer.includes("count="))
      kop["content-range"] = `${offset}-${offset + uit.length - 1}/${totaal}`;
    if (method === "HEAD") return { status: 200, body: null, kop };
    return antwoord(200, embed(db, tabel, uit, select));
  }

  if (method === "POST") {
    const nieuw = (Array.isArray(body) ? body : [body]).map((r) => ({
      id: randomUUID(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...(STANDAARD[tabel] ?? {}),
      // Zoals de echte databank: aankoopdatum standaard "nu".
      ...(tabel === "shopping_history" ? { gekocht_op: new Date().toISOString() } : {}),
      ...r,
    }));
    const conflict = params.get("on_conflict");
    const uit = [];
    for (const r of nieuw) {
      const sleutels = conflict ? conflict.split(",") : ["id"];
      const bestaand = rijen.find((x) =>
        sleutels.every((k) => x[k] !== undefined && String(x[k]) === String(r[k])),
      );
      if (bestaand) {
        if (prefer.includes("resolution=merge-duplicates") || conflict) {
          const { id: _negeer, created_at: _c, ...rest } = r;
          Object.assign(bestaand, conflict ? rest : r);
          uit.push(bestaand);
        } else {
          return {
            status: 409,
            body: { code: "23505", message: "duplicate key value violates unique constraint" },
            kop,
          };
        }
      } else {
        rijen.push(r);
        uit.push(r);
      }
    }
    if (!metRepresentatie) return { status: 201, body: null, kop };
    return antwoord(201, embed(db, tabel, uit, select));
  }

  if (method === "PATCH") {
    const doel = pasFilter(rijen, params);
    for (const r of doel) Object.assign(r, body, { updated_at: new Date().toISOString() });
    if (!metRepresentatie) return { status: 204, body: null, kop };
    return antwoord(200, doel);
  }

  if (method === "DELETE") {
    const doel = new Set(pasFilter(rijen, params));
    const blijft = rijen.filter((r) => !doel.has(r));
    rijen.length = 0;
    rijen.push(...blijft);
    if (!metRepresentatie) return { status: 204, body: null, kop };
    return antwoord(200, [...doel]);
  }
  return { status: 405, body: { message: "methode niet ondersteund" }, kop };
}
