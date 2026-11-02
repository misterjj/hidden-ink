export const PLUGIN_ID = "fiches-monstres-owlbear";
export const METADATA_KEY = `${PLUGIN_ID}/fiche`;
export const CHANNEL = `${PLUGIN_ID}/messages`;
export const EDITOR_POPOVER_ID = `${PLUGIN_ID}/editor`;
/** Identifiant fixe : il ne peut jamais exister plus d'un cadre de déplacement à la fois. */
export const FRAME_ID = `${PLUGIN_ID}/cadre`;
export const windowPopoverId = (itemId: string) =>
  `${PLUGIN_ID}/fenetre/${itemId}`;

/** Fenêtre réduite : la barre de titre et la ligne de pictos. */
export const MINI_WIDTH = 320;
export const MINI_HEIGHT = 68;
/** Place gardée sous une fenêtre réduite pour afficher le détail d'un picto. */
export const MINI_PANEL_RESERVE = 240;
export const MINI_PANEL_MAX = 420;
const MARGIN = 8;

/** Garde une fenêtre entièrement visible, avec la même marge qu'Owlbear à l'ouverture. */
export function clampPosition(
  left: number,
  top: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return {
    left: Math.max(MARGIN, Math.min(left, viewportWidth - width - MARGIN)),
    top: Math.max(MARGIN, Math.min(top, viewportHeight - height - MARGIN)),
  };
}

/** Position finale d'une fenêtre ; une fenêtre réduite garde de la place dessous pour le détail des pictos. */
export function clampWindow(
  left: number,
  top: number,
  width: number,
  height: number,
  minimized: boolean,
  viewportWidth: number,
  viewportHeight: number,
) {
  return clampPosition(
    left,
    top,
    width,
    minimized ? height + MINI_PANEL_RESERVE : height,
    viewportWidth,
    viewportHeight,
  );
}

export interface Ability {
  label: string;
  score: string;
  mod: string;
  save?: string;
}

/** Fiche prête à afficher. Tous les champs *Html sont déjà assainis. */
export interface Statblock {
  name: string;
  type: string;
  props: { label: string; valueHtml: string }[];
  abilities: Ability[];
  sections: { title: string; entries: string[] }[];
  source: string;
  extrasHtml: string;
}

/** Saisie à la main : uniquement du texte brut, échappé à l'affichage. */
export interface ManualFiche {
  name: string;
  type: string;
  ac: string;
  hp: string;
  speed: string;
  /** FOR, DEX, CON, INT, SAG, CHA */
  abilities: string[];
  /** Une ligne par propriété, « Libellé : valeur » */
  props: string;
  /** Capacités et actions, voir parseManualBody */
  body: string;
}

/** Ce qui est stocké sur le token. */
export type TokenFiche =
  | { kind: "link"; url: string }
  | { kind: "manual"; fiche: ManualFiche };

export type Message =
  | { type: "open"; itemId: string }
  | { type: "edit"; itemId: string; tab?: "link" | "manual" }
  | { type: "close"; itemId: string }
  | { type: "drag-start"; itemId: string; dragId: string }
  | { type: "drag-alive"; dragId: string }
  | { type: "drag-cancel"; itemId: string; dragId: string }
  | {
      type: "move";
      itemId: string;
      dragId: string;
      dx: number;
      dy: number;
      width: number;
      height: number;
      scroll: number;
    }
  | { type: "resized"; itemId: string; width: number; height: number }
  | { type: "minimize"; itemId: string; minimized: boolean; scroll: number };
