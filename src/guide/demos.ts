// Les fenêtres de démonstration du site guide, construites par le code de l'extension.
// Seul ce qui touche à Owlbear (scène, popovers, messages) est remplacé par de petits équivalents locaux.
import { wireHelp } from "../help";
import { t, type LanguageSetting } from "../i18n";
import { icon } from "../icons";
import { genericToStatblock, manualToStatblock } from "../manual";
import { mapNoteEditHtml, mapNoteReadHtml, tokenNoteEditHtml, tokenNoteReadHtml } from "../note-view";
import { buildNote, isNoteType, noteTypeLabel, type ListedNote, type NoteType } from "../notes";
import { noteRowsHtml, notesListHtml } from "../notes-list-view";
import { creatureToStatblock } from "../open5e";
import { settingsHtml, type SettingsState } from "../settings-view";
import { miniPanelHtml, miniToolsHtml, statblockHtml, statblockParts, windowHtml } from "../sheet";
import { daggerheartToStatblock, pf2eToStatblock } from "../systems";
import type { Statblock } from "../types";
import { EXAMPLES, GOBLIN_OPEN5E } from "./examples";
import { mountWindow } from "./windows";

// --- Fiche : une fenêtre par jeu, réductible en pictos et redimensionnable ------------------

const STATBLOCKS: Record<string, () => Statblock> = {
  dnd: () => (EXAMPLES.goblinManual ? manualToStatblock(EXAMPLES.goblinManual) : creatureToStatblock(GOBLIN_OPEN5E)),
  pf2e: () => pf2eToStatblock(EXAMPLES.pf2e),
  dh: () => daggerheartToStatblock(EXAMPLES.daggerheart),
  generic: () => genericToStatblock(EXAMPLES.generic),
};

/** Mêmes limites que la fenêtre dans Owlbear. */
const MIN_WIDTH = 300;
const MIN_HEIGHT = 240;

export function sheetDemo(host: HTMLElement, tabs: Iterable<HTMLButtonElement>) {
  const { app, root } = mountWindow(host);
  let minimized = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  const setMinimized = (value: boolean) => {
    minimized = value;
    app.classList.toggle("minimized", value);
    host.classList.toggle("minimized", value);
    const button = root.querySelector<HTMLButtonElement>("#minimize")!;
    button.innerHTML = icon(value ? "restore" : "minimize");
    button.title = value ? t("window.restore") : t("window.minimize");
  };

  const show = (system: string) => {
    const statblock = STATBLOCKS[system]();
    root.innerHTML = windowHtml(statblockHtml(statblock), statblock.name);
    const theme = statblock.system ?? "dnd";
    const panel = root.querySelector<HTMLElement>("#mini-panel")!;
    root.querySelector<HTMLElement>(".sheet")!.dataset.theme = theme;
    panel.dataset.theme = theme;

    // Fenêtre réduite : un picto par partie, son détail au survol, comme dans statblock.ts.
    const parts = statblockParts(statblock);
    const tools = root.querySelector<HTMLElement>("#mini-tools")!;
    tools.innerHTML = miniToolsHtml(parts);
    const clearActive = () => tools.querySelectorAll("button.active").forEach((button) => button.classList.remove("active"));
    const hidePart = () => {
      clearTimeout(hideTimer);
      panel.hidden = true;
      panel.innerHTML = "";
      clearActive();
    };
    tools.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
      const open = () => {
        clearTimeout(hideTimer);
        clearActive();
        button.classList.add("active");
        panel.innerHTML = miniPanelHtml(parts[Number(button.dataset.part)]);
        panel.hidden = false;
        panel.scrollTop = 0;
      };
      button.addEventListener("pointerenter", open);
      button.addEventListener("focus", open);
      button.addEventListener("click", open);
    });
    const win = root.querySelector<HTMLElement>(".window")!;
    win.addEventListener("pointerleave", () => {
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hidePart, 200);
    });
    win.addEventListener("pointerenter", () => clearTimeout(hideTimer));

    root.querySelector<HTMLButtonElement>("#minimize")!.onclick = () => {
      hidePart();
      setMinimized(!minimized);
    };
    setMinimized(minimized);
    wireResize(root.querySelector<HTMLElement>("#resize")!);
  };

  // La poignée du coin redimensionne la fenêtre, dans la place disponible sur la page.
  const wireResize = (handle: HTMLElement) => {
    let start = { x: 0, y: 0, width: 0, height: 0 };
    handle.addEventListener("pointerdown", (event) => {
      start = { x: event.clientX, y: event.clientY, width: host.offsetWidth, height: host.offsetHeight };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener("pointermove", (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      const room = host.parentElement!.clientWidth;
      host.style.width = `${Math.min(room, Math.max(MIN_WIDTH, start.width + event.clientX - start.x))}px`;
      host.style.height = `${Math.max(MIN_HEIGHT, start.height + event.clientY - start.y)}px`;
    });
  };

  const tabList = [...tabs];
  for (const tab of tabList) {
    tab.addEventListener("click", () => {
      for (const other of tabList) other.setAttribute("aria-selected", String(other === tab));
      show(tab.dataset.system!);
    });
  }
  show(tabList.find((tab) => tab.getAttribute("aria-selected") === "true")?.dataset.system ?? "dnd");
}

// --- Chiffrement : la saisie d'une note secrète, dont le texte est chiffré en direct ----------

export function cipherWindow(host: HTMLElement) {
  const { root } = mountWindow(host);
  root.innerHTML = tokenNoteEditHtml(EXAMPLES.tokenName, { text: EXAMPLES.secret });
  wireHelp(root);
  const textarea = root.querySelector<HTMLTextAreaElement>("textarea")!;
  textarea.spellcheck = false;
  return textarea;
}

// --- Note de token : lue, comme le MJ l'ouvre depuis le menu ----------------------------------

export function tokenDemo(host: HTMLElement) {
  mountWindow(host).root.innerHTML = tokenNoteReadHtml(EXAMPLES.tokenName, EXAMPLES.tokenNote, true);
  // Le menu du clic droit est celui d'Owlbear, mais ses lignes sont les libellés de l'extension.
  for (const label of document.querySelectorAll<HTMLElement>("[data-ext-text]")) {
    label.textContent = t(label.dataset.extText as Parameters<typeof t>[0]);
  }
}

// --- Notes de carte : la liste (recherche, filtres) et la note choisie ---------------------------

export function notesDemo(listHost: HTMLElement, noteHost: HTMLElement) {
  let notes: ListedNote[] = structuredClone(EXAMPLES.mapNotes);
  let filter: NoteType | "" = "";
  let search = "";
  let openId = EXAMPLES.openNote;

  const list = mountWindow(listHost);
  list.root.innerHTML = notesListHtml(filter, search);
  const rows = list.root.querySelector<HTMLElement>("#rows")!;
  const renderRows = () => {
    list.root.querySelector<HTMLElement>("#count")!.textContent = notes.length ? String(notes.length) : "";
    rows.innerHTML = noteRowsHtml(notes, filter, search, 0);
  };
  list.root.querySelector<HTMLInputElement>("#search")!.oninput = (event) => {
    search = (event.target as HTMLInputElement).value;
    renderRows();
  };
  list.root.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((button) => {
    button.onclick = () => {
      filter = button.dataset.filter as NoteType | "";
      list.root.querySelectorAll(".chip").forEach((other) => other.classList.toggle("active", other === button));
      renderRows();
    };
  });
  // Dans Owlbear, la carte se centre sur la note avant de l'ouvrir ; ici, elle s'ouvre à côté.
  rows.onclick = (event) => {
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-id]");
    if (!row) return;
    openId = row.dataset.id!;
    renderRead();
  };

  const note = mountWindow(noteHost);
  const current = () => notes.find(({ id }) => id === openId);
  const replace = (next: ListedNote["note"]) => {
    notes = notes.map((entry) => (entry.id === openId ? { id: openId, note: next } : entry));
    renderRows();
  };

  function renderRead() {
    const entry = current();
    noteHost.hidden = !entry;
    if (!entry) return;
    noteHost.classList.remove("editing");
    note.root.innerHTML = mapNoteReadHtml(entry.note);
    note.root.querySelector<HTMLButtonElement>("#done")!.onclick = () => {
      const next = { ...entry.note };
      if (next.done) delete next.done;
      else next.done = true;
      replace(next);
      renderRead();
    };
    note.root.querySelector<HTMLButtonElement>("#edit")!.onclick = () => renderEdit(entry.note);
  }

  // Même saisie que note.ts : type, titre, texte ; l'enregistrement reste dans la page.
  function renderEdit(previous: ListedNote["note"]) {
    noteHost.classList.add("editing");
    note.root.innerHTML = mapNoteEditHtml(previous.type, previous);
    wireHelp(note.root);
    const form = note.root.querySelector<HTMLFormElement>("#form")!;
    const error = note.root.querySelector<HTMLParagraphElement>("#error")!;
    const title = form.elements.namedItem("title") as HTMLInputElement;
    const text = form.elements.namedItem("text") as HTMLTextAreaElement;
    let chosen = previous.type;
    note.root.querySelectorAll<HTMLButtonElement>("[data-type]").forEach((button) => {
      button.onclick = () => {
        if (!isNoteType(button.dataset.type)) return;
        chosen = button.dataset.type;
        note.root.querySelectorAll("[data-type]").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
        const header = note.root.querySelector<HTMLElement>(".note-bar")!;
        header.className = `bar note-bar note-type-${chosen}`;
        header.querySelector("img")!.src = `/notes/${chosen}.svg`;
        header.querySelector(".type-chip")!.lastChild!.textContent = noteTypeLabel(chosen);
        title.placeholder = noteTypeLabel(chosen);
      };
    });
    note.root.querySelector<HTMLButtonElement>("#close")!.onclick = renderRead;
    note.root.querySelector<HTMLButtonElement>("#cancel")!.onclick = renderRead;
    note.root.querySelector<HTMLButtonElement>("#remove")!.onclick = () => {
      notes = notes.filter(({ id }) => id !== openId);
      openId = notes[0]?.id ?? "";
      renderRows();
      renderRead();
    };
    form.oninput = () => (error.hidden = true);
    form.onkeydown = (event) => {
      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) form.requestSubmit();
      if (event.key === "Escape") renderRead();
    };
    form.onsubmit = () => {
      const result = buildNote(chosen, title.value, text.value, previous.done);
      if ("error" in result) {
        error.textContent = result.error;
        error.hidden = false;
        return;
      }
      replace(result.note);
      renderRead();
    };
  }

  renderRows();
  renderRead();
}

// --- Clé : la fenêtre des réglages, avec une clé créée pour cette page --------------------------

const newKey = () => btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));

/** Une clé Hidden Ink : 32 octets en base64. */
function isKey(text: string) {
  try {
    return atob(text).length === 32;
  } catch {
    return false;
  }
}

export function keyDemo(host: HTMLElement) {
  const { root } = mountWindow(host);
  const state: SettingsState = { setting: "auto", hasKey: true, roomHasKey: true, stuck: false, saved: false, importText: "" };
  let key = newKey();

  const render = () => {
    root.innerHTML = settingsHtml(state);
    state.message = undefined;
    root.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
      button.onclick = () => {
        state.setting = button.dataset.language as LanguageSetting;
        render();
      };
    });
    // Comme dans settings.ts : la clé n'apparaît qu'après un clic.
    const value = root.querySelector<HTMLElement>("#key-value")!;
    const show = root.querySelector<HTMLButtonElement>("#show")!;
    show.onclick = () => {
      value.hidden = !value.hidden;
      value.textContent = value.hidden ? "" : key;
      show.innerHTML = value.hidden ? `${icon("eye", 14)}${t("settings.keyShow")}` : `${icon("eyeOff", 14)}${t("settings.keyHide")}`;
    };
    // Copie la clé de cette page (elle n'ouvre rien d'autre) ; refusée, elle s'affiche sélectionnée, comme dans settings.ts.
    const copy = root.querySelector<HTMLButtonElement>("#copy")!;
    copy.onclick = async () => {
      try {
        await navigator.clipboard.writeText(key);
      } catch {
        value.hidden = false;
        value.textContent = key;
        show.innerHTML = `${icon("eyeOff", 14)}${t("settings.keyHide")}`;
        getSelection()?.selectAllChildren(value);
        copy.innerHTML = `${icon("copy", 14)}${t("settings.keyCopyManual")}`;
        return;
      }
      copy.innerHTML = `${icon("check", 14)}${t("settings.keyCopied")}`;
      state.saved = true;
      setTimeout(render, 1200);
    };
    const restart = root.querySelector<HTMLButtonElement>("#restart");
    if (restart) restart.onclick = () => ((state.confirming = "restart"), render());
    const no = root.querySelector<HTMLButtonElement>("#restart-no");
    if (no) no.onclick = () => ((state.confirming = undefined), render());
    const yes = root.querySelector<HTMLButtonElement>("#restart-yes");
    if (yes) {
      yes.onclick = () => {
        key = newKey();
        Object.assign(state, { confirming: undefined, saved: false, message: { text: t("settings.restartDone"), kind: "success" } });
        render();
      };
    }

    // Import : même contrôle que l'extension (32 octets en base64), et la même confirmation avant de remplacer.
    const field = root.querySelector<HTMLInputElement>("#import")!;
    field.oninput = () => {
      state.importText = field.value;
      if (state.confirming === "import") {
        state.confirming = undefined;
        root.querySelector(".confirm")?.remove();
      }
    };
    field.onkeydown = (event) => {
      if (event.key === "Enter") root.querySelector<HTMLButtonElement>("#import-button")!.click();
    };
    root.querySelector<HTMLButtonElement>("#import-button")!.onclick = () => {
      const text = field.value.trim();
      if (!text) return;
      if (!isKey(text)) {
        state.message = { text: t("settings.keyInvalid"), kind: "error" };
      } else if (text !== key) {
        state.confirming = "import";
      } else {
        state.importText = "";
        state.message = { text: t("settings.keyImported"), kind: "success" };
      }
      render();
    };
    const replaceYes = root.querySelector<HTMLButtonElement>("#replace-yes");
    if (replaceYes) {
      replaceYes.onclick = () => {
        key = state.importText.trim();
        Object.assign(state, { confirming: undefined, importText: "", saved: true, message: { text: t("settings.keyImported"), kind: "success" } });
        render();
      };
    }
    const replaceNo = root.querySelector<HTMLButtonElement>("#replace-no");
    if (replaceNo) replaceNo.onclick = () => ((state.confirming = undefined), render());
    root.querySelector<HTMLButtonElement>("#restart-yes, #replace-yes")?.focus({ preventScroll: true });
  };
  render();
}
