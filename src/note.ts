import OBR, { buildImage, isImage } from "@owlbear-rodeo/sdk";
import { LockedError, MissingKeyError, byteSize, isExported, reveal, seal } from "./crypto";
import { currentLanguage, t } from "./i18n";
import { labelWithHelp, wireHelp } from "./help";
import { icon } from "./icons";
import { escapeHtml } from "./manual";
import { renderMarkdown } from "./markdown";
import {
  MAX_NOTE_BYTES,
  NOTE_CHANNEL,
  NOTE_IMAGE_DPI,
  NOTE_IMAGE_HEIGHT,
  NOTE_IMAGE_OFFSET,
  NOTE_IMAGE_WIDTH,
  NOTE_ITEM_NAME,
  NOTE_KEY,
  NOTE_MAX_HEIGHT,
  NOTE_POPOVER_ID,
  NOTE_TYPE_IDS,
  buildNote,
  isMapNote,
  isNoteType,
  noteImageUrl,
  noteTypeLabel,
  rememberNoteType,
  type MapNote,
  type NoteMessage,
  type NoteType,
} from "./notes";
import "./style.css";
import { CHANNEL, METADATA_KEY, TOKEN_NOTE_KEY, type Message, type TokenNote } from "./types";

const params = new URLSearchParams(location.search);
const itemId = params.get("item") ?? "";
/** Note secrète d'un token, au lieu d'une note de carte. */
const tokenId = params.get("token") ?? "";
const app = document.querySelector<HTMLDivElement>("#app")!;

const send = (message: NoteMessage) =>
  OBR.broadcast.sendMessage(NOTE_CHANNEL, message, { destination: "LOCAL" });

const saveError = (error: unknown) =>
  error instanceof MissingKeyError ? t("crypto.noKey") : t("error.save");

/** Rappel tant que la clé n'a jamais été copiée : sans elle, un navigateur vidé perd tout. */
const remindBackup = () => {
  if (!isExported()) OBR.notification.show(t("crypto.backupReminder"), "WARNING");
};

function fitHeight() {
  const content = app.querySelector<HTMLElement>("[data-fit]");
  if (!content) return;
  const bar = app.querySelector<HTMLElement>(".bar")?.offsetHeight ?? 0;
  const footer = app.querySelector<HTMLElement>(".footer")?.offsetHeight ?? 0;
  OBR.popover.setHeight(NOTE_POPOVER_ID, Math.min(NOTE_MAX_HEIGHT, bar + footer + content.scrollHeight));
}

function bar(type: NoteType | "token", label: string, extra = "") {
  const image = type === "token" ? "/badge.svg" : `/notes/${type}.svg`;
  return `
    <header class="bar note-bar note-type-${type}">
      <span class="type-chip"><img src="${image}" alt="" />${escapeHtml(label)}</span>
      <span class="title">${extra ? `<small>${escapeHtml(extra)}</small>` : ""}</span>
      <button type="button" class="icon" id="close" title="${t("common.close")}">${icon("close")}</button>
    </header>`;
}

/** Note chiffrée avec une clé absente de ce navigateur : on ne peut que la supprimer. */
function renderLocked(label: string, remove: () => Promise<void>) {
  app.innerHTML = `
    <div class="window note">
      ${bar("token", label)}
      <div class="note-read" data-fit>
        <div class="locked">${icon("lock", 28)}<p>${escapeHtml(t("crypto.locked"))}</p>
          <button type="button" class="btn primary" id="settings">${icon("key", 14)}${t("notes.openSettings")}</button>
        </div>
      </div>
      <footer class="footer">
        <button type="button" class="btn danger" id="remove">${icon("trash", 14)}${t("common.delete")}</button>
      </footer>
    </div>`;
  app.querySelector<HTMLButtonElement>("#close")!.onclick = () => send({ type: "hide" });
  app.querySelector<HTMLButtonElement>("#settings")!.onclick = () => send({ type: "settings" });
  app.querySelector<HTMLButtonElement>("#remove")!.onclick = async () => {
    await remove();
    await send({ type: "hide" });
  };
  fitHeight();
}

// --- Notes de carte ---------------------------------------------------------------

async function updateNote(note: MapNote) {
  const sealed = await seal(note);
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      item.metadata[NOTE_KEY] = sealed;
      item.name = NOTE_ITEM_NAME;
      if (isImage(item)) {
        item.image.url = noteImageUrl(location.origin, note);
        item.text.plainText = "";
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
    // Le titre est dessiné en local chez le MJ, jamais écrit sur l'objet partagé.
    .name(NOTE_ITEM_NAME)
    .metadata({ [NOTE_KEY]: await seal(note) })
    .build();
  await OBR.scene.items.addItems([item]);
  remindBackup();
}

function renderRead(note: MapNote) {
  app.innerHTML = `
    <div class="window note ${note.done ? "note-done" : ""}">
      ${bar(note.type, noteTypeLabel(note.type))}
      <div class="note-read" data-fit>
        <h1>${escapeHtml(note.title)}</h1>
        <div class="note-text">${renderMarkdown(note.text)}</div>
      </div>
      <footer class="footer">
        <button type="button" class="btn" id="done" aria-pressed="${Boolean(note.done)}">${icon(note.done ? "undo" : "check", 14)}${note.done ? t("notes.markTodo") : t("notes.markDone")}</button>
        <span class="spacer"></span>
        <button type="button" class="btn" id="edit">${icon("edit", 14)}${t("common.edit")}</button>
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
    try {
      await updateNote(next);
      renderRead(next);
    } catch (error) {
      OBR.notification.show(saveError(error), "ERROR");
    }
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
      ${bar(type, noteTypeLabel(type))}
      <form class="pane" id="form">
        <p class="field-caption">${labelWithHelp(t("notes.fieldType"), t("help.note.type"))}</p>
        <div class="types" role="group" aria-label="${t("notes.fieldType")}">
          ${NOTE_TYPE_IDS.map(
            (id) =>
              `<button type="button" class="note-type-${id}" data-type="${id}" aria-pressed="${id === type}"><img src="/notes/${id}.svg" alt="" />${escapeHtml(noteTypeLabel(id))}</button>`,
          ).join("")}
        </div>
        <label>${labelWithHelp(t("notes.fieldTitle"), t("help.note.title"))}
          <input name="title" autocomplete="off" value="${escapeHtml(current?.title ?? "")}" placeholder="${escapeHtml(noteTypeLabel(type))}" />
        </label>
        <label class="note-grow">
          ${labelWithHelp(t("notes.fieldText"), t("help.note.text"))}
          <textarea name="text">${escapeHtml(current?.text ?? "")}</textarea>
        </label>
        <p class="error" id="error" hidden></p>
      </form>
      <footer class="footer">
        ${current ? `<button type="button" class="btn danger" id="remove" title="${t("common.delete")}">${icon("trash", 14)}</button>` : ""}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" id="cancel">${t("common.cancel")}</button>
        <button type="submit" form="form" class="btn primary">${t("common.save")}</button>
      </footer>
    </div>`;
  OBR.popover.setHeight(NOTE_POPOVER_ID, NOTE_MAX_HEIGHT);
  wireHelp(app);

  const form = app.querySelector<HTMLFormElement>("#form")!;
  const error = app.querySelector<HTMLParagraphElement>("#error")!;
  const title = form.elements.namedItem("title") as HTMLInputElement;
  const text = form.elements.namedItem("text") as HTMLTextAreaElement;
  let chosen: NoteType = type;
  app.querySelectorAll<HTMLButtonElement>("[data-type]").forEach((button) => {
    button.onclick = () => {
      if (!isNoteType(button.dataset.type)) return;
      chosen = button.dataset.type;
      app.querySelectorAll("[data-type]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      const header = app.querySelector<HTMLElement>(".note-bar")!;
      header.className = `bar note-bar note-type-${chosen}`;
      header.querySelector("img")!.src = `/notes/${chosen}.svg`;
      header.querySelector(".type-chip")!.lastChild!.textContent = noteTypeLabel(chosen);
      title.placeholder = noteTypeLabel(chosen);
    };
  });
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
    const result = buildNote(chosen, title.value, text.value, current?.done);
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
        rememberNoteType(result.note.type);
        await createNote(result.note, position!.x, position!.y);
        await leave();
      }
    } catch (failure) {
      fail(saveError(failure));
    }
  };
  title.focus();
  title.select();
}

// --- Note secrète d'un token -------------------------------------------------------

async function saveTokenNote(note: TokenNote | undefined) {
  const sealed = note ? await seal(note) : undefined;
  await OBR.scene.items.updateItems([tokenId], (items) => {
    for (const item of items) {
      if (sealed) item.metadata[TOKEN_NOTE_KEY] = sealed;
      else delete item.metadata[TOKEN_NOTE_KEY];
    }
  });
}

function renderTokenRead(name: string, note: TokenNote, hasFiche: boolean) {
  app.innerHTML = `
    <div class="window note">
      ${bar("token", t("tokenNote.title"), name)}
      <div class="note-read" data-fit>
        <div class="note-text">${renderMarkdown(note.text)}</div>
      </div>
      <footer class="footer">
        ${hasFiche ? `<button type="button" class="btn" id="fiche">${icon("sheet", 14)}${t("tokenNote.openFiche")}</button>` : ""}
        <span class="spacer"></span>
        <button type="button" class="btn" id="edit">${icon("edit", 14)}${t("common.edit")}</button>
      </footer>
    </div>`;
  app.querySelector<HTMLButtonElement>("#close")!.onclick = () => send({ type: "hide" });
  app.querySelector<HTMLButtonElement>("#edit")!.onclick = () => {
    send({ type: "editing", value: true });
    renderTokenEdit(name, note, hasFiche);
  };
  app.querySelector<HTMLButtonElement>("#fiche")?.addEventListener("click", () => {
    const message: Message = { type: "open", itemId: tokenId };
    OBR.broadcast.sendMessage(CHANNEL, message, { destination: "LOCAL" });
  });
  app.querySelectorAll<HTMLImageElement>(".note-text img").forEach((image) => {
    image.onload = fitHeight;
  });
  fitHeight();
}

function renderTokenEdit(name: string, current: TokenNote | undefined, hasFiche: boolean) {
  app.innerHTML = `
    <div class="window note">
      ${bar("token", t("tokenNote.title"), name)}
      <form class="pane" id="form">
        <label class="note-grow">
          ${labelWithHelp(t("notes.fieldText"), t("help.note.text"))}
          <textarea name="text" placeholder="${escapeHtml(t("tokenNote.placeholder"))}">${escapeHtml(current?.text ?? "")}</textarea>
        </label>
        <p class="error" id="error" hidden></p>
      </form>
      <footer class="footer">
        ${current ? `<button type="button" class="btn danger" id="remove" title="${t("common.delete")}">${icon("trash", 14)}</button>` : ""}
        <span class="spacer"></span>
        <button type="button" class="btn ghost" id="cancel">${t("common.cancel")}</button>
        <button type="submit" form="form" class="btn primary">${t("common.save")}</button>
      </footer>
    </div>`;
  OBR.popover.setHeight(NOTE_POPOVER_ID, NOTE_MAX_HEIGHT);
  wireHelp(app);

  const form = app.querySelector<HTMLFormElement>("#form")!;
  const error = app.querySelector<HTMLParagraphElement>("#error")!;
  const text = form.elements.namedItem("text") as HTMLTextAreaElement;
  const leave = async () => {
    await send({ type: "editing", value: false });
    await send({ type: "hide" });
  };
  const cancel = () => {
    if (current) {
      send({ type: "editing", value: false });
      renderTokenRead(name, current, hasFiche);
    } else {
      leave();
    }
  };
  const fail = (message: string) => {
    error.textContent = message;
    error.hidden = false;
  };
  app.querySelector<HTMLButtonElement>("#close")!.onclick = cancel;
  app.querySelector<HTMLButtonElement>("#cancel")!.onclick = cancel;
  app.querySelector<HTMLButtonElement>("#remove")?.addEventListener("click", async () => {
    try {
      await saveTokenNote(undefined);
      await leave();
    } catch (failure) {
      fail(saveError(failure));
    }
  });
  form.oninput = () => {
    error.hidden = true;
  };
  form.onkeydown = (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) form.requestSubmit();
    if (event.key === "Escape") cancel();
  };
  form.onsubmit = async (event) => {
    event.preventDefault();
    const note: TokenNote = { text: text.value.trim() };
    if (!note.text) {
      fail(t("tokenNote.empty"));
      return;
    }
    const size = byteSize(note);
    if (size > MAX_NOTE_BYTES) {
      fail(t("notes.tooLong", { size: Math.ceil(size / 1024), max: MAX_NOTE_BYTES / 1024 }));
      return;
    }
    try {
      await saveTokenNote(note);
      if (!current) remindBackup();
      await send({ type: "editing", value: false });
      renderTokenRead(name, note, hasFiche);
    } catch (failure) {
      fail(saveError(failure));
    }
  };
  text.focus();
}

async function startToken() {
  const [token] = await OBR.scene.items.getItems([tokenId]);
  if (!token) {
    await send({ type: "hide" });
    return;
  }
  const hasFiche = token.metadata[METADATA_KEY] !== undefined;
  const value = token.metadata[TOKEN_NOTE_KEY];
  if (value === undefined) {
    send({ type: "editing", value: true });
    renderTokenEdit(token.name, undefined, hasFiche);
    return;
  }
  try {
    renderTokenRead(token.name, await reveal<TokenNote>(value), hasFiche);
  } catch (error) {
    if (!(error instanceof LockedError)) throw error;
    renderLocked(t("tokenNote.title"), () => saveTokenNote(undefined));
  }
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    await OBR.popover.close(NOTE_POPOVER_ID);
    return;
  }
  document.documentElement.lang = currentLanguage();
  if (tokenId) {
    await startToken();
    return;
  }
  const newType = params.get("new");
  if (isNoteType(newType)) {
    renderEdit(newType, undefined, { x: Number(params.get("x")), y: Number(params.get("y")) });
    return;
  }
  const [item] = await OBR.scene.items.getItems([itemId]);
  if (item?.metadata[NOTE_KEY] === undefined) {
    await send({ type: "hide" });
    return;
  }
  try {
    const note = await reveal<MapNote>(item.metadata[NOTE_KEY]);
    if (isMapNote(note)) renderRead(note);
    else await send({ type: "hide" });
  } catch (error) {
    if (!(error instanceof LockedError)) throw error;
    renderLocked(t("notes.tool"), () => OBR.scene.items.deleteItems([itemId]));
  }
});
