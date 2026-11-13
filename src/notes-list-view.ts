// HTML de la liste des notes de la scène, sans Owlbear : l'extension (notes-list.ts) et le site guide l'affichent tel quel.
import { t } from "./i18n";
import { icon } from "./icons";
import { escapeHtml } from "./manual";
import { markdownPreview } from "./markdown";
import { NOTE_TYPE_IDS, filterNotes, noteTypeLabel, type ListedNote, type NoteType } from "./notes";

/** La fenêtre, avec la recherche et les filtres ; les lignes arrivent ensuite dans #rows. */
export function notesListHtml(filter: NoteType | "", search: string) {
  const filters = [["", t("notes.all")], ...NOTE_TYPE_IDS.map((id) => [id, noteTypeLabel(id)])];
  return `
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
}

/** Les lignes de la liste ; `locked` compte les notes illisibles dans ce navigateur. */
export function noteRowsHtml(notes: ListedNote[], filter: NoteType | "", search: string, locked: number) {
  const rows = filterNotes(notes, filter, search);
  const lockedRow = locked
    ? `<p class="info">${icon("lock", 14)}<span>${escapeHtml(t("crypto.locked"))}</span></p>`
    : "";
  return rows.length
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
