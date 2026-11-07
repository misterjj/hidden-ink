import OBR, { buildImage, buildText, isImage, type Item } from "@owlbear-rodeo/sdk";
import { MissingKeyError, isSealed, sealWith, tryReveal, writeKey, type Sealed } from "./crypto";
import { t } from "./i18n";
import {
  NOTE_IMAGE_DPI,
  NOTE_IMAGE_HEIGHT,
  NOTE_IMAGE_OFFSET,
  NOTE_IMAGE_WIDTH,
  NOTE_ITEM_NAME,
  NOTE_KEY,
  SHOW_TITLES_KEY,
  isMapNote,
  isNoteItem,
  noteImageUrl,
  noteLabel,
  type MapNote,
} from "./notes";
import { METADATA_KEY, PLUGIN_ID, TOKEN_NOTE_KEY } from "./types";

/** Les titres sont affichés tant que le MJ ne les a pas masqués dans cette scène. */
export async function getShowTitles() {
  const metadata = await OBR.scene.getMetadata();
  return metadata[SHOW_TITLES_KEY] !== false;
}

/** Une note de carte en clair, ou `undefined` si elle est chiffrée avec une autre clé. */
export async function readNote(item: Item | undefined): Promise<MapNote | undefined> {
  const note = await tryReveal<MapNote>(item?.metadata[NOTE_KEY]);
  return isMapNote(note) ? note : undefined;
}

// --- Chiffrement des données écrites par une version plus ancienne ------------------

const SEALED_KEYS = [METADATA_KEY, NOTE_KEY, TOKEN_NOTE_KEY];
const hasPlainData = (item: Item) =>
  SEALED_KEYS.some((key) => item.metadata[key] !== undefined && !isSealed(item.metadata[key]));
let warnedMissingKey = false;

/** Chiffre ce qui est encore en clair dans la scène. Rien n'est perdu : seule la forme change. */
async function sealPlainData(items: Item[]) {
  const plain = items.filter(hasPlainData);
  if (!plain.length) return false;
  let key;
  try {
    key = await writeKey();
  } catch (error) {
    if (error instanceof MissingKeyError && !warnedMissingKey) {
      warnedMissingKey = true;
      await OBR.notification.show(t("crypto.noKey"), "WARNING");
    }
    return false;
  }
  const sealed = new Map<string, Record<string, Sealed>>();
  for (const item of plain) {
    const values: Record<string, Sealed> = {};
    for (const metadataKey of SEALED_KEYS) {
      const value = item.metadata[metadataKey];
      if (value !== undefined && !isSealed(value)) values[metadataKey] = await sealWith(key, value);
    }
    sealed.set(item.id, values);
  }
  await OBR.scene.items.updateItems(
    plain.map((item) => item.id),
    (drafts) => {
      for (const draft of drafts) Object.assign(draft.metadata, sealed.get(draft.id));
    },
  );
  return true;
}

// --- Pictos de note : image à jour, et plus aucun texte lisible sur l'objet partagé --

async function fixNoteItems(items: Item[], notes: Map<string, MapNote>) {
  const isStale = (item: Item) => {
    if (!isImage(item)) return false;
    // Titre écrit sur l'objet partagé par une version plus ancienne.
    if (item.text.plainText !== "" || item.name !== NOTE_ITEM_NAME) return true;
    const note = notes.get(item.id);
    return (
      note !== undefined &&
      (item.image.url !== noteImageUrl(location.origin, note) || item.image.height !== NOTE_IMAGE_HEIGHT)
    );
  };
  const stale = items.filter((item) => isNoteItem(item) && isStale(item));
  if (!stale.length) return;
  await OBR.scene.items.updateItems(stale, (drafts) => {
    for (const draft of drafts) {
      if (!isImage(draft)) continue;
      draft.name = NOTE_ITEM_NAME;
      draft.text.plainText = "";
      const note = notes.get(draft.id);
      if (!note) continue;
      draft.image.url = noteImageUrl(location.origin, note);
      draft.image.width = NOTE_IMAGE_WIDTH;
      draft.image.height = NOTE_IMAGE_HEIGHT;
      draft.grid = { dpi: NOTE_IMAGE_DPI, offset: NOTE_IMAGE_OFFSET };
    }
  });
}

// --- Titres et badges : dessinés chez le MJ seulement --------------------------------

const TITLE_PREFIX = `${PLUGIN_ID}/titre/`;
const BADGE_PREFIX = `${PLUGIN_ID}/badge/`;

interface Wanted {
  id: string;
  /** Ce qui, s'il change, oblige à refaire l'objet. */
  signature: string;
  build: () => Item;
}

const drawn = new Map<string, string>();

async function drawLocal(wanted: Wanted[]) {
  const existing = await OBR.scene.local.getItems(
    (item) => item.id.startsWith(TITLE_PREFIX) || item.id.startsWith(BADGE_PREFIX),
  );
  const byId = new Map(wanted.map((entry) => [entry.id, entry]));
  const outdated = existing
    .filter((item) => drawn.get(item.id) !== byId.get(item.id)?.signature)
    .map((item) => item.id);
  if (outdated.length) {
    await OBR.scene.local.deleteItems(outdated);
    outdated.forEach((id) => drawn.delete(id));
  }
  const kept = new Set(existing.map((item) => item.id).filter((id) => !outdated.includes(id)));
  const missing = wanted.filter(({ id }) => !kept.has(id));
  if (missing.length) {
    await OBR.scene.local.addItems(missing.map(({ build }) => build()));
    missing.forEach(({ id, signature }) => drawn.set(id, signature));
  }
}

function titleItem(note: Item, label: string, dpi: number): Wanted {
  const position = { x: note.position.x - 1.5 * dpi, y: note.position.y + 0.3 * dpi };
  return {
    id: TITLE_PREFIX + note.id,
    signature: `${label}|${position.x}|${position.y}|${dpi}`,
    build: () =>
      buildText()
        .id(TITLE_PREFIX + note.id)
        .textType("PLAIN")
        .plainText(label)
        .position(position)
        .width(3 * dpi)
        .height("AUTO")
        .textAlign("CENTER")
        .fontSize(Math.round(0.2 * dpi))
        .fontWeight(600)
        .fillColor("#ffffff")
        .strokeColor("#000000")
        .strokeWidth(Math.max(1, Math.round(0.02 * dpi)))
        .layer("TEXT")
        .locked(true)
        .disableHit(true)
        .attachedTo(note.id)
        // Le picto est masqué aux joueurs : le titre doit rester affiché chez le MJ.
        .disableAttachmentBehavior(["VISIBLE"])
        .build(),
  };
}

function badgeItem(token: Item, dpi: number): Wanted {
  const position = { x: token.position.x + 0.32 * dpi, y: token.position.y - 0.32 * dpi };
  return {
    id: BADGE_PREFIX + token.id,
    signature: `${position.x}|${position.y}|${dpi}`,
    build: () =>
      buildImage(
        { url: `${location.origin}/badge.svg`, mime: "image/svg+xml", width: 128, height: 128 },
        // Le badge fait un quart de case.
        { dpi: 128 / 0.25, offset: { x: 64, y: 64 } },
      )
        .id(BADGE_PREFIX + token.id)
        .position(position)
        .layer("ATTACHMENT")
        .locked(true)
        .disableHit(true)
        .attachedTo(token.id)
        .disableAttachmentBehavior(["VISIBLE"])
        .build(),
  };
}

async function syncOnce() {
  if ((await OBR.player.getRole()) !== "GM" || !(await OBR.scene.isReady())) return;
  let items = await OBR.scene.items.getItems();
  if (await sealPlainData(items)) items = await OBR.scene.items.getItems();

  const noteItems = items.filter(isNoteItem);
  const notes = new Map<string, MapNote>();
  for (const item of noteItems) {
    const note = await readNote(item);
    if (note) notes.set(item.id, note);
  }
  await fixNoteItems(noteItems, notes);

  const [show, dpi] = await Promise.all([getShowTitles(), OBR.scene.grid.getDpi()]);
  const wanted: Wanted[] = [];
  if (show) {
    for (const item of noteItems) {
      const note = notes.get(item.id);
      // Note chiffrée avec une autre clé : un cadenas à la place du titre.
      const label = note ? noteLabel(note, true) : "🔒";
      if (label) wanted.push(titleItem(item, label, dpi));
    }
  }
  for (const item of items) {
    if (item.metadata[TOKEN_NOTE_KEY] !== undefined) wanted.push(badgeItem(item, dpi));
  }
  await drawLocal(wanted);
}

let running: Promise<void> | undefined;
let again = false;

/**
 * Remet la scène en ordre chez le MJ : données chiffrées, pictos sans texte lisible,
 * titres et badges dessinés en local. Les appels rapprochés n'en font qu'un.
 */
export function syncNoteItems(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce().catch((error) => console.warn("Hidden Ink :", error));
    } while (again);
  })().finally(() => {
    running = undefined;
  });
  return running;
}

/** Un changement de scène vide les objets locaux : on oublie ce qui avait été dessiné. */
export function forgetDrawn() {
  drawn.clear();
}

export async function toggleTitles() {
  const show = !(await getShowTitles());
  await OBR.scene.setMetadata({ [SHOW_TITLES_KEY]: show });
  await syncNoteItems();
}
