import { normalizeFicheUrl } from "../shared/aidedd";
import { manualToStatblock } from "./manual";
import { parseStatblock } from "./parser";
import type { Statblock, TokenFiche } from "./types";

const cacheKey = (url: string) => `fiche:v1:${url}`;

export class FicheError extends Error {}

function readCache(url: string): Statblock | null {
  try {
    const cached = localStorage.getItem(cacheKey(url));
    return cached ? (JSON.parse(cached) as Statblock) : null;
  } catch {
    return null;
  }
}

/** Charge une fiche AideDD ; une fiche déjà vue reste disponible si le site tombe. */
export async function loadFromAidedd(input: string): Promise<Statblock> {
  const url = normalizeFicheUrl(input);
  if (!url) {
    throw new FicheError(
      "Ce lien n'est pas une fiche de monstre AideDD. Exemple : https://www.aidedd.org/dnd/monstres.php?vf=gobelin",
    );
  }
  const cached = readCache(url);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(`/api/fiche?url=${encodeURIComponent(url)}`);
  } catch {
    throw new FicheError("Impossible de joindre AideDD pour le moment.");
  }
  if (!response.ok) {
    throw new FicheError("AideDD n'est pas disponible pour le moment.");
  }
  const statblock = parseStatblock(await response.text(), url);
  if (!statblock) {
    throw new FicheError("Cette page AideDD ne contient pas de fiche lisible.");
  }
  try {
    localStorage.setItem(cacheKey(url), JSON.stringify(statblock));
  } catch {
    // Cache plein ou indisponible : la fiche reste affichable.
  }
  return statblock;
}

export async function resolveFiche(fiche: TokenFiche): Promise<Statblock> {
  return fiche.kind === "manual"
    ? manualToStatblock(fiche.fiche)
    : loadFromAidedd(fiche.url);
}
