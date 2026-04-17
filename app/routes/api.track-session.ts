import { data } from "react-router";
import { createClient } from "@supabase/supabase-js";
import type { Route } from "./+types/api.track-session";

function parseUserAgent(ua: string) {
  let browser = "Unknown", browserVersion = "", os = "Unknown", osVersion = "", deviceType = "Desktop";

  if (/PlayStation 5\/([\d.]+)/i.test(ua)) {
    os = "PlayStation 5"; deviceType = "Console";
    osVersion = ua.match(/PlayStation 5\/([\d.]+)/i)?.[1] ?? "";
  } else if (/PlayStation 4\/([\d.]+)/i.test(ua)) {
    os = "PlayStation 4"; deviceType = "Console";
    osVersion = ua.match(/PlayStation 4\/([\d.]+)/i)?.[1] ?? "";
  } else if (/PlayStation/i.test(ua)) {
    os = "PlayStation"; deviceType = "Console";
  } else if (/Xbox One/i.test(ua)) {
    os = "Xbox One"; deviceType = "Console";
  } else if (/Xbox/i.test(ua)) {
    os = "Xbox"; deviceType = "Console";
  } else if (/Nintendo Switch/i.test(ua)) {
    os = "Nintendo Switch"; deviceType = "Console";
  } else if (/iphone os ([\d_]+)/i.test(ua)) {
    os = "iOS"; deviceType = "Mobile";
    osVersion = (ua.match(/iphone os ([\d_]+)/i)?.[1] ?? "").replace(/_/g, ".");
  } else if (/ipad.*cpu os ([\d_]+)/i.test(ua)) {
    os = "iPadOS"; deviceType = "Tablet";
    osVersion = (ua.match(/cpu os ([\d_]+)/i)?.[1] ?? "").replace(/_/g, ".");
  } else if (/android ([\d.]+)/i.test(ua)) {
    os = "Android";
    osVersion = ua.match(/android ([\d.]+)/i)?.[1] ?? "";
    deviceType = /mobile/i.test(ua) ? "Mobile" : "Tablet";
  } else if (/windows nt ([\d.]+)/i.test(ua)) {
    os = "Windows";
    const ver = ua.match(/windows nt ([\d.]+)/i)?.[1];
    osVersion = ({ "10.0": "10/11", "6.3": "8.1", "6.2": "8", "6.1": "7" } as Record<string, string>)[ver ?? ""] ?? ver ?? "";
  } else if (/mac os x ([\d_.]+)/i.test(ua)) {
    os = "macOS";
    osVersion = (ua.match(/mac os x ([\d_.]+)/i)?.[1] ?? "").replace(/_/g, ".");
  } else if (/CrOS/i.test(ua)) {
    os = "ChromeOS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  if (/edg\/([\d.]+)/i.test(ua)) {
    browser = "Edge"; browserVersion = ua.match(/edg\/([\d.]+)/i)?.[1]?.split(".")[0] ?? "";
  } else if (/opr\/([\d.]+)/i.test(ua) || /opera\/([\d.]+)/i.test(ua)) {
    browser = "Opera"; browserVersion = ua.match(/(?:opr|opera)\/([\d.]+)/i)?.[1]?.split(".")[0] ?? "";
  } else if (/firefox\/([\d.]+)/i.test(ua)) {
    browser = "Firefox"; browserVersion = ua.match(/firefox\/([\d.]+)/i)?.[1]?.split(".")[0] ?? "";
  } else if (/chrome\/([\d.]+)/i.test(ua) && !/chromium/i.test(ua)) {
    browser = "Chrome"; browserVersion = ua.match(/chrome\/([\d.]+)/i)?.[1]?.split(".")[0] ?? "";
  } else if (/version\/([\d.]+).*safari/i.test(ua)) {
    browser = "Safari"; browserVersion = ua.match(/version\/([\d.]+)/i)?.[1]?.split(".")[0] ?? "";
  } else if (/safari\/([\d.]+)/i.test(ua)) {
    browser = "Safari";
  } else if (/msie ([\d.]+)/i.test(ua) || /trident/i.test(ua)) {
    browser = "Internet Explorer"; browserVersion = ua.match(/(?:msie |rv:)([\d.]+)/i)?.[1]?.split(".")[0] ?? "";
  }

  return { browser, browserVersion, os, osVersion, deviceType };
}

// GPS coordinates → exact address via BigDataCloud (free, no key)
async function reverseGeocode(lat: number, lon: number) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return null;
    const g = await res.json() as Record<string, any>;
    // Extract timezone from localityInfo.informative
    const tz = (g.localityInfo?.informative as any[])?.find((i: any) => i.description === "time zone")?.name ?? null;
    return {
      country:      g.countryName            ?? null,
      country_code: g.countryCode            ?? null,
      region:       g.principalSubdivision   ?? null,
      city:         g.city ?? g.locality     ?? null,
      postal_code:  g.postcode || null,
      latitude:     lat,
      longitude:    lon,
      timezone:     tz,
    };
  } catch {
    return null;
  }
}

// IP address → ISP + fallback geo (ipwho.is)
async function getIPInfo(ip: string) {
  try {
    if (!ip || ip === "unknown" || /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1)/i.test(ip)) return null;
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const g = await res.json() as Record<string, any>;
    if (!g.success) return null;
    return {
      isp: g.connection
        ? [g.connection.org, g.connection.isp].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" / ") || null
        : null,
      // Fallback geo fields (used only when no GPS)
      country:      g.country      ?? null,
      country_code: g.country_code ?? null,
      region:       g.region       ?? null,
      city:         g.city         ?? null,
      postal_code:  g.postal       ?? null,
      latitude:     g.latitude     ?? null,
      longitude:    g.longitude    ?? null,
      timezone:     g.timezone?.id ?? null,
    };
  } catch {
    return null;
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  try {
    const body = await request.json();
    const { user_id, latitude: gpsLat, longitude: gpsLon } = body as {
      user_id: string; latitude?: number; longitude?: number;
    };
    if (!user_id) return data({ error: "user_id required" }, { status: 400 });

    const env = context.cloudflare.env as any;
    const cf  = (request as any).cf as Record<string, string> | undefined;

    const ip =
      request.headers.get("CF-Connecting-IP") ||
      request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
      "unknown";

    const ipAlt =
      request.headers.get("CF-Connecting-IPv6") ||
      request.headers.get("True-Client-IP") ||
      null;

    const userAgent = request.headers.get("User-Agent") ?? "";
    const parsed    = parseUserAgent(userAgent);

    const hasGPS = typeof gpsLat === "number" && typeof gpsLon === "number";

    // Run geo lookups in parallel
    const [gpsGeo, ipInfo] = await Promise.all([
      hasGPS ? reverseGeocode(gpsLat!, gpsLon!) : Promise.resolve(null),
      getIPInfo(ip),
    ]);

    // GPS geo takes priority for location; IP info provides ISP + fallback
    const location = gpsGeo ?? {
      country:      cf?.country                                   ?? ipInfo?.country      ?? null,
      country_code: cf?.country                                   ?? ipInfo?.country_code ?? null,
      region:       cf?.region                                    ?? ipInfo?.region       ?? null,
      city:         cf?.city                                      ?? ipInfo?.city         ?? null,
      postal_code:  cf?.postalCode                                ?? ipInfo?.postal_code  ?? null,
      latitude:     cf?.latitude  ? parseFloat(cf.latitude)       : (ipInfo?.latitude  ?? null),
      longitude:    cf?.longitude ? parseFloat(cf.longitude)      : (ipInfo?.longitude ?? null),
      timezone:     cf?.timezone                                  ?? ipInfo?.timezone     ?? null,
    };

    const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
    await admin.from("user_sessions").insert({
      user_id,
      ip_address: ip,
      ip_alt: ipAlt,
      user_agent: userAgent,
      browser:         parsed.browser,
      browser_version: parsed.browserVersion,
      os:              parsed.os,
      os_version:      parsed.osVersion,
      device_type:     parsed.deviceType,
      isp:             ipInfo?.isp ?? (cf?.asOrganization ?? null),
      ...location,
    });

    return data({ ok: true });
  } catch {
    return data({ ok: false });
  }
}
