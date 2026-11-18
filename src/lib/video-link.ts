/**
 * Video-links (fase 2): YouTube, TikTok, Instagram, Facebook en Vimeo herkennen.
 *
 * Foodlo bewaart alleen de link en de bronvermelding: er wordt niets gedownload en er wordt geen
 * externe speler ingesloten. Tijdcodes in stappen ("0:45 Bak de ui") worden klikbare tijden die
 * de video op dat moment openen, waar het platform dat toelaat (YouTube, Vimeo).
 *
 * Alles is zuiver (geen netwerk), zodat het in tests en zonder internet werkt.
 */

export type VideoPlatform = "YouTube" | "TikTok" | "Instagram" | "Facebook" | "Vimeo";

export type VideoLink = {
  platform: VideoPlatform;
  /** Opgekuiste https-link (zonder trackingparameters). */
  url: string;
  /** "@chefanna" als de maker in de link staat (TikTok, YouTube, sommige Instagram-links). */
  maker: string | null;
  /** YouTube- of Vimeo-id als we het kunnen lezen (voor links met een tijd). */
  id: string | null;
};

/** Platform op basis van de host alleen (zonder www./m.), of null. */
export function videoPlatformVanHost(host: string): VideoPlatform | null {
  const h = host.toLowerCase().replace(/^(www|m|mobile|music)\./, "");
  if (h === "youtube.com" || h === "youtu.be" || h === "youtube-nocookie.com") return "YouTube";
  if (h === "tiktok.com" || h === "vm.tiktok.com" || h === "vt.tiktok.com") return "TikTok";
  if (h === "instagram.com" || h === "instagr.am") return "Instagram";
  if (h === "facebook.com" || h === "fb.watch" || h === "fb.com") return "Facebook";
  if (h === "vimeo.com" || h === "player.vimeo.com") return "Vimeo";
  return null;
}

const TRACKING = [
  /^utm_/i,
  /^si$/i,
  /^igsh(id)?$/i,
  /^fbclid$/i,
  /^feature$/i,
  /^is_from_webapp$/i,
  /^sender_device$/i,
  /^_r$/i,
  /^_t$/i,
  /^mibextid$/i,
  /^rdid$/i,
  /^share_url$/i,
  /^pp$/i,
];

function maakUrl(invoer: string): URL | null {
  const ruw = invoer.trim();
  if (!ruw || /\s/.test(ruw)) return null;
  const metSchema = /^[a-z][a-z0-9+.-]*:/i.test(ruw) ? ruw : `https://${ruw}`;
  try {
    const u = new URL(metSchema);
    if (u.protocol === "http:") u.protocol = "https:";
    if (u.protocol !== "https:" || u.username || u.password) return null;
    return u;
  } catch {
    return null;
  }
}

/** Haalt de eerste link uit een stuk tekst ("Kijk: https://youtu.be/abc 😍"). */
export function eersteLink(tekst: string): string | null {
  return tekst.match(/https?:\/\/[^\s<>"')\]]+/i)?.[0]?.replace(/[.,!?;:]+$/, "") ?? null;
}

/**
 * Herkent een video-link. Alleen echte video- of berichtpagina's tellen, geen kanaal- of
 * zoekpagina's. Een link zonder https:// mag (we zetten het ervoor); http wordt https.
 */
export function herkenVideoLink(invoer: string | null | undefined): VideoLink | null {
  if (!invoer) return null;
  const u = maakUrl(invoer);
  if (!u) return null;
  const platform = videoPlatformVanHost(u.hostname);
  if (!platform) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile|music)\./, "");
  const delen = u.pathname.split("/").filter(Boolean);
  for (const sleutel of [...u.searchParams.keys()])
    if (TRACKING.some((p) => p.test(sleutel))) u.searchParams.delete(sleutel);
  u.hash = "";

  let maker: string | null = null;
  let id: string | null = null;
  let isVideo = false;

  if (platform === "YouTube") {
    if (host === "youtu.be" && delen[0]) {
      id = delen[0];
      isVideo = true;
    } else if (delen[0] === "watch" && u.searchParams.get("v")) {
      id = u.searchParams.get("v");
      isVideo = true;
    } else if (["shorts", "live", "embed"].includes(delen[0] ?? "") && delen[1]) {
      id = delen[1];
      isVideo = true;
    }
    if (delen[0]?.startsWith("@")) maker = delen[0];
  } else if (platform === "TikTok") {
    if (host === "vm.tiktok.com" || host === "vt.tiktok.com") isVideo = delen.length > 0;
    else if (delen[0] === "t" && delen[1]) isVideo = true;
    else if (
      delen[0]?.startsWith("@") &&
      (delen[1] === "video" || delen[1] === "photo") &&
      delen[2]
    )
      isVideo = true;
    if (delen[0]?.startsWith("@") && delen[0].length > 1) maker = delen[0];
  } else if (platform === "Instagram") {
    const i = delen.findIndex((d) => ["reel", "reels", "p", "tv"].includes(d));
    isVideo = i >= 0 && !!delen[i + 1];
    if (i === 1 && delen[0]) maker = `@${delen[0]}`;
  } else if (platform === "Facebook") {
    if (host === "fb.watch") isVideo = delen.length > 0;
    else
      isVideo =
        (delen[0] === "watch" && !!u.searchParams.get("v")) ||
        delen.includes("videos") ||
        delen[0] === "reel" ||
        (delen[0] === "share" && ["v", "r"].includes(delen[1] ?? ""));
  } else if (platform === "Vimeo") {
    const nummer = delen.find((d) => /^\d+$/.test(d));
    if (nummer) {
      id = nummer;
      isVideo = true;
    }
  }
  if (!isVideo) return null;
  // Tijd in de link hoort bij één moment, niet bij het recept.
  if (platform === "YouTube") u.searchParams.delete("t");
  return { platform, url: u.toString(), maker, id };
}

/** "Bekijk de video bij YouTube" / "Bekijk het bericht bij Instagram". */
export function videoLinkTekst(v: Pick<VideoLink, "platform" | "url">): string {
  const bericht = v.platform === "Instagram" && /instagram\.com\/(?:[^/]+\/)?p\//.test(v.url);
  return bericht ? `Bekijk het bericht bij ${v.platform}` : `Bekijk de video bij ${v.platform}`;
}

// ---------- Tijdcodes ----------

export type Tijdcode = {
  seconden: number;
  /** Zoals de gebruiker het ziet: "0:45", "1:02:03". */
  label: string;
  /** De stap zonder de tijdcode vooraan. */
  tekst: string;
};

function naarSeconden(delen: string[]): number | null {
  const getallen = delen.map(Number);
  if (getallen.some((n) => !Number.isInteger(n) || n < 0)) return null;
  if (getallen.length === 2) {
    const [m, s] = getallen as [number, number];
    return s < 60 ? m * 60 + s : null;
  }
  if (getallen.length === 3) {
    const [u, m, s] = getallen as [number, number, number];
    return m < 60 && s < 60 ? u * 3600 + m * 60 + s : null;
  }
  return null;
}

const VOORAAN = /^\s*[([]?\s*(\d{1,2}(?::\d{2}){1,2})\s*[)\]]?\s*(?:[-–—:|•.]\s*)?/;
const TUSSEN_HAAKJES = /[([]\s*(\d{1,2}(?::\d{2}){1,2})\s*[)\]]/;

/**
 * Tijdcode in een stap: vooraan ("0:45 Bak de ui", "[1:02] – Roer") of tussen haakjes ergens in
 * de stap ("Roer de saus (2:30)"). Een kloktijd middenin ("om 12:30 aan tafel") telt niet.
 */
export function tijdcodeUit(stap: string): Tijdcode | null {
  const v = stap.match(VOORAAN);
  if (v?.[1]) {
    const sec = naarSeconden(v[1].split(":"));
    const rest = stap.slice(v[0].length).trim();
    if (sec !== null && rest) return { seconden: sec, label: v[1], tekst: rest };
  }
  const h = stap.match(TUSSEN_HAAKJES);
  if (h?.[1]) {
    const sec = naarSeconden(h[1].split(":"));
    const rest = stap
      .replace(h[0], "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (sec !== null && rest) return { seconden: sec, label: h[1], tekst: rest };
  }
  return null;
}

/** Link die de video op `seconden` opent, of null als het platform dat niet kent. */
export function videoOpTijd(v: VideoLink, seconden: number): string | null {
  const s = Math.max(0, Math.floor(seconden));
  if (v.platform === "YouTube" && v.id) {
    const u = new URL(`https://www.youtube.com/watch`);
    u.searchParams.set("v", v.id);
    u.searchParams.set("t", `${s}s`);
    return u.toString();
  }
  if (v.platform === "Vimeo" && v.id) return `https://vimeo.com/${v.id}#t=${s}s`;
  return null;
}

/** Voor schermlezers: "op 1 minuut 5 seconden". */
export function tijdVoluit(seconden: number): string {
  const u = Math.floor(seconden / 3600);
  const m = Math.floor((seconden % 3600) / 60);
  const s = seconden % 60;
  const delen = [
    u ? `${u} ${u === 1 ? "uur" : "uur"}` : "",
    m ? `${m} ${m === 1 ? "minuut" : "minuten"}` : "",
    s || (!u && !m) ? `${s} ${s === 1 ? "seconde" : "seconden"}` : "",
  ].filter(Boolean);
  return `op ${delen.join(" ")}`;
}
