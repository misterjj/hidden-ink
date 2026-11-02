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
