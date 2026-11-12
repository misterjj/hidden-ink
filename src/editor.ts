import OBR from "@owlbear-rodeo/sdk";
import { ficheSite, normalizeFicheUrl } from "../shared/fiche-url";
import { LockedError, MissingKeyError, byteSize, reveal, seal } from "./crypto";
import { FicheError, aideddAvailable, loadFromLink } from "./data";
import { currentLanguage, t } from "./i18n";
import { labelWithHelp, wireHelp } from "./help";
import { watchSteppers } from "./stepper";
import { icon, type IconName } from "./icons";
import { abilityLabels, escapeHtml, statblockToManual } from "./manual";
import {
  DAGGERHEART_ROWS,
  PF2E_ROWS,
  daggerheartFormHtml,
  pf2eFormHtml,
  readDaggerheartForm,
  readPf2eForm,
  wireSystemForm,
} from "./system-forms";
import { emptyDaggerheart, emptyPf2e, statblockToDaggerheart, statblockToPf2e } from "./systems";
import { NOTE_CHANNEL, type NoteMessage } from "./notes";
import { formatChallenge, loadCreature, searchCreatures, type Open5eResult } from "./open5e";
import "./style.css";
import "./theme";
import {
  CHANNEL,
  EDITOR_POPOVER_ID,
  METADATA_KEY,
  type EditorTab,
  type GenericFiche,
  type ManualFiche,
  type Message,
  type Statblock,
  type TokenFiche,
} from "./types";

// Les métadonnées sont synchronisées dans la scène : on évite d'y mettre un roman.
const MAX_MANUAL_BYTES = 12 * 1024;
const PANE_HEIGHTS: Record<EditorTab, number> = {
  choice: 400,
  open5e: 520,
  link: 300,
  aon: 300,
  dhsrd: 300,
  manual: 780,
  pf2e: 800,
  daggerheart: 760,
  generic: 600,
};
const SEARCH_DELAY_MS = 300;

/** Le même formulaire de lien sert aux trois sites ; seuls les textes changent. */
type LinkTab = "link" | "aon" | "dhsrd";
const isLinkTab = (tab: EditorTab): tab is LinkTab => tab === "link" || tab === "aon" || tab === "dhsrd";

const LINK_TEXT: Record<LinkTab, () => { placeholder: string; hint: string }> = {
  link: () => ({ placeholder: "https://www.aidedd.org/dnd/monstres.php?vf=tertre-errant", hint: t("editor.link.hint") }),
  aon: () => ({ placeholder: "https://2e.aonprd.com/Monsters.aspx?ID=3330", hint: t("editor.link.aonHint") }),
  dhsrd: () => ({
    placeholder: "https://seansbox.github.io/daggerheart-srd/adversaries/Bear/",
    hint: t("editor.link.daggerheartHint"),
  }),
};

/** Jeux proposés en onglets dans l'écran de choix. */
type GameSystem = "dnd" | "pf2e" | "daggerheart" | "other";
const SYSTEMS: GameSystem[] = ["dnd", "pf2e", "daggerheart", "other"];
const SYSTEM_KEY = "hidden-ink/systeme";

/** Dernier jeu choisi dans ce navigateur : son onglet s'ouvre en premier. */
function savedSystem(): GameSystem | null {
  try {
    const value = localStorage.getItem(SYSTEM_KEY) as GameSystem | null;
    return value && SYSTEMS.includes(value) ? value : null;
  } catch {
    return null;
  }
}

function saveSystem(system: GameSystem) {
  try {
    localStorage.setItem(SYSTEM_KEY, system);
  } catch {
    // Sans stockage, le choix ne dure que le temps de la fenêtre.
  }
}

/** Onglet d'un lien déjà posé, selon son site. */
const linkTab = (url: string): LinkTab =>
  ({ aidedd: "link", aon: "aon", daggerheart: "dhsrd" } as const)[ficheSite(normalizeFicheUrl(url) ?? url)];

/** Saisie guidée où « Adapter » recopie la fiche d'un lien. */
const FORM_FOR_LINK = { link: "manual", aon: "pf2e", dhsrd: "daggerheart" } as const;

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
  const currentUrl = current?.kind === "link" ? current.url : "";
  // Un lien AideDD déjà posé reste modifiable, même si AideDD a été retiré au build.
  const showLink = aideddAvailable() || (currentUrl !== "" && linkTab(currentUrl) === "link");
  // Onglet ouvert en premier : le jeu de la fiche déjà posée, sinon le dernier choisi.
  const currentSystem: GameSystem | null =
    current?.kind === "link"
      ? ({ link: "dnd", aon: "pf2e", dhsrd: "daggerheart" } as const)[linkTab(currentUrl)]
      : current?.kind === "manual" || current?.kind === "open5e"
        ? "dnd"
        : current?.kind === "pf2e" || current?.kind === "daggerheart"
          ? current.kind
          : null;
  let system: GameSystem = currentSystem ?? savedSystem() ?? "dnd";
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
  const generic: GenericFiche =
    current?.kind === "generic" ? current.fiche : { name: tokenName, type: "", props: "", body: "" };
  const field = (name: keyof ManualFiche, label: string, placeholder = "") => `
    <label>${label}<input name="${name}" value="${escapeHtml(String(manual[name]))}" placeholder="${escapeHtml(placeholder)}" /></label>`;
  const genericField = (name: "name" | "type", label: string, placeholder = "") => `
    <label>${label}<input name="${name}" value="${escapeHtml(generic[name])}" placeholder="${escapeHtml(placeholder)}" /></label>`;
  const choice = (go: EditorTab, iconName: IconName, title: string, hint: string) => `
          <button type="button" class="choice" data-go="${go}">
            <span class="choice-icon">${icon(iconName, 18)}</span>
            <span><strong>${title}</strong><small>${hint}</small></span>
          </button>`;
  const CHOICES: Record<GameSystem, string> = {
    dnd: [
      showLink ? choice("link", "link", t("editor.choice.link"), t("editor.choice.linkHint")) : "",
      choice("open5e", "book", t("editor.choice.open5e"), t("editor.choice.open5eHint")),
      choice("manual", "pen", t("editor.choice.manual"), t("editor.choice.manualHint")),
    ].join(""),
    pf2e: [
      choice("aon", "link", t("editor.choice.aon"), t("editor.choice.aonHint")),
      choice("pf2e", "pen", t("editor.choice.manual"), t("editor.choice.manualPf2eHint")),
    ].join(""),
    daggerheart: [
      choice("dhsrd", "link", t("editor.choice.daggerheart"), t("editor.choice.daggerheartHint")),
      choice("daggerheart", "pen", t("editor.choice.manual"), t("editor.choice.manualDaggerheartHint")),
    ].join(""),
    other: choice("generic", "sheet", t("editor.choice.generic"), t("editor.choice.genericHint")),
  };
  app.innerHTML = `
    <div class="editor">
      <header class="bar">
        <span class="title">${t("editor.title")}${tokenName ? ` <small>· ${escapeHtml(tokenName)}</small>` : ""}</span>
        <button type="button" class="icon" id="cancel" title="${t("common.close")}">${icon("close")}</button>
      </header>
      <div class="pane" data-pane="choice">
        <h2>${t("editor.question")}</h2>
        <div class="segmented systems" role="tablist" aria-label="${t("editor.system.label")}">
          ${SYSTEMS.map(
            (name) =>
              `<button type="button" role="tab" data-system="${name}" aria-selected="${name === system}" aria-pressed="${name === system}">${t(`editor.system.${name}`)}</button>`,
          ).join("")}
        </div>
        <div class="choices" id="choices" role="tabpanel"></div>
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
          <input name="url" autocomplete="off" value="${escapeHtml(currentUrl)}" />
        </label>
        <p class="error" id="link-error" hidden></p>
        <div class="row">
          <button type="submit" class="btn primary" id="link-submit">${t("editor.link.attach")}</button>
          <button type="button" class="btn" id="adapt">${t("editor.link.adapt")}</button>
          <button type="button" class="btn" id="to-manual" hidden>${t("editor.link.toManual")}</button>
        </div>
        <p class="hint" id="link-hint"></p>
      </form>

      <form id="manual-form" class="pane" data-pane="manual">
        <div class="group">
          ${field("name", labelWithHelp(t("editor.manual.name"), t("help.name")))}
          ${field("type", labelWithHelp(t("editor.manual.type"), t("help.dnd.type")), t("editor.manual.typePlaceholder"))}
        </div>
        <div class="row3">
          ${field("ac", labelWithHelp(t("editor.manual.ac"), t("help.dnd.ac")), t("editor.manual.acPlaceholder"))}
          ${field("hp", labelWithHelp(t("editor.manual.hp"), t("help.dnd.hp")), t("editor.manual.hpPlaceholder"))}
          ${field("speed", labelWithHelp(t("editor.manual.speed"), t("help.dnd.speed")), t("editor.manual.speedPlaceholder"))}
        </div>
        <p class="field-caption">${labelWithHelp(t("editor.attributes"), t("help.dnd.abilities"))}</p>
        <div class="row6">
          ${abilityLabels()
            .map(
              (label, index) => `
            <label>${label}<input name="ability${index}" inputmode="numeric" value="${escapeHtml(manual.abilities[index] ?? "")}" /></label>`,
            )
            .join("")}
        </div>
        <label>${labelWithHelp(t("editor.manual.props"), t("help.props"))}
          <textarea name="props" rows="5" placeholder="${escapeHtml(t("editor.manual.propsPlaceholder"))}">${escapeHtml(manual.props)}</textarea>
        </label>
        <label>${labelWithHelp(t("editor.manual.body"), t("help.body"))}
          <textarea name="body" rows="9" placeholder="${escapeHtml(t("editor.manual.bodyPlaceholder"))}">${escapeHtml(manual.body)}</textarea>
        </label>
        <p class="error" id="manual-error" hidden></p>
      </form>

      <form id="generic-form" class="pane" data-pane="generic">
        <div class="group">
          ${genericField("name", labelWithHelp(t("editor.manual.name"), t("help.name")))}
          ${genericField("type", labelWithHelp(t("editor.generic.type"), t("help.generic.type")), t("editor.generic.typePlaceholder"))}
        </div>
        <label>${labelWithHelp(t("editor.generic.props"), t("help.props"))}
          <textarea name="props" rows="6" placeholder="${escapeHtml(t("editor.generic.propsPlaceholder"))}">${escapeHtml(generic.props)}</textarea>
        </label>
        <label>${labelWithHelp(t("editor.generic.body"), t("help.body"))}
          <textarea name="body" rows="10" placeholder="${escapeHtml(t("editor.generic.bodyPlaceholder"))}">${escapeHtml(generic.body)}</textarea>
        </label>
        <p class="error" id="generic-error" hidden></p>
      </form>

      <form id="pf2e-form" class="pane system-form" data-pane="pf2e">${pf2eFormHtml(
        current?.kind === "pf2e" ? current.fiche : emptyPf2e(tokenName),
      )}</form>

      <form id="daggerheart-form" class="pane system-form" data-pane="daggerheart">${daggerheartFormHtml(
        current?.kind === "daggerheart" ? current.fiche : emptyDaggerheart(tokenName),
      )}</form>

      <footer class="footer" id="footer">
        ${current ? `<button type="button" class="btn danger" id="remove">${icon("trash", 14)}${t("editor.remove")}</button>` : ""}
        <span class="spacer"></span>
        <button type="submit" form="manual-form" class="btn primary" id="form-submit">${t("editor.manual.submit")}</button>
      </footer>
    </div>`;

  /** Site du formulaire de lien : décide de ses textes et du formulaire où « Adapter » recopie la fiche. */
  let linkSite: LinkTab = currentUrl ? linkTab(currentUrl) : "link";
  const showTab = (name: EditorTab) => {
    if (isLinkTab(name)) {
      linkSite = name;
      const text = LINK_TEXT[name]();
      app.querySelector<HTMLInputElement>("#link-form input")!.placeholder = text.placeholder;
      app.querySelector<HTMLElement>("#link-hint")!.innerHTML = text.hint;
    }
    const pane = isLinkTab(name) ? "link" : name;
    app.querySelectorAll<HTMLElement>(".pane").forEach((element) => {
      element.hidden = element.dataset.pane !== pane;
    });
    app.querySelector<HTMLButtonElement>("#back")!.hidden = name === "choice";
    // Le pied n'a de sens qu'avec un formulaire, ou pour retirer une fiche existante.
    const isForm = name === "manual" || name === "generic" || name === "pf2e" || name === "daggerheart";
    const submitButton = app.querySelector<HTMLButtonElement>("#form-submit")!;
    submitButton.hidden = !isForm;
    if (isForm) submitButton.setAttribute("form", `${name}-form`);
    app.querySelector<HTMLElement>("#footer")!.hidden = !isForm && !current;
    const wanted = PANE_HEIGHTS[name] + (current || isForm ? 48 : 0);
    OBR.viewport
      .getHeight()
      .then((viewport) => OBR.popover.setHeight(EDITOR_POPOVER_ID, Math.min(wanted, viewport - 32)));
    if (isLinkTab(name)) app.querySelector<HTMLInputElement>("#link-form input")!.focus();
    if (name === "open5e") app.querySelector<HTMLInputElement>("#open5e-search")!.focus();
  };
  showTab(tab === "link" && !showLink ? "choice" : tab);
  app.querySelector<HTMLButtonElement>("#back")!.onclick = () => showTab("choice");
  wireHelp(app);
  // Une seule surveillance pour toute la page, même redessinée.
  if (!app.dataset.steppers) {
    app.dataset.steppers = "1";
    watchSteppers(app);
  }

  // --- Onglets des jeux ---------------------------------------------------------------
  const choices = app.querySelector<HTMLElement>("#choices")!;
  const showSystem = (name: GameSystem) => {
    system = name;
    app.querySelectorAll<HTMLButtonElement>("[data-system]").forEach((button) => {
      const selected = button.dataset.system === name;
      button.setAttribute("aria-selected", String(selected));
      button.setAttribute("aria-pressed", String(selected));
    });
    choices.innerHTML = CHOICES[name];
  };
  showSystem(system);
  app.querySelectorAll<HTMLButtonElement>("[data-system]").forEach((button) => {
    button.onclick = () => showSystem(button.dataset.system as GameSystem);
  });
  choices.onclick = (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-go]");
    if (!button) return;
    // Le jeu choisi s'ouvrira en premier la prochaine fois.
    saveSystem(system);
    showTab(button.dataset.go as EditorTab);
  };

  app.querySelector<HTMLButtonElement>("#cancel")!.onclick = () => OBR.popover.close(EDITOR_POPOVER_ID);

  app.querySelector<HTMLButtonElement>("#remove")?.addEventListener("click", async () => {
    await save(undefined);
    await finish(false);
  });

  // --- Saisie à la main et fiche libre ---------------------------------------------------
  const manualForm = app.querySelector<HTMLFormElement>("#manual-form")!;
  const genericForm = app.querySelector<HTMLFormElement>("#generic-form")!;
  const setField = (form: HTMLFormElement, name: string, value: string) => {
    (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value = value;
  };
  const fillManualForm = (fiche: ManualFiche) => {
    for (const name of ["name", "type", "ac", "hp", "speed", "props", "body"] as const) {
      setField(manualForm, name, fiche[name]);
    }
    fiche.abilities.forEach((score, index) => setField(manualForm, `ability${index}`, score ?? ""));
  };
  const pf2eForm = app.querySelector<HTMLFormElement>("#pf2e-form")!;
  const daggerheartForm = app.querySelector<HTMLFormElement>("#daggerheart-form")!;
  const fillPf2eForm = (fiche: Parameters<typeof pf2eFormHtml>[0]) => {
    pf2eForm.innerHTML = pf2eFormHtml(fiche);
  };
  const fillDaggerheartForm = (fiche: Parameters<typeof daggerheartFormHtml>[0]) => {
    daggerheartForm.innerHTML = daggerheartFormHtml(fiche);
  };
  wireSystemForm(pf2eForm, PF2E_ROWS);
  wireSystemForm(daggerheartForm, DAGGERHEART_ROWS, fillDaggerheartForm);

  /** Vérifie la taille, enregistre sur le token et ouvre la fiche. */
  const submitForm = async (form: HTMLFormElement, errorId: string, fiche: TokenFiche & { fiche: { name: string } }) => {
    const error = app.querySelector<HTMLParagraphElement>(errorId)!;
    const size = byteSize(fiche.fiche);
    if (!fiche.fiche.name) {
      error.textContent = t("editor.manual.nameRequired");
    } else if (size > MAX_MANUAL_BYTES) {
      error.textContent = t("editor.manual.tooLong", {
        size: Math.ceil(size / 1024),
        max: MAX_MANUAL_BYTES / 1024,
      });
    } else {
      try {
        await save(fiche);
        await finish(true);
        return;
      } catch (saveError) {
        error.textContent = errorText(saveError, t("editor.manual.saveError"));
      }
    }
    error.hidden = false;
    form.querySelector<HTMLElement>("[name=name]")?.focus();
  };
  const formValue = (form: HTMLFormElement) => {
    const data = new FormData(form);
    return (key: string) => String(data.get(key) ?? "").trim();
  };

  manualForm.oninput = () => {
    app.querySelector<HTMLParagraphElement>("#manual-error")!.hidden = true;
  };
  manualForm.onsubmit = (event) => {
    event.preventDefault();
    const value = formValue(manualForm);
    submitForm(manualForm, "#manual-error", {
      kind: "manual",
      fiche: {
        name: value("name"),
        type: value("type"),
        ac: value("ac"),
        hp: value("hp"),
        speed: value("speed"),
        abilities: abilityLabels().map((_, index) => value(`ability${index}`)),
        props: value("props"),
        body: value("body"),
      },
    });
  };

  for (const form of [pf2eForm, daggerheartForm]) {
    form.oninput = () => {
      form.querySelector<HTMLElement>("[data-error]")!.hidden = true;
    };
  }
  pf2eForm.onsubmit = (event) => {
    event.preventDefault();
    submitForm(pf2eForm, "#pf2e-form [data-error]", { kind: "pf2e", fiche: readPf2eForm(pf2eForm) });
  };
  daggerheartForm.onsubmit = (event) => {
    event.preventDefault();
    submitForm(daggerheartForm, "#daggerheart-form [data-error]", {
      kind: "daggerheart",
      fiche: readDaggerheartForm(daggerheartForm),
    });
  };

  genericForm.oninput = () => {
    app.querySelector<HTMLParagraphElement>("#generic-error")!.hidden = true;
  };
  genericForm.onsubmit = (event) => {
    event.preventDefault();
    const value = formValue(genericForm);
    submitForm(genericForm, "#generic-error", {
      kind: "generic",
      fiche: { name: value("name"), type: value("type"), props: value("props"), body: value("body") },
    });
  };

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

  // --- Lien : AideDD, Archives of Nethys ou SRD Daggerheart ------------------------
  const linkForm = app.querySelector<HTMLFormElement>("#link-form")!;
  const linkInput = linkForm.elements.namedItem("url") as HTMLInputElement;
  const linkError = app.querySelector<HTMLParagraphElement>("#link-error")!;
  const submit = app.querySelector<HTMLButtonElement>("#link-submit")!;
  const toManual = app.querySelector<HTMLButtonElement>("#to-manual")!;
  // Chaque lien se recopie dans la saisie guidée de son jeu.
  const formFor = () => FORM_FOR_LINK[linkSite];
  toManual.onclick = () => showTab(formFor());
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
      await action(await loadFromLink(linkInput.value));
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
      if (formFor() === "manual") fillManualForm(statblockToManual(statblock));
      else if (formFor() === "pf2e") fillPf2eForm(statblockToPf2e(statblock));
      else fillDaggerheartForm(statblockToDaggerheart(statblock));
      showTab(formFor());
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
  const tab =
    (params.get("tab") as EditorTab | null) ?? (current?.kind === "link" ? linkTab(current.url) : current?.kind) ?? "choice";
  render(current, item?.name ?? "", tab);
});
