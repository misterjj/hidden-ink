// HTML des fenêtres de note, sans Owlbear : l'extension (note.ts) et le site guide l'affichent tel quel.
import { t } from "./i18n";
import { labelWithHelp } from "./help";
import { icon } from "./icons";
import { escapeHtml } from "./manual";
import { renderMarkdown } from "./markdown";
import { NOTE_TYPE_IDS, noteTypeLabel, type MapNote, type NoteType } from "./notes";
import type { TokenNote } from "./types";

export function noteBarHtml(type: NoteType | "token", label: string, extra = "") {
  const image = type === "token" ? "/badge.svg" : `/notes/${type}.svg`;
  return `
    <header class="bar note-bar note-type-${type}">
      <span class="type-chip"><img src="${image}" alt="" />${escapeHtml(label)}</span>
      <span class="title">${extra ? `<small>${escapeHtml(extra)}</small>` : ""}</span>
      <button type="button" class="icon" id="close" title="${t("common.close")}">${icon("close")}</button>
    </header>`;
}

/** Note chiffrée avec une clé absente de ce navigateur : on ne peut que la supprimer. */
export function lockedNoteHtml(label: string) {
  return `
    <div class="window note">
      ${noteBarHtml("token", label)}
      <div class="note-read" data-fit>
        <div class="locked">${icon("lock", 28)}<p>${escapeHtml(t("crypto.locked"))}</p>
          <button type="button" class="btn primary" id="settings">${icon("key", 14)}${t("notes.openSettings")}</button>
        </div>
      </div>
      <footer class="footer">
        <button type="button" class="btn danger" id="remove">${icon("trash", 14)}${t("common.delete")}</button>
      </footer>
    </div>`;
}

export function mapNoteReadHtml(note: MapNote) {
  return `
    <div class="window note ${note.done ? "note-done" : ""}">
      ${noteBarHtml(note.type, noteTypeLabel(note.type))}
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
}

export function mapNoteEditHtml(type: NoteType, current?: MapNote) {
  return `
    <div class="window note">
      ${noteBarHtml(type, noteTypeLabel(type))}
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
}

export function tokenNoteReadHtml(name: string, note: TokenNote, hasFiche: boolean) {
  return `
    <div class="window note">
      ${noteBarHtml("token", t("tokenNote.title"), name)}
      <div class="note-read" data-fit>
        <div class="note-text">${renderMarkdown(note.text)}</div>
      </div>
      <footer class="footer">
        ${hasFiche ? `<button type="button" class="btn" id="fiche">${icon("sheet", 14)}${t("tokenNote.openFiche")}</button>` : ""}
        <span class="spacer"></span>
        <button type="button" class="btn" id="edit">${icon("edit", 14)}${t("common.edit")}</button>
      </footer>
    </div>`;
}

export function tokenNoteEditHtml(name: string, current?: TokenNote) {
  return `
    <div class="window note">
      ${noteBarHtml("token", t("tokenNote.title"), name)}
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
}
