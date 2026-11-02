import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { escapeHtml } from "./manual";
import {
  LIST_POPOVER_ID,
  NOTE_CHANNEL,
  NOTE_KEY,
  NOTE_TYPES,
  NOTE_TYPE_IDS,
  centeredView,
  filterNotes,
  isMapNote,
  type ListedNote,
  type NoteMessage,
  type NoteType,
} from "./notes";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
let items: Item[] = [];
let filter: NoteType | "" = "";
let search = "";

function renderRows() {
  const notes: ListedNote[] = items.flatMap((item) => {
    const note = item.metadata[NOTE_KEY];
    return isMapNote(note) ? [{ id: item.id, note }] : [];
  });
  const rows = filterNotes(notes, filter, search);
  app.querySelector<HTMLElement>("#rows")!.innerHTML = rows.length
    ? rows
        .map(
          ({ id, note }) => `
      <button type="button" class="note-row note-type-${note.type} ${note.done ? "note-done" : ""}" data-id="${escapeHtml(id)}">
        <img src="/notes/${note.type}.svg" alt="${escapeHtml(NOTE_TYPES[note.type])}" width="24" height="24" />
        <span>
          <strong>${escapeHtml(note.title)}</strong>
          <small>${escapeHtml(note.text.split("\n", 1)[0])}</small>
        </span>
      </button>`,
        )
        .join("")
    : `<p class="hint note-empty">${
        notes.length
          ? "Aucune note ne correspond."
          : "Aucune note dans cette scène. Choisis un type, puis clique sur la carte."
      }</p>`;
}

async function goTo(itemId: string) {
  const item = items.find(({ id }) => id === itemId);
  if (!item) return;
  const [scale, width, height, selection] = await Promise.all([
    OBR.viewport.getScale(),
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
    OBR.player.getSelection(),
  ]);
  // La note s'ouvre après le déplacement, pour se placer à côté du picto.
  await OBR.viewport.animateTo({
    position: centeredView(item.position, scale, width, height),
    scale,
  });
  if (selection?.length === 1 && selection[0] === itemId) {
    const message: NoteMessage = { type: "show", itemId };
    await OBR.broadcast.sendMessage(NOTE_CHANNEL, message, { destination: "LOCAL" });
  } else {
    await OBR.player.select([itemId], true);
  }
}

function render() {
  const filters = [["", "Toutes"], ...NOTE_TYPE_IDS.map((id) => [id, NOTE_TYPES[id]])];
  app.innerHTML = `
    <div class="window note">
      <header class="bar">
        <span class="title">Notes de la scène</span>
        <button type="button" class="icon" id="close" title="Fermer">✕</button>
      </header>
      <div class="note-filters">
        <input id="search" type="search" placeholder="Rechercher…" aria-label="Rechercher" />
        <div>
          ${filters
            .map(
              ([id, label]) =>
                `<button type="button" class="note-filter ${id ? `note-type-${id}` : ""} ${id === filter ? "active" : ""}" data-filter="${id}">${escapeHtml(label)}</button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="note-rows" id="rows"></div>
    </div>`;
  app.querySelector<HTMLButtonElement>("#close")!.onclick = () =>
    OBR.popover.close(LIST_POPOVER_ID);
  app.querySelector<HTMLInputElement>("#search")!.oninput = (event) => {
    search = (event.target as HTMLInputElement).value;
    renderRows();
  };
  app.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.onclick = () => {
      filter = button.dataset.filter as NoteType | "";
      app.querySelectorAll(".note-filter").forEach((other) => {
        other.classList.toggle("active", other === button);
      });
      renderRows();
    };
  });
  app.querySelector<HTMLElement>("#rows")!.onclick = (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
    if (row) goTo(row.dataset.id!);
  };
  renderRows();
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    await OBR.popover.close(LIST_POPOVER_ID);
    return;
  }
  render();
  items = await OBR.scene.items.getItems();
  renderRows();
  OBR.scene.items.onChange((next) => {
    items = next;
    renderRows();
  });
});
