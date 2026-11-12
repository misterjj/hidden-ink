import OBR, { type Item } from "@owlbear-rodeo/sdk";
import { icon } from "./icons";
import { escapeHtml } from "./manual";
import { markdownPreview } from "./markdown";
import {
  LIST_POPOVER_ID,
  NOTE_CHANNEL,
  noteTypeLabel,
  NOTE_TYPE_IDS,
  centeredView,
  filterNotes,
  isNoteItem,
  isNoteType,
  type ListedNote,
  type NoteMessage,
  type NoteType,
} from "./notes";
import { currentLanguage, t } from "./i18n";
import { readNote } from "./notes-scene";
import { wirePanelMove } from "./panel-move";
import "./style.css";
import "./theme";

const app = document.querySelector<HTMLDivElement>("#app")!;
let items: Item[] = [];
/** Notes déchiffrées de la scène ; une note illisible ici n'y figure pas. */
let notes: ListedNote[] = [];
let locked = 0;
/** Recherche et filtre survivent à un déplacement, qui rouvre la fenêtre. */
const params = new URLSearchParams(location.search);
let filter: NoteType | "" = isNoteType(params.get("type")) ? (params.get("type") as NoteType) : "";
let search = params.get("q") ?? "";

async function readAll() {
  const noteItems = items.filter(isNoteItem);
  const read = await Promise.all(noteItems.map(async (item) => ({ id: item.id, note: await readNote(item) })));
  notes = read.flatMap(({ id, note }) => (note ? [{ id, note }] : []));
  locked = read.length - notes.length;
  renderRows();
}

function renderRows() {
  const rows = filterNotes(notes, filter, search);
  const lockedRow = locked
    ? `<p class="info">${icon("lock", 14)}<span>${escapeHtml(t("crypto.locked"))}</span></p>`
    : "";
  const count = app.querySelector<HTMLElement>("#count");
  if (count) count.textContent = notes.length + locked ? String(notes.length + locked) : "";
  app.querySelector<HTMLElement>("#rows")!.innerHTML = rows.length
    ? rows
        .map(
          ({ id, note }) => `
      <button type="button" class="note-row note-type-${note.type} ${note.done ? "note-done" : ""}" data-id="${escapeHtml(id)}">
        <img src="/notes/${note.type}.svg" alt="${escapeHtml(noteTypeLabel(note.type))}" />
        <span>
          <strong>${escapeHtml(note.title)}</strong>
          ${note.text ? `<small>${escapeHtml(markdownPreview(note.text))}</small>` : ""}
        </span>
      </button>`,
        )
        .join("") + lockedRow
    : notes.length
      ? `<div class="empty">${icon("search", 22)}<span>${t("notes.noMatch")}</span></div>${lockedRow}`
      : locked
        ? lockedRow
        : `<div class="empty">${icon("sheet", 24)}<span>${t("notes.noneYet")}</span></div>`;
}

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * `animateTo` rend la main avant la fin de l'animation : ouverte trop tôt, la note se placerait
 * d'après une vue encore en mouvement. On attend que la vue arrive, ou qu'elle s'arrête ailleurs
 * (le MJ a bougé la carte entre-temps), sans jamais dépasser 1,5 s.
 */
async function viewSettled(target: { x: number; y: number }) {
  let previous: { x: number; y: number } | undefined;
  let still = 0;
  for (let waited = 0; waited < 1500; waited += 50) {
    const position = await OBR.viewport.getPosition();
    if (Math.abs(position.x - target.x) < 1 && Math.abs(position.y - target.y) < 1) return;
    still = previous && position.x === previous.x && position.y === previous.y ? still + 1 : 0;
    if (still >= 4 && waited >= 300) return;
    previous = position;
    await pause(50);
  }
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
  const target = centeredView(item.position, scale, width, height);
  await OBR.viewport.animateTo({ position: target, scale });
  await viewSettled(target);
  if (selection?.length === 1 && selection[0] === itemId) {
    const message: NoteMessage = { type: "show", itemId };
    await OBR.broadcast.sendMessage(NOTE_CHANNEL, message, { destination: "LOCAL" });
  } else {
    await OBR.player.select([itemId], true);
  }
}

function render() {
  const filters = [["", t("notes.all")], ...NOTE_TYPE_IDS.map((id) => [id, noteTypeLabel(id)])];
  app.innerHTML = `
    <div class="window note">
      <header class="bar" id="drag" title="${t("window.drag")}">
        <span class="grip">${icon("grip", 14)}</span>
        <span class="title">${t("notes.listTitle")}<span class="count" id="count"></span></span>
        <button type="button" class="icon" id="close" title="${t("common.close")}">${icon("close")}</button>
      </header>
      <div class="note-filters">
        <div class="search">${icon("search", 14)}
          <input id="search" type="search" placeholder="${t("notes.search")}" aria-label="${t("notes.search")}" value="${escapeHtml(search)}" />
        </div>
        <div class="chips">
          ${filters
            .map(
              ([id, label]) =>
                `<button type="button" class="chip ${id ? `note-type-${id}` : ""} ${id === filter ? "active" : ""}" data-filter="${id}">${id ? `<span class="dot"></span>` : ""}${escapeHtml(label)}</button>`,
            )
            .join("")}
        </div>
      </div>
      <div class="note-rows" id="rows"></div>
    </div>`;
  wirePanelMove(app.querySelector<HTMLElement>("#drag")!, "list", () => {
    const query = new URLSearchParams();
    if (search) query.set("q", search);
    if (filter) query.set("type", filter);
    return query.toString();
  });
  app.querySelector<HTMLButtonElement>("#close")!.onclick = () =>
    OBR.popover.close(LIST_POPOVER_ID);
  app.querySelector<HTMLInputElement>("#search")!.oninput = (event) => {
    search = (event.target as HTMLInputElement).value;
    renderRows();
  };
  app.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.onclick = () => {
      filter = button.dataset.filter as NoteType | "";
      app.querySelectorAll(".chip").forEach((other) => {
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
  document.documentElement.lang = currentLanguage();
  render();
  items = await OBR.scene.items.getItems();
  await readAll();
  OBR.scene.items.onChange((next) => {
    items = next;
    void readAll();
  });
});
