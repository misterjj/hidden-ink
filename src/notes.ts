import { PLUGIN_ID, clampPosition } from "./types";

export const NOTE_KEY = `${PLUGIN_ID}/note`;
export const NOTE_CHANNEL = `${PLUGIN_ID}/notes`;
export const NOTE_POPOVER_ID = `${PLUGIN_ID}/note`;
export const LIST_POPOVER_ID = `${PLUGIN_ID}/notes-liste`;
export const NOTE_TOOL_ID = `${PLUGIN_ID}/outil-notes`;
export const SHOW_TITLES_KEY = `${PLUGIN_ID}/notes-titres`;

export const NOTE_WIDTH = 340;
export const NOTE_MAX_HEIGHT = 360;
/** Les métadonnées sont synchronisées dans la scène : une note reste courte. */
export const MAX_NOTE_BYTES = 8 * 1024;

/**
 * Le picto est un rond de 128 px affiché sur une demi-case. L'image est plus haute que le rond :
 * Owlbear centre l'étiquette sur son bord bas, et la zone transparente la fait passer sous le rond.
 */
export const NOTE_IMAGE_WIDTH = 128;
export const NOTE_IMAGE_HEIGHT = 184;
export const NOTE_IMAGE_DPI = 256;
/** Le centre du rond, pour que la note soit posée exactement là où on a cliqué. */
export const NOTE_IMAGE_OFFSET = { x: 64, y: 64 };
/** Au-delà, le titre sur la carte est coupé. Il reste entier dans la note. */
export const MAX_LABEL_LENGTH = 32;

export const NOTE_TYPES = {
  piege: "Piège",
  objet: "Objet caché",
  mecanique: "Mécanique",
  libre: "Note libre",
} as const;

export type NoteType = keyof typeof NOTE_TYPES;
export const NOTE_TYPE_IDS = Object.keys(NOTE_TYPES) as NoteType[];

/** Ce qui est stocké sur le picto. Du texte brut, jamais interprété comme du HTML. */
export interface MapNote {
  type: NoteType;
  title: string;
  text: string;
  done?: boolean;
}

export type NoteMessage =
  | { type: "show"; itemId: string }
  | { type: "hide" }
  | { type: "editing"; value: boolean };

export function isNoteType(value: unknown): value is NoteType {
  return typeof value === "string" && Object.hasOwn(NOTE_TYPES, value);
}

export function isMapNote(value: unknown): value is MapNote {
  if (!value || typeof value !== "object") return false;
  const note = value as Partial<MapNote>;
  return (
    typeof note.title === "string" &&
    typeof note.text === "string" &&
    isNoteType(note.type)
  );
}

export const noteImageUrl = (origin: string, note: Pick<MapNote, "type" | "done">) =>
  `${origin}/notes/${note.type}${note.done ? "-fait" : ""}.png`;

/** Texte affiché sous le picto. */
export function noteLabel(note: Pick<MapNote, "title">, show: boolean) {
  if (!show) return "";
  const characters = Array.from(note.title);
  return characters.length > MAX_LABEL_LENGTH
    ? `${characters.slice(0, MAX_LABEL_LENGTH - 1).join("").trimEnd()}…`
    : note.title;
}

/** Sans titre, la note prend le nom de son type. Renvoie une erreur si elle est vide ou trop longue. */
export function buildNote(
  type: NoteType,
  rawTitle: string,
  rawText: string,
  done?: boolean,
): { note: MapNote } | { error: string } {
  const title = rawTitle.trim();
  const text = rawText.trim();
  if (!title && !text) return { error: "Écris au moins un titre ou un texte." };
  const note: MapNote = { type, title: title || NOTE_TYPES[type], text };
  if (done) note.done = true;
  const size = new TextEncoder().encode(JSON.stringify(note)).length;
  if (size > MAX_NOTE_BYTES) {
    return { error: `Note trop longue (${Math.ceil(size / 1024)} ko, 8 ko maximum).` };
  }
  return { note };
}

export interface ListedNote {
  id: string;
  note: MapNote;
}

/** Notes à afficher : celles à faire d'abord, puis par titre. */
export function filterNotes(notes: ListedNote[], type: NoteType | "", search: string) {
  const wanted = search.trim().toLocaleLowerCase("fr");
  return notes
    .filter(
      ({ note }) =>
        (!type || note.type === type) &&
        (!wanted || `${note.title}\n${note.text}`.toLocaleLowerCase("fr").includes(wanted)),
    )
    .sort(
      (a, b) =>
        Number(Boolean(a.note.done)) - Number(Boolean(b.note.done)) ||
        a.note.title.localeCompare(b.note.title, "fr"),
    );
}

const PICTO_GAP = 32;

/** La note s'ouvre à droite du picto, ou à gauche s'il n'y a pas la place. */
export function notePopoverPosition(
  point: { x: number; y: number },
  viewportWidth: number,
  viewportHeight: number,
) {
  const fitsRight = point.x + PICTO_GAP + NOTE_WIDTH <= viewportWidth - 8;
  return clampPosition(
    fitsRight ? point.x + PICTO_GAP : point.x - PICTO_GAP - NOTE_WIDTH,
    point.y - 40,
    NOTE_WIDTH,
    NOTE_MAX_HEIGHT,
    viewportWidth,
    viewportHeight,
  );
}

/** Position de la vue qui place ce point de la carte au centre de l'écran. */
export function centeredView(
  point: { x: number; y: number },
  scale: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  return {
    x: viewportWidth / 2 - point.x * scale,
    y: viewportHeight / 2 - point.y * scale,
  };
}
