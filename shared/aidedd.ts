// Code partagé entre le navigateur et le relais serveur.

/**
 * Transforme ce que colle l'utilisateur en URL AideDD canonique.
 * L'URL est reconstruite de zéro : le relais ne peut donc atteindre que les
 * fiches de monstres d'aidedd.org, jamais une adresse arbitraire.
 */
export function normalizeFicheUrl(input: string): string | null {
  const raw = input.trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (!["www.aidedd.org", "aidedd.org"].includes(url.hostname.toLowerCase())) {
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

const MAX_PAGE_BYTES = 512 * 1024;

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

/** Récupère une fiche AideDD (les navigateurs ne le peuvent pas : pas de CORS). */
export async function handleFicheRequest(
  requestUrl: URL,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const target = normalizeFicheUrl(requestUrl.searchParams.get("url") ?? "");
  if (!target) return reply("URL non autorisée", 400);

  let upstream: Response;
  try {
    upstream = await fetchImpl(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "fiches-monstres-owlbear/1.0" },
    });
  } catch {
    return reply("AideDD ne répond pas", 502);
  }
  if (upstream.status !== 200) {
    return reply(`AideDD a répondu ${upstream.status}`, 502);
  }
  const html = await upstream.text();
  if (html.length > MAX_PAGE_BYTES) return reply("Page trop volumineuse", 502);
  return reply(html, 200, true);
}
