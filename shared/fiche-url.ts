// Code partagé entre le navigateur et le relais serveur.

/** Sites dont on sait lire les fiches. */
export type FicheSite = "aidedd" | "aon" | "daggerheart";

export const SITE_NAMES: Record<FicheSite, string> = {
  aidedd: "AideDD",
  aon: "Archives of Nethys",
  daggerheart: "Daggerheart SRD",
};

const DAGGERHEART_SRD = "https://seansbox.github.io/daggerheart-srd";

/** Site d'une URL déjà normalisée. */
export function ficheSite(url: string): FicheSite {
  if (url.startsWith("https://2e.aonprd.com/")) return "aon";
  if (url.startsWith(`${DAGGERHEART_SRD}/`)) return "daggerheart";
  return "aidedd";
}

/**
 * Transforme ce que colle l'utilisateur en URL canonique d'une fiche :
 * AideDD (D&D), Archives of Nethys (Pathfinder 2e) ou le SRD Daggerheart.
 * L'URL est reconstruite de zéro : le relais ne peut donc atteindre que les
 * fiches de ces sites, jamais une adresse arbitraire.
 */
export function normalizeFicheUrl(input: string): string | null {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (host === "2e.aonprd.com") return normalizeAon(url);
  if (host === "seansbox.github.io") return normalizeDaggerheart(url);
  if (!["www.aidedd.org", "aidedd.org"].includes(host)) {
    return null;
  }

  const isSlug = (value: string | null): value is string =>
    value !== null && /^[\p{L}\p{N}][\p{L}\p{N}'’_-]*$/u.test(value);

  if (url.pathname === "/dnd/monstres.php") {
    for (const param of ["vf", "vo"]) {
      const slug = url.searchParams.get(param);
      if (isSlug(slug)) {
        return `https://www.aidedd.org/dnd/monstres.php?${param}=${encodeURIComponent(slug)}`;
      }
    }
    return null;
  }

  // Monstres 2024 : /monster/<nom> (anglais) ou /monster/<langue>/<nom>
  const match = url.pathname.match(/^\/monster\/(?:([a-z]{2})\/)?([^/]+)\/?$/);
  if (match) {
    let slug: string;
    try {
      slug = decodeURIComponent(match[2]);
    } catch {
      return null;
    }
    if (isSlug(slug)) {
      const language = match[1] ? `${match[1]}/` : "";
      return `https://www.aidedd.org/monster/${language}${encodeURIComponent(slug)}`;
    }
  }
  return null;
}

/** Créature d'Archives of Nethys : https://2e.aonprd.com/Monsters.aspx?ID=3330, en version élite ou faible. */
function normalizeAon(url: URL): string | null {
  if (url.pathname.toLowerCase() !== "/monsters.aspx") return null;
  const id = url.searchParams.get("ID");
  if (!id || !/^\d{1,6}$/.test(id)) return null;
  const variant = url.searchParams.get("Elite") === "true" ? "&Elite=true" : url.searchParams.get("Weak") === "true" ? "&Weak=true" : "";
  return `https://2e.aonprd.com/Monsters.aspx?ID=${Number(id)}${variant}`;
}

/** Adversaire ou environnement du SRD Daggerheart : …/daggerheart-srd/adversaries/Bear/ */
function normalizeDaggerheart(url: URL): string | null {
  const match = url.pathname.match(/^\/daggerheart-srd\/(adversaries|environments)\/([^/]+)\/?$/);
  if (!match) return null;
  let name: string;
  try {
    name = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (!/^[\p{L}\p{N}][\p{L}\p{N} '’:,().&!-]{0,80}$/u.test(name)) return null;
  return `${DAGGERHEART_SRD}/${match[1]}/${encodeURIComponent(name)}/`;
}

/** Adresse réellement demandée au site. */
function upstreamUrl(url: string) {
  // Sans ce paramètre, Archives of Nethys renvoie une ancienne créature vers sa version remasterisée.
  return ficheSite(url) === "aon" ? `${url}&NoRedirect=1` : url;
}

const MAX_PAGE_BYTES = 1024 * 1024;

function reply(body: string, status: number, cache = false): Response {
  return new Response(body, {
    status,
    headers: {
      // Jamais text/html : la page distante ne doit pas s'exécuter sur notre domaine.
      "Content-Type": "text/plain; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": cache ? "public, max-age=86400" : "no-store",
    },
  });
}

/** Récupère une fiche (les navigateurs ne le peuvent pas : ces sites n'autorisent pas les autres domaines). */
export async function handleFicheRequest(
  requestUrl: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const target = normalizeFicheUrl(requestUrl.searchParams.get("url") ?? "");
  if (!target) return reply("URL non autorisée", 400);

  let upstream: Response;
  try {
    upstream = await fetchImpl(upstreamUrl(target), {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "hidden-ink/1.0" },
    });
  } catch {
    return reply(`${SITE_NAMES[ficheSite(target)]} ne répond pas`, 502);
  }
  if (upstream.status !== 200) {
    return reply(`${SITE_NAMES[ficheSite(target)]} a répondu ${upstream.status}`, 502);
  }
  const html = await upstream.text();
  if (html.length > MAX_PAGE_BYTES) return reply("Page trop volumineuse", 502);
  return reply(html, 200, true);
}
