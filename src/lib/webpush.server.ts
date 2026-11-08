/**
 * Web Push (RFC 8291 aes128gcm + RFC 8292 VAPID) met WebCrypto.
 * Werkt in de Worker-omgeving; geen Node-only bibliotheken.
 */

import { isVeiligPushEndpoint } from "@/lib/meldingen-schema";

const enc = new TextEncoder();

function b64urlNaarBytes(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesNaarB64url(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function samen(...delen: Uint8Array[]): Uint8Array {
  const len = delen.reduce((a, d) => a + d.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const d of delen) {
    out.set(d, o);
    o += d.length;
  }
  return out;
}

async function hmac(sleutel: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", sleutel as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, data as BufferSource));
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, lengte: number) {
  const prk = await hmac(salt, ikm);
  const okm = await hmac(prk, samen(info, new Uint8Array([1])));
  return okm.slice(0, lengte);
}

export type PushAbonnement = { endpoint: string; p256dh: string; auth: string };

/** VAPID-JWT voor de pushdienst van de browser. */
async function vapidHeader(endpoint: string, publiek: string, prive: string, subject: string) {
  const aud = new URL(endpoint).origin;
  const pub = b64urlNaarBytes(publiek);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesNaarB64url(pub.slice(1, 33)),
    y: bytesNaarB64url(pub.slice(33, 65)),
    d: prive,
    ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = bytesNaarB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const payload = bytesNaarB64url(
    enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })),
  );
  const tekenen = enc.encode(`${header}.${payload}`);
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, tekenen as BufferSource),
  );
  return `vapid t=${header}.${payload}.${bytesNaarB64url(sig)}, k=${publiek}`;
}

async function versleutel(abo: PushAbonnement, tekst: string): Promise<Uint8Array> {
  const uaPub = b64urlNaarBytes(abo.p256dh);
  const authSecret = b64urlNaarBytes(abo.auth);

  const eigen = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eigen.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eigen.privateKey, 256),
  );

  const keyInfo = samen(enc.encode("WebPush: info\0"), uaPub, asPub);
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32);

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const aes = await crypto.subtle.importKey("raw", cek as BufferSource, "AES-GCM", false, ["encrypt"]);
  const plat = samen(enc.encode(tekst), new Uint8Array([2]));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce as BufferSource }, aes, plat as BufferSource),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return samen(salt, rs, new Uint8Array([asPub.length]), asPub, cipher);
}

export type PushResultaat = { ok: boolean; status: number; verlopen: boolean; fout?: string };

/** Stuurt één melding. `verlopen` betekent: abonnement mag weg. */
export async function stuurPush(abo: PushAbonnement, payload: unknown, ttl = 3600): Promise<PushResultaat> {
  const publiek = process.env["VAPID_PUBLIC_KEY"];
  const prive = process.env["VAPID_PRIVATE_KEY"];
  const subject = process.env["VAPID_SUBJECT"] ?? "mailto:hallo@foodloapp.com";
  if (!publiek || !prive) return { ok: false, status: 0, verlopen: false, fout: "VAPID ontbreekt" };

  // Oude of gemanipuleerde abonnementen: nooit naar een intern adres posten.
  // `verlopen: true` zorgt dat het abonnement wordt uitgeschakeld.
  if (!isVeiligPushEndpoint(abo.endpoint)) {
    return { ok: false, status: 0, verlopen: true, fout: "onveilig endpoint" };
  }

  try {
    const body = await versleutel(abo, JSON.stringify(payload));
    const res = await fetch(abo.endpoint, {
      // Pushdiensten sturen nooit door; een omleiding volgen we dus niet.
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      method: "POST",
      headers: {
        Authorization: await vapidHeader(abo.endpoint, publiek, prive, subject),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: String(ttl),
        Urgency: "normal",
      },
      body: body as BodyInit,
    });
    if (res.ok) return { ok: true, status: res.status, verlopen: false };
    const tekst = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      verlopen: res.status === 404 || res.status === 410,
      fout: `${res.status} ${tekst.slice(0, 200)}`,
    };
  } catch (e) {
    return { ok: false, status: 0, verlopen: false, fout: (e as Error).message };
  }
}
