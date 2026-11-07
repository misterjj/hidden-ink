import { t } from "./i18n";
import { icon as uiIcon } from "./icons";
import { escapeHtml } from "./manual";
import type { Statblock } from "./types";

function abilitiesHtml(statblock: Statblock): string {
  if (!statblock.abilities.length) return "";
  return `<div class="abilities">${statblock.abilities
    .map(
      (ability) => `
      <div class="ability">
        <strong>${escapeHtml(ability.label)}</strong>
        <span>${escapeHtml(ability.score)}${ability.mod ? ` (${escapeHtml(ability.mod)})` : ""}</span>
        ${ability.save ? `<small>${t("sheet.saveShort")} ${escapeHtml(ability.save)}</small>` : ""}
      </div>`,
    )
    .join("")}</div>`;
}

export function statblockHtml(statblock: Statblock): string {
  return `
    <h1>${escapeHtml(statblock.name)}</h1>
    ${statblock.type ? `<p class="type">${escapeHtml(statblock.type)}</p>` : ""}
    <hr />
    ${abilitiesHtml(statblock)}
    <div class="props">${statblock.props
      .map(
        (prop) =>
          `<p>${prop.label ? `<strong>${prop.label}</strong> ` : ""}${prop.valueHtml}</p>`,
      )
      .join("")}</div>
    ${statblock.sections
      .map(
        (section) => `
        <section>
          ${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : "<hr />"}
          ${section.entries.join("")}
        </section>`,
      )
      .join("")}
    ${statblock.extrasHtml ? `<details><summary>${t("sheet.description")}</summary>${statblock.extrasHtml}</details>` : ""}
    ${statblock.source ? `<p class="source">${escapeHtml(statblock.source)}</p>` : ""}`;
}

const icon = (paths: string) =>
  `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  defense: icon('<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'),
  abilities: icon('<path d="M12 2l9 5v10l-9 5-9-5V7z"/><path d="M12 8v8M8 10l8 4M16 10l-8 4"/>'),
  resist: icon('<path d="M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 3-7 1 1 2 2 3-4z"/>'),
  info: icon('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'),
  traits: icon('<path d="M12 3l2.5 6 6.5.5-5 4.3 1.5 6.2-5.5-3.3L6.5 20 8 13.8 3 9.5 9.5 9z"/>'),
  action: icon('<path d="M14 4h6v6L9 21l-3-3-3 3 0-3 3-3-3-3z"/>'),
  bonus: icon('<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>'),
  reaction: icon('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  legendary: icon('<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>'),
  other: icon('<path d="M6 3h9l4 4v14H6z"/><path d="M9 12h7M9 16h7"/>'),
  description: icon('<path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M4 21a2 2 0 0 0 2 0"/>'),
};

export interface Part {
  label: string;
  icon: string;
  html: string;
}

const DEFENSE = /classe d'armure|armor class|^ac$|^ca$|points de vie|hit points|^hp$|^pv$|vitesse|^speed$|initiative/i;
const RESIST = /résistance|immunité|vulnérabilité|resistance|immunit|vulnerab/i;

function sectionIcon(title: string): string {
  if (/^(traits?|capacités?)$/i.test(title)) return ICONS.traits;
  if (/légendaire|legendary/i.test(title)) return ICONS.legendary;
  if (/bonus/i.test(title)) return ICONS.bonus;
  if (/réaction|reaction/i.test(title)) return ICONS.reaction;
  if (/action/i.test(title)) return ICONS.action;
  return ICONS.other;
}

/** Découpe la fiche en parties, une par picto de la fenêtre réduite. */
export function statblockParts(statblock: Statblock): Part[] {
  const propsHtml = (test: (label: string) => boolean) =>
    statblock.props
      .filter((prop) => test(prop.label))
      .map(
        (prop) =>
          `<p>${prop.label ? `<strong>${prop.label}</strong> ` : ""}${prop.valueHtml}</p>`,
      )
      .join("");
  const isDefense = (label: string) => DEFENSE.test(label);
  const isResist = (label: string) => RESIST.test(label);

  const parts: Part[] = [
    {
      label: t("part.defense"),
      icon: ICONS.defense,
      html: wrapProps(propsHtml(isDefense)),
    },
    { label: t("part.abilities"), icon: ICONS.abilities, html: abilitiesHtml(statblock) },
    {
      label: t("part.resist"),
      icon: ICONS.resist,
      html: wrapProps(propsHtml(isResist)),
    },
    {
      label: t("part.info"),
      icon: ICONS.info,
      html: wrapProps(propsHtml((label) => !isDefense(label) && !isResist(label))),
    },
    ...statblock.sections.map((section) => ({
      label: section.title || t("sheet.traits"),
      icon: section.title ? sectionIcon(section.title) : ICONS.traits,
      html: section.entries.join(""),
    })),
  ];
  if (statblock.extrasHtml) {
    parts.push({ label: t("sheet.description"), icon: ICONS.description, html: statblock.extrasHtml });
  }
  return parts.filter((part) => part.html);
}

const wrapProps = (html: string) => (html ? `<div class="props">${html}</div>` : "");

export function windowHtml(content: string, title: string, sourceUrl?: string, hasNote = false) {
  return `
    <div class="window">
      <header class="bar" id="drag" title="${t("window.drag")}">
        <span class="grip">${uiIcon("grip", 14)}</span>
        <span class="title">${escapeHtml(title)}</span>
        ${sourceUrl ? `<a class="icon source-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer" title="${t("window.openSource")}">${uiIcon("external")}</a>` : ""}
        <button type="button" class="icon has-note" id="note" title="${t("window.note")}" ${hasNote ? "" : "hidden"}>${uiIcon("note")}</button>
        <button type="button" class="icon" id="edit" title="${t("window.edit")}">${uiIcon("edit")}</button>
        <button type="button" class="icon" id="minimize" title="${t("window.minimize")}">${uiIcon("minimize")}</button>
        <button type="button" class="icon" id="close" title="${t("common.close")}">${uiIcon("close")}</button>
      </header>
      <div class="mini-tools" id="mini-tools"></div>
      <div class="mini-panel" id="mini-panel" hidden></div>
      <main class="sheet">${content}</main>
      <div class="resize" id="resize" title="${t("window.resize")}"></div>
    </div>`;
}
