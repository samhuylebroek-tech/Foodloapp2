import { getRequest } from "@tanstack/react-start/server";

/** IP en toestelinfo van het huidige verzoek (alleen server). */
export function verzoekInfo(): { ip: string | null; ua: string | null } {
  try {
    const req = getRequest();
    return {
      ip: req?.headers.get("x-forwarded-for") ?? null,
      ua: req?.headers.get("user-agent") ?? null,
    };
  } catch {
    return { ip: null, ua: null };
  }
}
