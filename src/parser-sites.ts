// Lecture des fiches d'Archives of Nethys (Pathfinder 2e) et du SRD Daggerheart.
// Même principe qu'AideDD : seules des balises de mise en forme sont gardées, sans liens.

import { t } from "./i18n";
import { escapeHtml } from "./manual";
import { clean, text } from "./parser";
import type { Ability, Statblock } from "./types";

// --- Archives of Nethys --------------------------------------------------------------

const ACTIONS: Record<string, string> = {
  "one-action": "◆",
  "two-actions": "◆◆",
  "three-actions": "◆◆◆",
  reaction: "⤾",
  "free-action": "◇",
};

/**
 * « [two-actions] » → ◆◆, dans une pastille stylée. Les soulignés des anciens liens
 * et les espaces en double disparaissent.
 */
const actionGlyphs = (html: string) =>
  html
    .replace(/<\/?u>/g, "")
    .replace(/<span>\s*(\[[a-z-]+\])\s*<\/span>/g, "$1")
    .replace(/\[(one-action|two-actions|three-actions|reaction|free-action)\]/g, (_, name: string) => {
      return `<span class="pf-action">${ACTIONS[name]}</span>`;
    })
    .replace(/\s{2,}/g, " ")
    .trim();

/** Lignes de la fiche qui vont dans les propriétés ; les autres sont des capacités. */
const AON_PROPS = /^(source|recall knowledge|perception|languages|skills|items|ac|hp|speed)$/i;
const AON_ABILITIES = ["Str", "Dex", "Con", "Int", "Wis", "Cha"];

const plain = (nodes: Node[]) =>
  nodes
    .map((node) => node.textContent ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();

interface Line {
  nodes: Node[];
  /** Capacité en retrait (« hanging-indent ») : toujours une entrée, jamais une propriété. */
  ability: boolean;
  /** Bloc de la fiche : 0 en haut, 1 défense, 2 déplacement et attaques. */
  group: number;
}

export function parseAon(html: string, pageUrl: string): Statblock | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const heading = doc.querySelector("h1.monster-statblock-name");
  if (!heading) return null;
  const name = text(heading.querySelector("a")) || text(heading.firstChild as Element);
  const level = text(heading.querySelector("span"));

  const tags: string[] = [];
  const lines: Line[] = [];
  let group = 0;
  let current: Line = { nodes: [], ability: false, group };
  const flush = () => {
    if (current.nodes.some((node) => node.textContent?.trim())) lines.push(current);
    current = { nodes: [], ability: false, group };
  };

  for (let node = heading.nextSibling; node; node = node.nextSibling) {
    if (node.nodeType === 1) {
      const element = node as Element;
      const tag = element.tagName;
      if (element.classList.contains("creature-spellbook-wrapper")) break;
      if (/^trait/.test(element.className) && tag === "SPAN") {
        tags.push(text(element));
        continue;
      }
      if (tag === "H3" || tag === "SCRIPT" || tag === "STYLE") continue;
      if (tag === "BR") {
        flush();
        continue;
      }
      if (tag === "HR") {
        flush();
        current.group = group = Math.min(2, group + 1);
        continue;
      }
      if (element.classList.contains("hanging-indent")) {
        flush();
        lines.push({ nodes: Array.from(element.childNodes), ability: true, group });
        continue;
      }
    }
    current.nodes.push(node);
  }
  flush();

  const props: Statblock["props"] = [];
  let abilities: Ability[] = [];
  let source = "";
  let seenPerception = false;
  const groups: string[][] = [[], [], []];
  for (const line of lines) {
    const first = line.nodes.find((node) => node.textContent?.trim());
    const label = first?.nodeName === "B" ? text(first as Element) : "";
    const rest = line.nodes.slice(line.nodes.indexOf(first!) + 1);
    if (!line.ability && label === "Str") {
      const values = plain(line.nodes);
      abilities = AON_ABILITIES.map((ability) => ({
        label: ability.toUpperCase(),
        score: values.match(new RegExp(`${ability}\\s*([+−–-]?\\d+)`))?.[1].replace(/[−–]/, "-") ?? "",
        mod: "",
      }));
      continue;
    }
    if (!line.ability && /^source$/i.test(label)) {
      source = plain(rest);
      continue;
    }
    if (!line.ability && label && AON_PROPS.test(label)) {
      if (/^perception$/i.test(label)) seenPerception = true;
      props.push({ label: escapeHtml(label), valueHtml: actionGlyphs(clean(rest, pageUrl, doc)) });
      continue;
    }
    if (!line.ability && !label && line.group === 0 && !seenPerception) {
      // Courte description (« Male goblin ghoul cleric of Kabriri »), avant la Perception.
      props.push({ label: "", valueHtml: `<em>${clean(line.nodes, pageUrl, doc)}</em>` });
      continue;
    }
    const entry = actionGlyphs(clean(line.nodes, pageUrl, doc));
    if (entry) groups[line.group].push(`<p>${entry}</p>`);
  }
  if (!props.length && !groups.some((entries) => entries.length)) return null;

  return {
    system: "pf2e",
    name,
    type: level,
    tags,
    props,
    abilities,
    sections: [
      { title: "", entries: groups[0], place: "top" as const },
      { title: t("sheet.defensiveAbilities"), entries: groups[1], place: "defense" as const },
      { title: t("sheet.actions"), entries: groups[2], place: "offense" as const },
    ].filter((section) => section.entries.length),
    source: ["Archives of Nethys", source].filter(Boolean).join(" · "),
    extrasHtml: "",
  };
}

// --- SRD Daggerheart -------------------------------------------------------------------

/** « Bite - Action: » au début d'une capacité : le type passe à part, en italique. */
function daggerheartFeature(html: string) {
  return html.replace(
    /^<strong><em>(.+?)\s*-\s+((?:Action|Reaction|Passive)[^<]*?):?<\/em><\/strong>:?/i,
    (_, name: string, kind: string) => `<strong><em>${name}</em></strong> <span class="dh-kind">${kind.replace(/:$/, "")}</span>`,
  );
}

export function parseDaggerheart(html: string, pageUrl: string): Statblock | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const article = doc.querySelector("article");
  const name = text(article?.querySelector("h1"));
  if (!article || !name) return null;

  let type = "";
  const props: Statblock["props"] = [];
  const sections: Statblock["sections"] = [];
  let section: Statblock["sections"][number] | undefined;

  for (const element of Array.from(article.children)) {
    const tag = element.tagName;
    if (tag === "H1") continue;
    if (tag === "H2" || tag === "H3") {
      const title = text(element);
      section = { title: title.charAt(0) + title.slice(1).toLowerCase(), entries: [] };
      sections.push(section);
      continue;
    }
    if (!section) {
      if (tag === "P" && !type) {
        // « Tier 1 Bruiser. » en gras, puis la description en italique.
        type = text(element.querySelector("strong")).replace(/\.$/, "");
        const description = text(element).slice(text(element.querySelector("strong")).length).trim();
        if (description) props.push({ label: "", valueHtml: `<em>${escapeHtml(description)}</em>` });
      } else if (tag === "UL") {
        for (const item of Array.from(element.querySelectorAll("li"))) {
          const label = text(item.querySelector("strong")).replace(/:$/, "");
          const value = text(item).slice(text(item.querySelector("strong")).length).trim();
          // « Difficulty: 14 | Thresholds: 9/17 | HP: 7 » : une propriété par valeur, sauf pour l'attaque.
          if (/^atk$/i.test(label)) {
            props.push({ label: escapeHtml(label), valueHtml: escapeHtml(value.replace(/\s*\|\s*/g, " | ")) });
            continue;
          }
          for (const part of `${label}: ${value}`.split(/\s*\|\s*/)) {
            const [key, ...rest] = part.split(":");
            props.push({ label: escapeHtml(key.trim()), valueHtml: escapeHtml(rest.join(":").trim()) });
          }
        }
      }
      continue;
    }
    if (tag === "P") {
      const inner = clean(Array.from(element.childNodes), pageUrl, doc);
      if (inner) section.entries.push(`<p>${daggerheartFeature(inner)}</p>`);
      continue;
    }
    const html = clean([element], pageUrl, doc);
    if (!html) continue;
    // Une liste complète la capacité qui la précède.
    if (tag === "UL" && section.entries.length) section.entries[section.entries.length - 1] += html;
    else section.entries.push(html);
  }
  if (!props.length && !sections.length) return null;

  return {
    system: "daggerheart",
    name,
    type,
    props,
    abilities: [],
    sections: sections.filter((entry) => entry.entries.length),
    source: "Daggerheart SRD 1.0 · © Critical Role, LLC · DPCGL",
    extrasHtml: "",
  };
}
