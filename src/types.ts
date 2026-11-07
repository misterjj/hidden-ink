// Identifiant d'origine, gardé après le renommage en Hidden Ink : les fiches et notes déjà posées en dépendent.
export const PLUGIN_ID = "fiches-monstres-owlbear";
export const METADATA_KEY = `${PLUGIN_ID}/fiche`;
/** Note secrète posée sur un token, chiffrée comme le reste. */
export const TOKEN_NOTE_KEY = `${PLUGIN_ID}/note-jeton`;
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

/** Jeu de la fiche : décide de sa mise en page. Absent : D&D. */
export type SheetSystem = "dnd" | "pf2e" | "daggerheart";

/** Bloc d'une fiche Pathfinder : haut, défense, puis vitesse et attaques. */
export type SheetPlace = "top" | "defense" | "offense";

/** Fiche prête à afficher. Tous les champs *Html sont déjà assainis. */
export interface Statblock {
  system?: SheetSystem;
  name: string;
  type: string;
  /** Traits affichés en pastilles sous le type (Pathfinder 2e), en texte brut. */
  tags?: string[];
  props: { label: string; valueHtml: string }[];
  abilities: Ability[];
  sections: { title: string; entries: string[]; place?: SheetPlace }[];
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

/** Fiche libre, pour n'importe quel jeu : du texte brut, échappé à l'affichage. */
export interface GenericFiche {
  name: string;
  /** Sous-titre : type, niveau, rôle… */
  type: string;
  /** Une ligne par propriété, « Libellé : valeur » */
  props: string;
  /** Capacités, voir parseManualBody */
  body: string;
}

export type ActionCost = "" | "1" | "2" | "3" | "reaction" | "free";
export type Pf2eRarity = "common" | "uncommon" | "rare" | "unique";

/** Saisie guidée d'une créature Pathfinder 2e : du texte brut, échappé à l'affichage. */
export interface Pf2eFiche {
  name: string;
  level: string;
  rarity: Pf2eRarity;
  size: string;
  /** Traits séparés par des virgules */
  traits: string;
  perception: string;
  languages: string;
  skills: string;
  /** Modificateurs FOR, DEX, CON, INT, SAG, CHA */
  attributes: string[];
  items: string;
  ac: string;
  /** Vigueur, Réflexes, Volonté */
  saves: string[];
  hp: string;
  immunities: string;
  weaknesses: string;
  resistances: string;
  speed: string;
  strikes: { ranged: boolean; name: string; bonus: string; traits: string; damage: string }[];
  /** Une ligne par liste de sorts */
  spells: string;
  abilities: { name: string; actions: ActionCost; traits: string; text: string; place: SheetPlace }[];
}

export type DaggerheartFeatureKind = "Action" | "Reaction" | "Passive";

/** Saisie guidée d'un adversaire ou d'un environnement Daggerheart. */
export interface DaggerheartFiche {
  name: string;
  environment: boolean;
  tier: string;
  type: string;
  description: string;
  /** Motivations et tactiques, ou pulsions d'un environnement */
  motives: string;
  difficulty: string;
  major: string;
  severe: string;
  hp: string;
  stress: string;
  atk: string;
  weapon: string;
  range: string;
  damage: string;
  experience: string;
  /** Adversaires possibles d'un environnement */
  adversaries: string;
  features: { name: string; kind: DaggerheartFeatureKind; text: string }[];
}

/** Ce qui est stocké sur le token, chiffré (voir crypto.ts). */
export type TokenFiche =
  /** Lien d'une fiche AideDD, Archives of Nethys ou SRD Daggerheart (voir shared/fiche-url.ts). */
  | { kind: "link"; url: string }
  | { kind: "manual"; fiche: ManualFiche }
  /** Clé Open5e, par exemple « srd_goblin ». */
  | { kind: "open5e"; key: string }
  | { kind: "generic"; fiche: GenericFiche }
  | { kind: "pf2e"; fiche: Pf2eFiche }
  | { kind: "daggerheart"; fiche: DaggerheartFiche };

/**
 * « link » colle un lien AideDD, « aon » et « dhsrd » un lien de ces sites.
 * « manual », « pf2e » et « daggerheart » sont les saisies guidées de chaque jeu.
 */
export type EditorTab = "choice" | "open5e" | "link" | "aon" | "dhsrd" | "manual" | "pf2e" | "daggerheart" | "generic";

/** Note secrète d'un token : du markdown. */
export interface TokenNote {
  text: string;
}

export type Message =
  | { type: "open"; itemId: string }
  | { type: "edit"; itemId: string; tab?: EditorTab }
  | { type: "close"; itemId: string }
  /** Ouvre la note secrète du token, à côté de lui. */
  | { type: "token-note"; itemId: string }
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
