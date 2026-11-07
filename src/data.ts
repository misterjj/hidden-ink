import { SITE_NAMES, ficheSite, normalizeFicheUrl } from "../shared/fiche-url";
import { t } from "./i18n";
import { genericToStatblock, manualToStatblock } from "./manual";
import { Open5eError, loadCreature } from "./open5e";
import { parseStatblock } from "./parser";
import { daggerheartToStatblock, pf2eToStatblock } from "./systems";
import type { Statblock, TokenFiche } from "./types";

/**
 * AideDD est proposé dans toutes les langues ; VITE_AIDEDD=0 au build le retire.
 * Les fiches déjà liées restent lisibles dans tous les cas.
 */
export function aideddAvailable() {
  return import.meta.env.VITE_AIDEDD !== "0";
}

// v2 : les fiches retiennent leur jeu, pour leur mise en page.
const cacheKey = (url: string) => `fiche:v2:${url}`;

export class FicheError extends Error {}

function readCache(url: string): Statblock | null {
  try {
    const cached = localStorage.getItem(cacheKey(url));
    return cached ? (JSON.parse(cached) as Statblock) : null;
  } catch {
    return null;
  }
}

/** Charge la fiche d'un lien collé ; une fiche déjà vue reste disponible si le site tombe. */
export async function loadFromLink(input: string): Promise<Statblock> {
  const url = normalizeFicheUrl(input);
  if (!url) throw new FicheError(t("fiche.badLink"));
  const cached = readCache(url);
  if (cached) return cached;
  const site = { site: SITE_NAMES[ficheSite(url)] };

  let response: Response;
  try {
    response = await fetch(`/api/fiche?url=${encodeURIComponent(url)}`);
  } catch {
    throw new FicheError(t("fiche.siteUnreachable", site));
  }
  if (!response.ok) throw new FicheError(t("fiche.siteDown", site));
  const statblock = parseStatblock(await response.text(), url);
  if (!statblock) throw new FicheError(t("fiche.siteUnreadable", site));
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
      return loadFromLink(fiche.url);
    case "generic":
      return genericToStatblock(fiche.fiche);
    case "pf2e":
      return pf2eToStatblock(fiche.fiche);
    case "daggerheart":
      return daggerheartToStatblock(fiche.fiche);
  }
}
