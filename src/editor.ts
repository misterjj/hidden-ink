import OBR from "@owlbear-rodeo/sdk";
import { normalizeFicheUrl } from "../shared/aidedd";
import { LockedError, MissingKeyError, byteSize, reveal, seal } from "./crypto";
import { FicheError, aideddAvailable, loadFromAidedd } from "./data";
import { currentLanguage, t } from "./i18n";
import { icon } from "./icons";
import { abilityLabels, escapeHtml, statblockToManual } from "./manual";
import { NOTE_CHANNEL, type NoteMessage } from "./notes";
import { formatChallenge, loadCreature, searchCreatures, type Open5eResult } from "./open5e";
import "./style.css";
import {
  CHANNEL,
  EDITOR_POPOVER_ID,
  METADATA_KEY,
  type EditorTab,
  type ManualFiche,
  type Message,
  type Statblock,
  type TokenFiche,
} from "./types";

// Les métadonnées sont synchronisées dans la scène : on évite d'y mettre un roman.
const MAX_MANUAL_BYTES = 12 * 1024;
const PANE_HEIGHTS: Record<EditorTab, number> = { choice: 360, open5e: 520, link: 300, manual: 780 };
const SEARCH_DELAY_MS = 300;

const params = new URLSearchParams(location.search);
const itemId = params.get("item") ?? "";
const app = document.querySelector<HTMLDivElement>("#app")!;

const send = (message: Message) =>
  OBR.broadcast.sendMessage(CHANNEL, message, { destination: "LOCAL" });

/** Message lisible pour un échec d'enregistrement ou de chargement. */
const errorText = (error: unknown, fallback: string) =>
  error instanceof MissingKeyError
    ? t("crypto.noKey")
    : error instanceof FicheError || (error instanceof Error && error.message && !(error instanceof TypeError))
      ? error.message
      : fallback;

async function save(fiche: TokenFiche | undefined) {
  const sealed = fiche ? await seal(fiche) : undefined;
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      if (sealed) item.metadata[METADATA_KEY] = sealed;
      else delete item.metadata[METADATA_KEY];
    }
  });
}

async function finish(open: boolean) {
  if (open) await send({ type: "open", itemId });
  else await send({ type: "close", itemId });
  await OBR.popover.close(EDITOR_POPOVER_ID);
}

/** Fiche chiffrée avec une autre clé : on peut importer la clé, ou retirer la fiche. */
function renderLocked() {
  app.innerHTML = `
    <div class="editor">
      <header class="bar">
        <span class="title">${t("editor.title")}</span>
        <button type="button" class="icon" id="cancel" title="${t("common.close")}">${icon("close")}</button>
      </header>
      <div class="pane">
        <div class="locked">${icon("lock", 28)}<p>${escapeHtml(t("crypto.lockedFiche"))}</p>
          <button type="button" class="btn primary" id="settings">${icon("key", 14)}${t("notes.openSettings")}</button>
        </div>
      </div>
      <footer class="footer"><button type="button" class="btn danger" id="remove">${icon("trash", 14)}${t("editor.remove")}</button></footer>
    </div>`;
  app.querySelector<HTMLButtonElement>("#cancel")!.onclick = () => OBR.popover.close(EDITOR_POPOVER_ID);
  app.querySelector<HTMLButtonElement>("#settings")!.onclick = async () => {
    const message: NoteMessage = { type: "settings" };
    await OBR.broadcast.sendMessage(NOTE_CHANNEL, message, { destination: "LOCAL" });
    await OBR.popover.close(EDITOR_POPOVER_ID);
  };
  app.querySelector<HTMLButtonElement>("#remove")!.onclick = async () => {
    await save(undefined);
    await finish(false);
  };
}

function render(current: TokenFiche | undefined, tokenName: string, tab: EditorTab) {
  const showLink = aideddAvailable() || current?.kind === "link";
  // En français, AideDD donne des fiches dans la langue de la table : c'est lui qu'on conseille.
  const recommendLink = showLink && currentLanguage() === "fr";
  const recommended = `<em class="tag">${t("editor.recommended")}</em>`;
  const manual: ManualFiche =
    current?.kind === "manual"
      ? current.fiche
      : {
          name: tokenName,
          type: "",
          ac: "",
          hp: "",
          speed: "",
          abilities: ["", "", "", "", "", ""],
          props: "",
          body: "",
        };
  const field = (name: keyof ManualFiche, label: string, placeholder = "") => `
    <label>${label}<input name="${name}" value="${escapeHtml(String(manual[name]))}" placeholder="${escapeHtml(placeholder)}" /></label>`;

  app.innerHTML = `
    <div class="editor">
      <header class="bar">
        <span class="title">${t("editor.title")}${tokenName ? ` <small>· ${escapeHtml(tokenName)}</small>` : ""}</span>
        <button type="button" class="icon" id="cancel" title="${t("common.close")}">${icon("close")}</button>
      </header>
      <div class="pane" data-pane="choice">
        <h2>${t("editor.question")}</h2>
        <div class="choices">
          <button type="button" class="choice" data-go="open5e">
            <span class="choice-icon">${icon("book", 18)}</span>
            <span><strong>${t("editor.choice.open5e")}${recommendLink ? "" : recommended}</strong><small>${t("editor.choice.open5eHint")}</small></span>
          </button>
          ${
            showLink
              ? `<button type="button" class="choice" data-go="link">
            <span class="choice-icon">${icon("link", 18)}</span>
            <span><strong>${t("editor.choice.link")}${recommendLink ? recommended : ""}</strong><small>${t("editor.choice.linkHint")}</small></span>
          </button>`
              : ""
          }
          <button type="button" class="choice" data-go="manual">
            <span class="choice-icon">${icon("pen", 18)}</span>
            <span><strong>${t("editor.choice.manual")}</strong><small>${t("editor.choice.manualHint")}</small></span>
          </button>
        </div>
      </div>

      <button type="button" class="btn ghost small back-link" id="back" hidden>${icon("back", 14)}${t("editor.back").replace("← ", "")}</button>

      <div class="pane" data-pane="open5e">
        <div class="search">${icon("search", 14)}
          <input id="open5e-search" type="search" autocomplete="off" aria-label="${t("editor.open5e.label")}" placeholder="${t("editor.open5e.placeholder")}" />
        </div>
        <p class="error" id="open5e-error" hidden></p>
        <div class="results" id="open5e-results"><p class="hint">${t("editor.open5e.hint")}</p></div>
      </div>

      <form id="link-form" class="pane" data-pane="link">
        <label>${t("editor.link.label")}
          <input name="url" autocomplete="off" placeholder="https://www.aidedd.org/dnd/monstres.php?vf=tertre-errant"
            value="${current?.kind === "link" ? escapeHtml(current.url) : ""}" />
        </label>
        <p class="error" id="link-error" hidden></p>
        <div class="row">
          <button type="submit" class="btn primary" id="link-submit">${t("editor.link.attach")}</button>
          <button type="button" class="btn" id="adapt">${t("editor.link.adapt")}</button>
          <button type="button" class="btn" id="to-manual" hidden>${t("editor.link.toManual")}</button>
        </div>
        <p class="hint">${t("editor.link.hint")}</p>
      </form>

      <form id="manual-form" class="pane" data-pane="manual">
        <div class="group">
          ${field("name", t("editor.manual.name"))}
          ${field("type", t("editor.manual.type"), t("editor.manual.typePlaceholder"))}
        </div>
        <div class="row3">
          ${field("ac", t("editor.manual.ac"), t("editor.manual.acPlaceholder"))}
          ${field("hp", t("editor.manual.hp"), t("editor.manual.hpPlaceholder"))}
          ${field("speed", t("editor.manual.speed"), t("editor.manual.speedPlaceholder"))}
        </div>
        <div class="row6">
          ${abilityLabels()
            .map(
              (label, index) => `
            <label>${label}<input name="ability${index}" inputmode="numeric" value="${escapeHtml(manual.abilities[index] ?? "")}" /></label>`,
            )
            .join("")}
        </div>
        <label>${t("editor.manual.props")} <small>${t("editor.manual.propsHint")}</small>
          <textarea name="props" rows="5" placeholder="${escapeHtml(t("editor.manual.propsPlaceholder"))}">${escapeHtml(manual.props)}</textarea>
        </label>
        <label>${t("editor.manual.body")} <small>${t("editor.manual.bodyHint")}</small>
          <textarea name="body" rows="9" placeholder="${escapeHtml(t("editor.manual.bodyPlaceholder"))}">${escapeHtml(manual.body)}</textarea>
        </label>
        <p class="error" id="manual-error" hidden></p>
      </form>

      <footer class="footer" id="footer">
        ${current ? `<button type="button" class="btn danger" id="remove">${icon("trash", 14)}${t("editor.remove")}</button>` : ""}
        <span class="spacer"></span>
        <button type="submit" form="manual-form" class="btn primary" id="manual-submit">${t("editor.manual.submit")}</button>
      </footer>
    </div>`;

  const showTab = (name: EditorTab) => {
    app.querySelectorAll<HTMLElement>(".pane").forEach((pane) => {
      pane.hidden = pane.dataset.pane !== name;
    });
    app.querySelector<HTMLButtonElement>("#back")!.hidden = name === "choice";
    // Le pied n'a de sens qu'avec la saisie à la main, ou pour retirer une fiche existante.
    app.querySelector<HTMLButtonElement>("#manual-submit")!.hidden = name !== "manual";
    app.querySelector<HTMLElement>("#footer")!.hidden = name !== "manual" && !current;
    const wanted = PANE_HEIGHTS[name] + (current || name === "manual" ? 48 : 0);
    OBR.viewport
      .getHeight()
      .then((viewport) => OBR.popover.setHeight(EDITOR_POPOVER_ID, Math.min(wanted, viewport - 32)));
    if (name === "link") app.querySelector<HTMLInputElement>("#link-form input")!.focus();
    if (name === "open5e") app.querySelector<HTMLInputElement>("#open5e-search")!.focus();
  };
  showTab(tab === "link" && !showLink ? "choice" : tab);
  app.querySelector<HTMLButtonElement>("#back")!.onclick = () => showTab("choice");
  app.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((button) => {
    button.onclick = () => showTab(button.dataset.go as EditorTab);
  });

  app.querySelector<HTMLButtonElement>("#cancel")!.onclick = () => OBR.popover.close(EDITOR_POPOVER_ID);

  app.querySelector<HTMLButtonElement>("#remove")?.addEventListener("click", async () => {
    await save(undefined);
    await finish(false);
  });

  // --- Open5e ---------------------------------------------------------------------
  const searchInput = app.querySelector<HTMLInputElement>("#open5e-search")!;
  const results = app.querySelector<HTMLElement>("#open5e-results")!;
  const open5eError = app.querySelector<HTMLParagraphElement>("#open5e-error")!;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searching: AbortController | undefined;
  let found: Open5eResult[] = [];

  const showOpen5eError = (message: string) => {
    open5eError.textContent = message;
    open5eError.hidden = false;
  };
  const runSearch = async () => {
    searching?.abort();
    open5eError.hidden = true;
    const name = searchInput.value.trim();
    if (name.length < 2) {
      results.innerHTML = `<p class="hint">${name ? t("editor.open5e.short") : t("editor.open5e.hint")}</p>`;
      return;
    }
    const controller = (searching = new AbortController());
    results.innerHTML = `<p class="loading"><span class="spinner"></span>${t("common.loading")}</p>`;
    try {
      found = await searchCreatures(name, controller.signal);
    } catch (error) {
      if (controller.signal.aborted) return;
      results.innerHTML = "";
      showOpen5eError(errorText(error, t("fiche.open5eUnreachable")));
      return;
    }
    results.innerHTML = found.length
      ? found
          .map(
            (creature, index) => `
        <div class="result">
          <span>
            <strong>${escapeHtml(creature.name)}</strong>
            <small>${escapeHtml([creature.size?.name, creature.type?.name].filter(Boolean).join(" "))} · ${t("editor.open5e.cr", { cr: formatChallenge(creature.challenge_rating) })} · ${escapeHtml(creature.document?.display_name ?? creature.document?.name ?? "")}</small>
          </span>
          <button type="button" class="btn small ghost" data-adapt="${index}" title="${t("editor.link.adapt")}">${t("editor.link.adapt")}</button>
          <button type="button" class="btn small primary" data-attach="${index}">${t("editor.open5e.attach")}</button>
        </div>`,
          )
          .join("")
      : `<div class="empty">${icon("search", 22)}<span>${t("editor.open5e.empty")}</span></div>`;
  };
  searchInput.oninput = () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(runSearch, SEARCH_DELAY_MS);
  };
  results.onclick = async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!button) return;
    const creature = found[Number(button.dataset.attach ?? button.dataset.adapt)];
    if (!creature) return;
    const label = button.textContent;
    button.disabled = true;
    button.innerHTML = `<span class="spinner"></span>`;
    open5eError.hidden = true;
    try {
      // Chargée d'abord : la fiche est vérifiée, et en cache pour la fenêtre.
      const statblock = await loadCreature(creature.key);
      if (button.dataset.attach !== undefined) {
        await save({ kind: "open5e", key: creature.key });
        await finish(true);
      } else {
        fillManualForm(statblockToManual(statblock));
        showTab("manual");
      }
    } catch (error) {
      showOpen5eError(errorText(error, t("window.error")));
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  };
  if (current?.kind === "open5e") {
    searchInput.value = current.key.replace(/^srd(-\d+)?_/, "").replace(/-/g, " ");
    runSearch();
  }

  // --- AideDD ---------------------------------------------------------------------
  const linkForm = app.querySelector<HTMLFormElement>("#link-form")!;
  const linkInput = linkForm.elements.namedItem("url") as HTMLInputElement;
  const linkError = app.querySelector<HTMLParagraphElement>("#link-error")!;
  const submit = app.querySelector<HTMLButtonElement>("#link-submit")!;
  const toManual = app.querySelector<HTMLButtonElement>("#to-manual")!;
  toManual.onclick = () => showTab("manual");
  const adapt = app.querySelector<HTMLButtonElement>("#adapt")!;

  const withLoadedLink = async (
    button: HTMLButtonElement,
    fallbackError: string,
    action: (statblock: Statblock) => Promise<void> | void,
  ) => {
    const label = button.textContent;
    linkError.hidden = true;
    toManual.hidden = true;
    submit.disabled = adapt.disabled = true;
    button.textContent = t("common.loading");
    try {
      await action(await loadFromAidedd(linkInput.value));
    } catch (error) {
      linkError.textContent = errorText(error, fallbackError);
      linkError.hidden = false;
      toManual.hidden = false;
    } finally {
      submit.disabled = adapt.disabled = false;
      button.textContent = label;
    }
  };
  const attach = () =>
    withLoadedLink(submit, t("editor.link.attachError"), async () => {
      await save({ kind: "link", url: normalizeFicheUrl(linkInput.value)! });
      await finish(true);
    });
  // Rien n'est enregistré ici : le lien reste en place tant que le formulaire n'est pas validé.
  adapt.onclick = () =>
    withLoadedLink(adapt, t("editor.link.loadError"), (statblock) => {
      fillManualForm(statblockToManual(statblock));
      showTab("manual");
    });
  linkForm.onsubmit = (event) => {
    event.preventDefault();
    attach();
  };
  linkInput.addEventListener("paste", () => {
    // La valeur n'est à jour qu'après l'événement.
    setTimeout(() => {
      if (normalizeFicheUrl(linkInput.value)) attach();
    });
  });

  // --- Saisie à la main -------------------------------------------------------------
  const manualForm = app.querySelector<HTMLFormElement>("#manual-form")!;
  const fillManualForm = (fiche: ManualFiche) => {
    const set = (name: string, value: string) => {
      (manualForm.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value = value;
    };
    for (const name of ["name", "type", "ac", "hp", "speed", "props", "body"] as const) {
      set(name, fiche[name]);
    }
    fiche.abilities.forEach((score, index) => set(`ability${index}`, score ?? ""));
  };

  manualForm.oninput = () => {
    app.querySelector<HTMLParagraphElement>("#manual-error")!.hidden = true;
  };
  manualForm.onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(manualForm);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const fiche: ManualFiche = {
      name: value("name"),
      type: value("type"),
      ac: value("ac"),
      hp: value("hp"),
      speed: value("speed"),
      abilities: abilityLabels().map((_, index) => value(`ability${index}`)),
      props: value("props"),
      body: value("body"),
    };
    const manualError = app.querySelector<HTMLParagraphElement>("#manual-error")!;
    const size = byteSize(fiche);
    if (!fiche.name) {
      manualError.textContent = t("editor.manual.nameRequired");
    } else if (size > MAX_MANUAL_BYTES) {
      manualError.textContent = t("editor.manual.tooLong", {
        size: Math.ceil(size / 1024),
        max: MAX_MANUAL_BYTES / 1024,
      });
    } else {
      try {
        await save({ kind: "manual", fiche });
        await finish(true);
        return;
      } catch (error) {
        manualError.textContent = errorText(error, t("editor.manual.saveError"));
      }
    }
    manualError.hidden = false;
  };
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    await OBR.popover.close(EDITOR_POPOVER_ID);
    return;
  }
  document.documentElement.lang = currentLanguage();
  const [item] = await OBR.scene.items.getItems([itemId]);
  let current: TokenFiche | undefined;
  try {
    current = await reveal<TokenFiche | undefined>(item?.metadata[METADATA_KEY]);
  } catch (error) {
    if (error instanceof LockedError) {
      renderLocked();
      return;
    }
    throw error;
  }
  // Token sans fiche : on commence par le choix de la méthode.
  const tab = (params.get("tab") as EditorTab | null) ?? current?.kind ?? "choice";
  render(current, item?.name ?? "", tab);
});
