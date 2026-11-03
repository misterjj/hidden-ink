import type { ManualFiche, Statblock } from "./types";

const ABILITY_LABELS = ["FOR", "DEX", "CON", "INT", "SAG", "CHA"];

/** Titres reconnus sans « # », pour pouvoir coller le texte d'une fiche tel quel. */
const SECTION_TITLES =
  /^(traits|capacités|actions?( légendaires?| bonus| d'antre)?|réactions?|bonus actions?|legendary actions?)\s*:?$/i;

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function modifier(score: string): string {
  const value = Number.parseInt(score, 10);
  if (Number.isNaN(value)) return "";
  const mod = Math.floor((value - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function entryHtml(line: string): string {
  // « Coup. Attaque au corps à corps… » : le nom de la capacité passe en gras.
  const match = line.match(/^([^.:]{1,60}?)\s*([.:])\s+(.+)$/);
  if (match && /^\p{Lu}/u.test(match[1])) {
    return `<p><strong><em>${escapeHtml(match[1])}</em></strong>. ${escapeHtml(match[3])}</p>`;
  }
  return `<p>${escapeHtml(line)}</p>`;
}

export function parseManualBody(body: string): Statblock["sections"] {
  const sections: Statblock["sections"] = [{ title: "", entries: [] }];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#") || SECTION_TITLES.test(line)) {
      sections.push({ title: line.replace(/^#+\s*/, ""), entries: [] });
    } else {
      sections[sections.length - 1].entries.push(entryHtml(line));
    }
  }
  return sections.filter((section) => section.title || section.entries.length);
}

/** Texte d'un fragment de fiche, une entrée par ligne. Les liens et le gras sont perdus. */
function htmlLines(html: string): string[] {
  const template = document.createElement("template");
  // Les retours à la ligne du HTML source ne comptent pas : seuls les blocs en créent.
  template.innerHTML = html.replace(/\s+/g, " ");
  const content = template.content;
  content.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  content.querySelectorAll("td:not(:last-child), th:not(:last-child)").forEach((cell) => cell.append(" | "));
  content.querySelectorAll("p, li, tr").forEach((block) => block.append("\n"));
  return (content.textContent ?? "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

const htmlText = (html: string) => htmlLines(html).join(" ");

/**
 * Copie une fiche AideDD en saisie à la main, pour pouvoir la modifier.
 * Les informations sans champ dédié passent dans « Autres informations » ou en section.
 */
export function statblockToManual(statblock: Statblock): ManualFiche {
  const others = [...statblock.props];
  const take = (pattern: RegExp) => {
    const index = others.findIndex((prop) => pattern.test(prop.label));
    return index < 0 ? "" : htmlText(others.splice(index, 1)[0].valueHtml);
  };
  const ac = take(/classe d'armure|^ac$|^ca$/i);
  const hp = take(/points de vie|^hp$|^pv$/i);
  const speed = take(/vitesse|^speed$/i);

  const props = others.map((prop) => {
    const value = htmlText(prop.valueHtml);
    return prop.label ? `${htmlText(prop.label)} : ${value}` : value;
  });
  // Le modificateur est recalculé à l'affichage, un jet de sauvegarde égal n'apporte rien.
  const saves = statblock.abilities
    .filter((ability) => ability.save && ability.save !== ability.mod)
    .map((ability) => `${ability.label} ${ability.save}`);
  if (saves.length) props.push(`Jets de sauvegarde : ${saves.join(", ")}`);
  if (statblock.source) props.push(`Source : ${statblock.source}`);

  const body = statblock.sections.flatMap((section) => [
    ...(section.title ? [`# ${section.title}`] : []),
    ...section.entries.flatMap(htmlLines),
  ]);
  if (statblock.extrasHtml) body.push("# Description", ...htmlLines(statblock.extrasHtml));

  return {
    name: statblock.name,
    type: statblock.type,
    ac,
    hp,
    speed,
    abilities: ABILITY_LABELS.map((_, index) => statblock.abilities[index]?.score ?? ""),
    props: props.join("\n"),
    body: body.join("\n"),
  };
}

export function manualToStatblock(fiche: ManualFiche): Statblock {
  const props: Statblock["props"] = [
    { label: "Classe d'armure", valueHtml: escapeHtml(fiche.ac) },
    { label: "Points de vie", valueHtml: escapeHtml(fiche.hp) },
    { label: "Vitesse", valueHtml: escapeHtml(fiche.speed) },
  ].filter((prop) => prop.valueHtml);

  for (const raw of fiche.props.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    props.push(
      separator > 0
        ? {
            label: escapeHtml(line.slice(0, separator).trim()),
            valueHtml: escapeHtml(line.slice(separator + 1).trim()),
          }
        : { label: "", valueHtml: escapeHtml(line) },
    );
  }

  const hasAbilities = fiche.abilities.some((score) => score.trim());
  return {
    name: fiche.name,
    type: fiche.type,
    props,
    abilities: hasAbilities
      ? ABILITY_LABELS.map((label, index) => {
          const score = (fiche.abilities[index] ?? "").trim();
          return { label, score, mod: modifier(score) };
        })
      : [],
    sections: parseManualBody(fiche.body),
    source: "Saisie à la main",
    extrasHtml: "",
  };
}
