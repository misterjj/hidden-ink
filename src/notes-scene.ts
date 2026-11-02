import OBR, { isImage } from "@owlbear-rodeo/sdk";
import {
  NOTE_IMAGE_DPI,
  NOTE_IMAGE_HEIGHT,
  NOTE_IMAGE_OFFSET,
  NOTE_IMAGE_WIDTH,
  NOTE_KEY,
  SHOW_TITLES_KEY,
  isMapNote,
  noteImageUrl,
  noteLabel,
  type MapNote,
} from "./notes";

/** Les titres sont affichés tant que le MJ ne les a pas masqués dans cette scène. */
export async function getShowTitles() {
  const metadata = await OBR.scene.getMetadata();
  return metadata[SHOW_TITLES_KEY] !== false;
}

/**
 * Remet chaque picto en accord avec sa note : image (son adresse change à la mise en ligne,
 * son format a pu changer) et titre (une note peut venir d'une scène où ils sont masqués).
 */
export async function syncNoteItems(showTitles?: boolean) {
  const show = showTitles ?? (await getShowTitles());
  const notes = await OBR.scene.items.getItems((item) => isMapNote(item.metadata[NOTE_KEY]));
  const isStale = (item: (typeof notes)[number]) => {
    if (!isImage(item)) return false;
    const note = item.metadata[NOTE_KEY] as MapNote;
    return (
      item.image.url !== noteImageUrl(location.origin, note) ||
      item.image.height !== NOTE_IMAGE_HEIGHT ||
      item.text.plainText !== noteLabel(note, show)
    );
  };
  const stale = notes.filter(isStale);
  if (!stale.length) return;
  await OBR.scene.items.updateItems(stale, (drafts) => {
    for (const draft of drafts) {
      if (!isImage(draft)) continue;
      const note = draft.metadata[NOTE_KEY] as MapNote;
      draft.image.url = noteImageUrl(location.origin, note);
      draft.image.width = NOTE_IMAGE_WIDTH;
      draft.image.height = NOTE_IMAGE_HEIGHT;
      draft.grid = { dpi: NOTE_IMAGE_DPI, offset: NOTE_IMAGE_OFFSET };
      draft.text.type = "PLAIN";
      draft.text.plainText = noteLabel(note, show);
    }
  });
}

export async function toggleTitles() {
  const show = !(await getShowTitles());
  await OBR.scene.setMetadata({ [SHOW_TITLES_KEY]: show });
  await syncNoteItems(show);
}
