import OBR, { buildImage, isImage } from "@owlbear-rodeo/sdk";
import { escapeHtml } from "./manual";
import { renderMarkdown } from "./markdown";
import {
  NOTE_CHANNEL,
  NOTE_IMAGE_DPI,
  NOTE_IMAGE_HEIGHT,
  NOTE_IMAGE_OFFSET,
  NOTE_IMAGE_WIDTH,
  NOTE_KEY,
  NOTE_MAX_HEIGHT,
  NOTE_POPOVER_ID,
  NOTE_TYPES,
  NOTE_TYPE_IDS,
  buildNote,
  isMapNote,
  isNoteType,
  noteImageUrl,
  noteLabel,
  type MapNote,
  type NoteMessage,
  type NoteType,
} from "./notes";
import { getShowTitles } from "./notes-scene";
import "./style.css";

const params = new URLSearchParams(location.search);
const itemId = params.get("item") ?? "";
const app = document.querySelector<HTMLDivElement>("#app")!;

const send = (message: NoteMessage) =>
  OBR.broadcast.sendMessage(NOTE_CHANNEL, message, { destination: "LOCAL" });

function fitHeight() {
  const content = app.querySelector<HTMLElement>("[data-fit]");
  if (!content) return;
  const bar = app.querySelector<HTMLElement>(".bar")?.offsetHeight ?? 0;
  const footer = app.querySelector<HTMLElement>(".note-actions")?.offsetHeight ?? 0;
  OBR.popover.setHeight(
    NOTE_POPOVER_ID,
    Math.min(NOTE_MAX_HEIGHT, bar + footer + content.scrollHeight),
  );
}

function bar(type: NoteType) {
  return `
    <header class="bar note-bar note-type-${type}">
      <img src="/notes/${type}.svg" alt="" width="20" height="20" />
      <span class="title">${escapeHtml(NOTE_TYPES[type])}</span>
      <button type="button" class="icon" id="close" title="Fermer">✕</button>
    </header>`;
}

async function updateNote(note: MapNote) {
  const showTitles = await getShowTitles();
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      item.metadata[NOTE_KEY] = note;
      item.name = note.title;
      if (isImage(item)) {
        item.image.url = noteImageUrl(location.origin, note);
        item.text.plainText = noteLabel(note, showTitles);
      }
    }
  });
}

async function createNote(note: MapNote, x: number, y: number) {
  const item = buildImage(
    {
      url: noteImageUrl(location.origin, note),
      mime: "image/png",
      width: NOTE_IMAGE_WIDTH,
      height: NOTE_IMAGE_HEIGHT,
    },
    { dpi: NOTE_IMAGE_DPI, offset: NOTE_IMAGE_OFFSET },
  )
    .position({ x, y })
    .layer("NOTE")
    // Masqué : Owlbear ne le dessine pas chez les joueurs.
    .visible(false)
    .name(note.title)
    .plainText(noteLabel(note, await getShowTitles()))
    .metadata({ [NOTE_KEY]: note })
    .build();
  await OBR.scene.items.addItems([item]);
}

function renderRead(note: MapNote) {
  app.innerHTML = `
    <div class="window note ${note.done ? "note-done" : ""}">
      ${bar(note.type)}
      <div class="note-read" data-fit>
        <h1>${escapeHtml(note.title)}</h1>
        <div class="note-text">${renderMarkdown(note.text)}</div>
      </div>
      <footer class="note-actions">
        <button type="button" id="done">${note.done ? "Remettre à faire" : "Marquer comme fait"}</button>
        <button type="button" id="edit">Modifier</button>
      </footer>
    </div>`;
  app.querySelector<HTMLButtonElement>("#close")!.onclick = () => send({ type: "hide" });
  app.querySelector<HTMLButtonElement>("#edit")!.onclick = () => {
    send({ type: "editing", value: true });
    renderEdit(note.type, note);
  };
  app.querySelector<HTMLButtonElement>("#done")!.onclick = async () => {
    const next: MapNote = { ...note };
    if (note.done) delete next.done;
    else next.done = true;
    await updateNote(next);
    renderRead(next);
  };
  // Une image ne prend sa hauteur qu'une fois chargée.
  app.querySelectorAll<HTMLImageElement>(".note-text img").forEach((image) => {
    image.onload = fitHeight;
  });
  fitHeight();
}

function renderEdit(type: NoteType, current?: MapNote, position?: { x: number; y: number }) {
  app.innerHTML = `
    <div class="window note">
      ${bar(type)}
      <form class="pane" id="form">
        <label>Type
          <select name="type">
            ${NOTE_TYPE_IDS.map(
              (id) =>
                `<option value="${id}" ${id === type ? "selected" : ""}>${escapeHtml(NOTE_TYPES[id])}</option>`,
            ).join("")}
          </select>
        </label>
        <label>Titre
          <input name="title" autocomplete="off" value="${escapeHtml(current?.title ?? "")}" />
        </label>
        <label class="note-grow">
          <span>Texte <small>(markdown : **gras**, *italique*, # titre, - liste…)</small></span>
          <textarea name="text">${escapeHtml(current?.text ?? "")}</textarea>
        </label>
        <p class="error" id="error" hidden></p>
        <div class="row">
          <button type="submit" class="primary">Enregistrer</button>
          <button type="button" id="cancel">Annuler</button>
          ${current ? `<button type="button" id="remove">Supprimer</button>` : ""}
        </div>
      </form>
    </div>`;
  OBR.popover.setHeight(NOTE_POPOVER_ID, NOTE_MAX_HEIGHT);

  const form = app.querySelector<HTMLFormElement>("#form")!;
  const error = app.querySelector<HTMLParagraphElement>("#error")!;
  const title = form.elements.namedItem("title") as HTMLInputElement;
  const text = form.elements.namedItem("text") as HTMLTextAreaElement;
  const kind = form.elements.namedItem("type") as HTMLSelectElement;
  kind.onchange = () => {
    if (!isNoteType(kind.value)) return;
    const header = app.querySelector<HTMLElement>(".note-bar")!;
    header.className = `bar note-bar note-type-${kind.value}`;
    header.querySelector("img")!.src = `/notes/${kind.value}.svg`;
    header.querySelector(".title")!.textContent = NOTE_TYPES[kind.value];
  };
  const leave = async () => {
    await send({ type: "editing", value: false });
    await send({ type: "hide" });
  };

  const cancel = () => {
    if (current) {
      send({ type: "editing", value: false });
      renderRead(current);
    } else {
      leave();
    }
  };
  app.querySelector<HTMLButtonElement>("#close")!.onclick = cancel;
  app.querySelector<HTMLButtonElement>("#cancel")!.onclick = cancel;
  app.querySelector<HTMLButtonElement>("#remove")?.addEventListener("click", async () => {
    await OBR.scene.items.deleteItems([itemId]);
    await leave();
  });

  const fail = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };
  form.oninput = () => {
    error.hidden = true;
  };
  form.onkeydown = (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) form.requestSubmit();
    if (event.key === "Escape") cancel();
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const result = buildNote(
      isNoteType(kind.value) ? kind.value : type,
      title.value,
      text.value,
      current?.done,
    );
    if ("error" in result) {
      fail(result.error);
      return;
    }
    try {
      if (current) {
        await updateNote(result.note);
        await send({ type: "editing", value: false });
        renderRead(result.note);
      } else {
        await createNote(result.note, position!.x, position!.y);
        await leave();
      }
    } catch {
      fail("Enregistrement impossible.");
    }
  };
  title.focus();
  title.select();
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    await OBR.popover.close(NOTE_POPOVER_ID);
    return;
  }
  const newType = params.get("new");
  if (isNoteType(newType)) {
    renderEdit(newType, undefined, {
      x: Number(params.get("x")),
      y: Number(params.get("y")),
    });
    return;
  }
  const [item] = await OBR.scene.items.getItems([itemId]);
  const note = item?.metadata[NOTE_KEY];
  if (isMapNote(note)) renderRead(note);
  else await send({ type: "hide" });
});
