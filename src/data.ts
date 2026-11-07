import { normalizeFicheUrl } from "../shared/aidedd";
import { currentLanguage, t } from "./i18n";
import { manualToStatblock } from "./manual";
import { Open5eError, loadCreature } from "./open5e";
import { parseStatblock } from "./parser";
import type { Statblock, TokenFiche } from "./types";

/**
 * AideDD (fiches en français) est proposé quand l'interface est en français.
 * VITE_AIDEDD=0 au build le retire, VITE_AIDEDD=1 le propose dans toutes les langues.
 * Les fiches déjà liées restent lisibles dans tous les cas.
 */
export function aideddAvailable() {
  const flag = import.meta.env.VITE_AIDEDD;
  if (flag === "0") return false;
  return flag === "1" || currentLanguage() === "fr";
}

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
  if (!url) throw new FicheError(t("fiche.badLink"));
  const cached = readCache(url);
  if (cached) return cached;

  let response: Response;
  try {
    response = await fetch(`/api/fiche?url=${encodeURIComponent(url)}`);
  } catch {
    throw new FicheError(t("fiche.aideddUnreachable"));
  }
  if (!response.ok) throw new FicheError(t("fiche.aideddDown"));
  const statblock = parseStatblock(await response.text(), url);
  if (!statblock) throw new FicheError(t("fiche.aideddUnreadable"));
  try {
    localStorage.setItem(cacheKey(url), JSON.stringify(statblock));
  } catch {
    // Cache plein ou indisponible : la fiche reste affichable.
  }
  return statblock;
}

export async function resolveFiche(fiche: TokenFiche): Promise<Statblock> {
  switch (fiche.kind) {
    case "manual":
      return manualToStatblock(fiche.fiche);
    case "open5e":
      try {
        return await loadCreature(fiche.key);
      } catch (error) {
        throw new FicheError(error instanceof Open5eError ? error.message : t("window.error"));
      }
    case "link":
      return loadFromAidedd(fiche.url);
  }
}
