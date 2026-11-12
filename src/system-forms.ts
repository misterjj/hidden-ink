// Formulaires guidés de Pathfinder 2e et Daggerheart dans l'éditeur de fiche.

import { t } from "./i18n";
import { labelWithHelp } from "./help";
import { icon } from "./icons";
import { escapeHtml } from "./manual";
import { ACTION_GLYPHS, DH_ADVERSARY_TYPES, DH_ENVIRONMENT_TYPES, DH_RANGES, PF2E_SIZES } from "./systems";
import type { ActionCost, DaggerheartFiche, DaggerheartFeatureKind, Pf2eFiche, SheetPlace } from "./types";

const attr = (value: string) => escapeHtml(value ?? "");

const input = (name: string, label: string, value: string, placeholder = "", extra = "") => `
  <label>${label}<input name="${name}" value="${attr(value)}" placeholder="${attr(placeholder)}" ${extra} /></label>`;

const select = (name: string, label: string, value: string, options: [string, string][]) => `
  <label>${label}<select name="${name}">${options
    .map(([key, text]) => `<option value="${attr(key)}"${key === value ? " selected" : ""}>${escapeHtml(text)}</option>`)
    .join("")}</select></label>`;

const removeButton = () =>
  `<button type="button" class="icon remove-row" data-remove title="${t("editor.rows.remove")}">${icon("trash", 14)}</button>`;

const rowInput = (field: string, value: string, placeholder: string, className = "") =>
  `<input data-field="${field}" class="${className}" value="${attr(value)}" placeholder="${attr(placeholder)}" aria-label="${attr(placeholder)}" />`;

const rowSelect = (field: string, value: string, options: [string, string][], label: string) =>
  `<select data-field="${field}" aria-label="${attr(label)}">${options
    .map(([key, text]) => `<option value="${attr(key)}"${key === value ? " selected" : ""}>${escapeHtml(text)}</option>`)
    .join("")}</select>`;

const rowText = (field: string, value: string, placeholder: string) =>
  `<textarea data-field="${field}" rows="2" placeholder="${attr(placeholder)}" aria-label="${attr(placeholder)}">${escapeHtml(value)}</textarea>`;

/** Libellé et son « ? » ; le texte d'aide est une clé de traduction. */
const L = (label: string, tip: Parameters<typeof t>[0]) => labelWithHelp(label, t(tip));

const rows = (name: string, title: string, addLabel: string, items: string[], tip: Parameters<typeof t>[0]) => `
  <section class="rows-block">
    <h3>${L(title, tip)}</h3>
    <div class="rows" data-rows="${name}">${items.join("")}</div>
    <button type="button" class="btn small ghost add-row" data-add="${name}">+ ${addLabel}</button>
  </section>`;

// --- Pathfinder 2e -------------------------------------------------------------------------

const actionOptions = (): [string, string][] => [
  ["", t("editor.pf2e.noAction")],
  ...(Object.entries(ACTION_GLYPHS) as [Exclude<ActionCost, "">, string][]).map(
    ([key, glyph]) => [key, `${glyph} ${t(`editor.pf2e.action.${key}`)}`] as [string, string],
  ),
];

const placeOptions = (): [string, string][] =>
  (["top", "defense", "offense"] as SheetPlace[]).map((place) => [place, t(`editor.pf2e.place.${place}`)]);

const strikeRow = (strike: Pf2eFiche["strikes"][number]) => `
  <div class="row-item strike" data-row>
    ${rowSelect("ranged", strike.ranged ? "1" : "", [["", t("sheet.pf2e.melee")], ["1", t("sheet.pf2e.ranged")]], t("editor.pf2e.strikeKind"))}
    ${rowInput("name", strike.name, t("editor.pf2e.strikeName"))}
    ${rowInput("bonus", strike.bonus, "+12", "short")}
    ${removeButton()}
    ${rowInput("traits", strike.traits, t("editor.pf2e.strikeTraits"), "wide")}
    ${rowInput("damage", strike.damage, t("editor.pf2e.strikeDamage"), "wide")}
  </div>`;

const abilityRow = (ability: Pf2eFiche["abilities"][number]) => `
  <div class="row-item ability-row" data-row>
    ${rowInput("name", ability.name, t("editor.pf2e.abilityName"))}
    ${rowSelect("actions", ability.actions, actionOptions(), t("editor.pf2e.actions"))}
    ${rowSelect("place", ability.place, placeOptions(), t("editor.pf2e.placeLabel"))}
    ${removeButton()}
    ${rowInput("traits", ability.traits, t("editor.pf2e.abilityTraits"), "wide")}
    ${rowText("text", ability.text, t("editor.pf2e.abilityText"))}
  </div>`;

export const PF2E_ROWS = {
  strikes: () => strikeRow({ ranged: false, name: "", bonus: "", traits: "", damage: "" }),
  abilities: () => abilityRow({ name: "", actions: "1", traits: "", text: "", place: "offense" }),
};

export function pf2eFormHtml(fiche: Pf2eFiche) {
  const attributes = t("sheet.pf2e.attributes").split(",");
  const saves = t("sheet.pf2e.saveLabels").split(",");
  return `
    <div class="group">
      ${input("name", L(t("editor.manual.name"), "help.name"), fiche.name)}
      <div class="row3 head-row">
        ${input("level", L(t("editor.pf2e.level"), "help.pf2e.level"), fiche.level, "4", 'type="number" min="-1" max="25" step="1"')}
        ${select("rarity", t("editor.pf2e.rarity"), fiche.rarity, (["common", "uncommon", "rare", "unique"] as const).map((key) => [key, t(`sheet.pf2e.rarity.${key}`)]))}
        ${select("size", t("editor.pf2e.size"), fiche.size, PF2E_SIZES.map((key) => [key, t(`sheet.pf2e.size.${key}`)]))}
      </div>
      ${input("traits", L(t("editor.pf2e.traits"), "help.pf2e.traits"), fiche.traits, t("editor.pf2e.traitsPlaceholder"))}
    </div>
    ${input("perception", L(t("sheet.pf2e.perception"), "help.pf2e.perception"), fiche.perception, t("editor.pf2e.perceptionPlaceholder"))}
    ${input("languages", L(t("sheet.languages"), "help.pf2e.languages"), fiche.languages, t("editor.pf2e.languagesPlaceholder"))}
    ${input("skills", L(t("sheet.skills"), "help.pf2e.skills"), fiche.skills, t("editor.pf2e.skillsPlaceholder"))}
    <p class="field-caption">${L(t("editor.pf2e.attributesLabel"), "help.pf2e.attributes")}</p>
    <div class="row6">
      ${attributes.map((label, index) => input(`attribute${index}`, label, fiche.attributes[index] ?? "", "+0")).join("")}
    </div>
    ${input("items", L(t("sheet.pf2e.items"), "help.pf2e.items"), fiche.items, t("editor.pf2e.itemsPlaceholder"))}
    <h3>${t("editor.pf2e.defense")}</h3>
    <div class="row4">
      ${input("ac", L(t("sheet.pf2e.ac"), "help.pf2e.ac"), fiche.ac, "21")}
      ${saves
        .map((label, index) => input(`save${index}`, index === 0 ? L(label, "help.pf2e.saves") : label, fiche.saves[index] ?? "", "+10"))
        .join("")}
    </div>
    ${input("hp", L(t("sheet.pf2e.hp"), "help.pf2e.hp"), fiche.hp, t("editor.pf2e.hpPlaceholder"))}
    <div class="row3">
      ${input("immunities", L(t("sheet.pf2e.immunities"), "help.pf2e.iwr"), fiche.immunities)}
      ${input("weaknesses", L(t("sheet.pf2e.weaknesses"), "help.pf2e.iwr"), fiche.weaknesses)}
      ${input("resistances", L(t("sheet.pf2e.resistances"), "help.pf2e.iwr"), fiche.resistances)}
    </div>
    ${input("speed", L(t("sheet.speed"), "help.pf2e.speed"), fiche.speed, t("editor.pf2e.speedPlaceholder"))}
    ${rows("strikes", t("editor.pf2e.strikes"), t("editor.pf2e.addStrike"), fiche.strikes.map(strikeRow), "help.pf2e.strikes")}
    <label>${L(t("editor.pf2e.spells"), "help.pf2e.spells")}
      <textarea name="spells" rows="3" placeholder="${attr(t("editor.pf2e.spellsPlaceholder"))}">${escapeHtml(fiche.spells)}</textarea>
    </label>
    ${rows("abilities", t("editor.pf2e.abilities"), t("editor.pf2e.addAbility"), fiche.abilities.map(abilityRow), "help.pf2e.abilities")}
    <p class="error" data-error hidden></p>`;
}

const fieldsOf = (form: HTMLFormElement, list: string) =>
  Array.from(form.querySelectorAll<HTMLElement>(`[data-rows="${list}"] [data-row]`)).map((row) => {
    const value = (field: string) =>
      (row.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-field="${field}"]`)?.value ?? "").trim();
    return value;
  });

export function readPf2eForm(form: HTMLFormElement): Pf2eFiche {
  const data = new FormData(form);
  const value = (key: string) => String(data.get(key) ?? "").trim();
  return {
    name: value("name"),
    level: value("level"),
    rarity: value("rarity") as Pf2eFiche["rarity"],
    size: value("size"),
    traits: value("traits"),
    perception: value("perception"),
    languages: value("languages"),
    skills: value("skills"),
    attributes: [0, 1, 2, 3, 4, 5].map((index) => value(`attribute${index}`)),
    items: value("items"),
    ac: value("ac"),
    saves: [0, 1, 2].map((index) => value(`save${index}`)),
    hp: value("hp"),
    immunities: value("immunities"),
    weaknesses: value("weaknesses"),
    resistances: value("resistances"),
    speed: value("speed"),
    strikes: fieldsOf(form, "strikes")
      .map((field) => ({
        ranged: field("ranged") === "1",
        name: field("name"),
        bonus: field("bonus"),
        traits: field("traits"),
        damage: field("damage"),
      }))
      .filter((strike) => strike.name),
    spells: value("spells"),
    abilities: fieldsOf(form, "abilities")
      .map((field) => ({
        name: field("name"),
        actions: field("actions") as ActionCost,
        traits: field("traits"),
        text: field("text"),
        place: field("place") as SheetPlace,
      }))
      .filter((ability) => ability.name || ability.text),
  };
}

// --- Daggerheart -----------------------------------------------------------------------------

const KINDS: DaggerheartFeatureKind[] = ["Action", "Reaction", "Passive"];

const featureRow = (feature: DaggerheartFiche["features"][number]) => `
  <div class="row-item feature-row" data-row>
    ${rowInput("name", feature.name, t("editor.dh.featureName"))}
    ${rowSelect("kind", feature.kind, KINDS.map((kind) => [kind, t(`sheet.dh.kind.${kind}`)]), t("editor.dh.featureKind"))}
    ${removeButton()}
    ${rowText("text", feature.text, t("editor.dh.featureText"))}
  </div>`;

export const DAGGERHEART_ROWS = {
  features: () => featureRow({ name: "", kind: "Action", text: "" }),
};

export function daggerheartFormHtml(fiche: DaggerheartFiche) {
  const types = (fiche.environment ? DH_ENVIRONMENT_TYPES : DH_ADVERSARY_TYPES).map((type) => [type, type] as [string, string]);
  if (fiche.type && !types.some(([type]) => type === fiche.type)) types.push([fiche.type, fiche.type]);
  return `
    <div class="segmented dh-kind-toggle" role="group" aria-label="${t("editor.dh.kindLabel")}">
      <button type="button" data-environment="0" aria-pressed="${!fiche.environment}">${t("editor.dh.adversary")}</button>
      <button type="button" data-environment="1" aria-pressed="${fiche.environment}">${t("editor.dh.environment")}</button>
    </div>
    <input type="hidden" name="environment" value="${fiche.environment ? "1" : ""}" />
    ${input("name", L(t("editor.manual.name"), "help.name"), fiche.name)}
    <div class="row3 head-row">
      ${select("tier", t("sheet.dh.tier"), fiche.tier, ["1", "2", "3", "4"].map((tier) => [tier, tier]))}
      ${select("type", t("editor.dh.type"), fiche.type, types)}
    </div>
    <label>${L(t("editor.dh.description"), "help.dh.description")}
      <textarea name="description" rows="2" placeholder="${attr(t(fiche.environment ? "editor.dh.environmentPlaceholder" : "editor.dh.descriptionPlaceholder"))}">${escapeHtml(fiche.description)}</textarea>
    </label>
    ${input("motives", L(t(fiche.environment ? "sheet.dh.impulses" : "sheet.dh.motives"), "help.dh.motives"), fiche.motives, t(fiche.environment ? "editor.dh.impulsesPlaceholder" : "editor.dh.motivesPlaceholder"))}
    <div class="row4">
      ${input("difficulty", L(t("sheet.dh.difficulty"), "help.dh.difficulty"), fiche.difficulty, "14")}
      ${fiche.environment ? "" : `
      ${input("major", L(t("editor.dh.major"), "help.dh.thresholds"), fiche.major, "9")}
      ${input("severe", L(t("editor.dh.severe"), "help.dh.thresholds"), fiche.severe, "17")}
      ${input("hp", L(t("sheet.dh.hp"), "help.dh.boxes"), fiche.hp, "7")}
      ${input("stress", L(t("sheet.dh.stress"), "help.dh.boxes"), fiche.stress, "2")}`}
    </div>
    ${
      fiche.environment
        ? input("adversaries", L(t("sheet.dh.adversaries"), "help.dh.adversaries"), fiche.adversaries, t("editor.dh.adversariesPlaceholder"))
        : `
    <h3>${t("sheet.dh.atk")}</h3>
    <div class="row4 attack-row">
      ${input("atk", L(t("editor.dh.bonus"), "help.dh.atk"), fiche.atk, "+1")}
      ${input("weapon", L(t("editor.dh.weapon"), "help.dh.weapon"), fiche.weapon, t("editor.dh.weaponPlaceholder"))}
      ${select("range", t("editor.dh.range"), fiche.range, DH_RANGES.map((range) => [range, range]))}
      ${input("damage", L(t("editor.dh.damage"), "help.dh.damage"), fiche.damage, "1d8+3 phy")}
    </div>
    ${input("experience", L(t("sheet.dh.experience"), "help.dh.experience"), fiche.experience, t("editor.dh.experiencePlaceholder"))}`
    }
    ${rows("features", t("sheet.dh.features"), t("editor.dh.addFeature"), fiche.features.map(featureRow), "help.dh.features")}
    <p class="error" data-error hidden></p>`;
}

export function readDaggerheartForm(form: HTMLFormElement): DaggerheartFiche {
  const data = new FormData(form);
  const value = (key: string) => String(data.get(key) ?? "").trim();
  return {
    name: value("name"),
    environment: value("environment") === "1",
    tier: value("tier") || "1",
    type: value("type"),
    description: value("description"),
    motives: value("motives"),
    difficulty: value("difficulty"),
    major: value("major"),
    severe: value("severe"),
    hp: value("hp"),
    stress: value("stress"),
    atk: value("atk"),
    weapon: value("weapon"),
    range: value("range") || "Melee",
    damage: value("damage"),
    experience: value("experience"),
    adversaries: value("adversaries"),
    features: fieldsOf(form, "features")
      .map((field) => ({ name: field("name"), kind: field("kind") as DaggerheartFeatureKind, text: field("text") }))
      .filter((feature) => feature.name || feature.text),
  };
}

/** Lignes ajoutées ou retirées ; le choix adversaire / environnement redessine le formulaire. */
export function wireSystemForm(
  form: HTMLFormElement,
  rowsByName: Record<string, () => string>,
  rerender?: (fiche: DaggerheartFiche) => void,
) {
  form.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const add = target.closest<HTMLButtonElement>("[data-add]");
    if (add) {
      const list = form.querySelector<HTMLElement>(`[data-rows="${add.dataset.add}"]`)!;
      list.insertAdjacentHTML("beforeend", rowsByName[add.dataset.add!]());
      list.lastElementChild?.querySelector<HTMLElement>("input, textarea")?.focus();
      return;
    }
    const remove = target.closest<HTMLButtonElement>("[data-remove]");
    if (remove) {
      remove.closest("[data-row]")?.remove();
      return;
    }
    const toggle = target.closest<HTMLButtonElement>("[data-environment]");
    if (toggle && rerender) {
      const fiche = readDaggerheartForm(form);
      const environment = toggle.dataset.environment === "1";
      if (fiche.environment === environment) return;
      fiche.environment = environment;
      fiche.type = environment ? "Exploration" : "Standard";
      rerender(fiche);
    }
  });
}
