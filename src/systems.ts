// Saisies guidées de Pathfinder 2e et Daggerheart : conversion en fiche affichable,
// et l'inverse pour « Adapter » une fiche chargée depuis un lien.

import { t } from "./i18n";
import { escapeHtml } from "./manual";
import type { ActionCost, DaggerheartFiche, Pf2eFiche, Pf2eRarity, SheetPlace, Statblock } from "./types";

// --- Texte saisi -----------------------------------------------------------------------

/** Gras « **…** » et listes « - … » ; tout le reste est échappé. Renvoie des paragraphes. */
export function miniMarkdown(text: string): string[] {
  const inline = (line: string) => escapeHtml(line).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const blocks: string[] = [];
  let list: string[] = [];
  const closeList = () => {
    if (list.length) blocks.push(`<ul>${list.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^[-•]\s+/.test(line)) list.push(inline(line.replace(/^[-•]\s+/, "")));
    else {
      closeList();
      blocks.push(`<p>${inline(line)}</p>`);
    }
  }
  closeList();
  return blocks;
}

/** Une capacité : son en-tête suivi du premier paragraphe, puis le reste. */
function entry(head: string, text: string) {
  const [first, ...rest] = miniMarkdown(text);
  if (first?.startsWith("<p>")) return `<p>${head} ${first.slice(3)}${rest.join("")}`;
  return `<p>${head}</p>${[first, ...rest].filter(Boolean).join("")}`;
}

/** Texte brut d'un fragment HTML, gras et listes gardés en « ** » et « - ». */
export function htmlToMini(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html.replace(/\s+/g, " ");
  const content = template.content;
  content.querySelectorAll("b, strong").forEach((bold) => {
    if (bold.textContent?.trim()) bold.replaceWith(`**${bold.textContent.trim()}**`);
  });
  content.querySelectorAll("li").forEach((item) => item.prepend("\n- "));
  content.querySelectorAll("p, ul, br").forEach((block) => block.after("\n"));
  return (content.textContent ?? "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// --- Pathfinder 2e ---------------------------------------------------------------------

export const ACTION_GLYPHS: Record<Exclude<ActionCost, "">, string> = {
  "1": "◆",
  "2": "◆◆",
  "3": "◆◆◆",
  reaction: "⤾",
  free: "◇",
};

const glyph = (cost: ActionCost) => (cost ? ` <span class="pf-action">${ACTION_GLYPHS[cost]}</span>` : "");

export const PF2E_SIZES = ["tiny", "small", "medium", "large", "huge", "gargantuan"] as const;

export function emptyPf2e(name = ""): Pf2eFiche {
  return {
    name,
    level: "",
    rarity: "common",
    size: "medium",
    traits: "",
    perception: "",
    languages: "",
    skills: "",
    attributes: ["", "", "", "", "", ""],
    items: "",
    ac: "",
    saves: ["", "", ""],
    hp: "",
    immunities: "",
    weaknesses: "",
    resistances: "",
    speed: "",
    strikes: [],
    spells: "",
    abilities: [],
  };
}

const signed = (value: string) => (/^\d/.test(value.trim()) ? `+${value.trim()}` : value.trim());

export function pf2eToStatblock(fiche: Pf2eFiche): Statblock {
  const props: Statblock["props"] = [];
  const add = (label: string, value: string) => {
    if (value.trim()) props.push({ label: escapeHtml(label), valueHtml: escapeHtml(value.trim()) });
  };
  add(t("sheet.pf2e.perception"), fiche.perception);
  add(t("sheet.languages"), fiche.languages);
  add(t("sheet.skills"), fiche.skills);
  add(t("sheet.pf2e.items"), fiche.items);
  // Comme dans les livres : « CA 22 ; Vig +14, Réf +9, Vol +12 », puis « PV 75 ; Immunités … ; Faiblesses … ».
  const saveLabels = t("sheet.pf2e.saveLabels").split(",");
  const saves = fiche.saves.some((save) => save.trim())
    ? fiche.saves.map((save, index) => `<b>${escapeHtml(saveLabels[index])}</b> ${escapeHtml(signed(save) || "—")}`).join(", ")
    : "";
  const joined = (parts: string[]) => parts.filter(Boolean).join("; ");
  if (fiche.ac.trim() || saves) {
    props.push({ label: escapeHtml(t("sheet.pf2e.ac")), valueHtml: joined([escapeHtml(fiche.ac.trim() || "—"), saves]) });
  }
  const labelled = (key: Parameters<typeof t>[0], value: string) =>
    value.trim() ? `<b>${escapeHtml(t(key))}</b> ${escapeHtml(value.trim())}` : "";
  const defenses = [
    labelled("sheet.pf2e.immunities", fiche.immunities),
    labelled("sheet.pf2e.weaknesses", fiche.weaknesses),
    labelled("sheet.pf2e.resistances", fiche.resistances),
  ];
  if (fiche.hp.trim() || defenses.some(Boolean)) {
    props.push({ label: escapeHtml(t("sheet.pf2e.hp")), valueHtml: joined([escapeHtml(fiche.hp.trim() || "—"), ...defenses]) });
  }
  add(t("sheet.speed"), fiche.speed);

  const attributeLabels = t("sheet.pf2e.attributes").split(",");
  const abilities = fiche.attributes.some((value) => value.trim())
    ? attributeLabels.map((label, index) => ({ label, score: signed(fiche.attributes[index] ?? "") || "+0", mod: "" }))
    : [];

  const strikes = fiche.strikes
    .filter((strike) => strike.name.trim())
    .map((strike) => {
      const traits = strike.traits.trim() ? ` (${escapeHtml(strike.traits.trim())})` : "";
      const damage = strike.damage.trim() ? `, <b>${t("sheet.pf2e.damage")}</b> ${escapeHtml(strike.damage.trim())}` : "";
      return `<p><b>${t(strike.ranged ? "sheet.pf2e.ranged" : "sheet.pf2e.melee")}</b>${glyph("1")} ${escapeHtml(strike.name.trim())} ${escapeHtml(signed(strike.bonus))}${traits}${damage}</p>`;
    });
  const spells = fiche.spells.trim() ? miniMarkdown(fiche.spells) : [];
  const abilityEntries = (place: SheetPlace) =>
    fiche.abilities
      .filter((ability) => ability.place === place && ability.name.trim())
      .map((ability) => {
        const traits = ability.traits.trim() ? ` (${escapeHtml(ability.traits.trim())})` : "";
        return entry(`<b>${escapeHtml(ability.name.trim())}</b>${glyph(ability.actions)}${traits}`, ability.text);
      });

  const rarity = fiche.rarity !== "common" ? [t(`sheet.pf2e.rarity.${fiche.rarity}`)] : [];
  const size = fiche.size ? [t(`sheet.pf2e.size.${fiche.size as (typeof PF2E_SIZES)[number]}`)] : [];
  const traits = fiche.traits.split(",").map((trait) => trait.trim()).filter(Boolean);

  return {
    system: "pf2e",
    name: fiche.name,
    type: `${t("sheet.pf2e.creature")} ${fiche.level.trim() || "0"}`,
    tags: [...rarity, ...size, ...traits],
    props,
    abilities,
    sections: [
      { title: "", entries: abilityEntries("top"), place: "top" as const },
      { title: t("sheet.defensiveAbilities"), entries: abilityEntries("defense"), place: "defense" as const },
      { title: t("sheet.actions"), entries: [...strikes, ...spells, ...abilityEntries("offense")], place: "offense" as const },
    ].filter((section) => section.entries.length),
    source: t("sheet.manualSource"),
    extrasHtml: "",
  };
}

const RARITY_WORDS: Record<string, Pf2eRarity> = {
  uncommon: "uncommon",
  "peu commun": "uncommon",
  "peu commune": "uncommon",
  rare: "rare",
  unique: "unique",
};
const SIZE_WORDS: Record<string, string> = {
  tiny: "tiny", "très petite": "tiny", "très petit": "tiny",
  small: "small", petite: "small", petit: "small",
  medium: "medium", moyenne: "medium", moyen: "medium",
  large: "large", grande: "large", grand: "large",
  huge: "huge", "très grande": "huge", "très grand": "huge",
  gargantuan: "gargantuan", gigantesque: "gargantuan",
};
const ALIGNMENT = /^(LG|NG|CG|LN|N|CN|LE|NE|CE)$/;

const plain = (html: string) => htmlToMini(html).replace(/\*\*/g, "").replace(/\n/g, " ").trim();

/** Recopie une fiche Pathfinder (lien Archives of Nethys) dans la saisie guidée. */
export function statblockToPf2e(statblock: Statblock): Pf2eFiche {
  const fiche = emptyPf2e(statblock.name);
  fiche.level = statblock.type.match(/-?\d+/)?.[0] ?? "";
  const traits: string[] = [];
  for (const tag of statblock.tags ?? []) {
    const word = tag.toLowerCase();
    if (RARITY_WORDS[word]) fiche.rarity = RARITY_WORDS[word];
    else if (SIZE_WORDS[word]) fiche.size = SIZE_WORDS[word];
    else if (!ALIGNMENT.test(tag)) traits.push(tag);
  }
  fiche.traits = traits.join(", ");
  fiche.attributes = statblock.abilities.slice(0, 6).map((ability) => ability.score);

  for (const prop of statblock.props) {
    const label = plain(prop.label).toLowerCase();
    const value = plain(prop.valueHtml);
    if (/^perception$/.test(label)) fiche.perception = value;
    else if (/^(languages|langues)$/.test(label)) fiche.languages = value;
    else if (/^(skills|compétences)$/.test(label)) fiche.skills = value;
    else if (/^(items|objets)$/.test(label)) fiche.items = value;
    else if (/^(speed|vitesse)$/.test(label)) fiche.speed = value;
    else if (/^(ac|ca)$/.test(label)) {
      // « 21; Fort +10, Ref +10, Will +12 »
      const [ac, ...rest] = value.split(/;\s*/);
      fiche.ac = ac;
      const saves = rest.join("; ");
      fiche.saves = ["(?:Fort|Vig)", "(?:Ref|Réf)", "(?:Will|Vol)"].map(
        (name) => saves.match(new RegExp(`${name}\\w*\\.?\\s*([+-]\\d+)`))?.[1] ?? "",
      );
      const extra = saves.replace(/(Fort|Vig|Ref|Réf|Will|Vol)\w*\.?\s*[+-]\d+(,\s*)?/g, "").trim();
      if (extra) fiche.ac = `${ac}; ${extra.replace(/^[;,\s]+/, "")}`;
    } else if (/^(hp|pv)$/.test(label)) {
      // « 59 (negative healing); Immunities …; Weaknesses …; Resistances … »
      const [hp, ...rest] = value.split(/;\s*/);
      fiche.hp = hp;
      for (const part of rest) {
        const match = part.match(/^(Immunities|Immunités|Weaknesses|Faiblesses|Resistances|Résistances)\s+(.*)$/i);
        if (!match) fiche.hp += `; ${part}`;
        else if (/^imm/i.test(match[1])) fiche.immunities = match[2];
        else if (/^(weak|faib)/i.test(match[1])) fiche.weaknesses = match[2];
        else fiche.resistances = match[2];
      }
    } else if (/^(immunities|immunités)$/.test(label)) fiche.immunities = value;
    else if (/^(weaknesses|faiblesses)$/.test(label)) fiche.weaknesses = value;
    else if (/^(resistances|résistances)$/.test(label)) fiche.resistances = value;
  }

  const spells: string[] = [];
  for (const section of statblock.sections) {
    const place: SheetPlace = section.place ?? (section.title ? "offense" : "top");
    for (const html of section.entries) {
      const text = htmlToMini(html);
      const line = text.replace(/\*\*/g, "");
      const strike = line.match(
        /^(Melee|Ranged|Corps à corps|À distance)\s*◆?\s*(.+?)\s+([+-]\d+)(?:\s*\[[^\]]*\])?\s*(?:\((.*?)\))?,\s*(?:Damage|Dégâts)\s+(.*)$/i,
      );
      if (strike) {
        fiche.strikes.push({
          ranged: /^(ranged|à distance)/i.test(strike[1]),
          name: strike[2],
          bonus: strike[3],
          traits: strike[4] ?? "",
          damage: strike[5],
        });
        continue;
      }
      const head = text.match(/^\*\*(.+?)\*\*\s*(.*)$/s);
      if (head && /spells|sorts|rituals|rituels/i.test(head[1])) {
        spells.push(text);
        continue;
      }
      let rest = head ? head[2] : text;
      let actions: ActionCost = "";
      const cost = rest.match(/^(◆◆◆|◆◆|◆|⤾|◇)\s*/);
      if (cost) {
        actions = (Object.entries(ACTION_GLYPHS).find(([, symbol]) => symbol === cost[1])?.[0] ?? "") as ActionCost;
        rest = rest.slice(cost[0].length);
      }
      const traitList = rest.match(/^\(([^)]*)\)\s*/);
      if (traitList) rest = rest.slice(traitList[0].length);
      fiche.abilities.push({
        name: head ? head[1] : "",
        actions,
        traits: traitList?.[1] ?? "",
        text: rest.trim(),
        place,
      });
    }
  }
  fiche.spells = spells.join("\n");
  return fiche;
}

// --- Daggerheart ---------------------------------------------------------------------------

export const DH_ADVERSARY_TYPES = ["Bruiser", "Horde", "Leader", "Minion", "Ranged", "Skulk", "Social", "Solo", "Standard", "Support"];
export const DH_ENVIRONMENT_TYPES = ["Exploration", "Social", "Traversal", "Event"];
export const DH_RANGES = ["Melee", "Very Close", "Close", "Far", "Very Far"];

export function emptyDaggerheart(name = ""): DaggerheartFiche {
  return {
    name,
    environment: false,
    tier: "1",
    type: "Standard",
    description: "",
    motives: "",
    difficulty: "",
    major: "",
    severe: "",
    hp: "",
    stress: "",
    atk: "",
    weapon: "",
    range: "Melee",
    damage: "",
    experience: "",
    adversaries: "",
    features: [],
  };
}

export function daggerheartToStatblock(fiche: DaggerheartFiche): Statblock {
  const props: Statblock["props"] = [];
  const add = (label: string, value: string) => {
    if (value.trim()) props.push({ label: escapeHtml(label), valueHtml: escapeHtml(value.trim()) });
  };
  if (fiche.description.trim()) props.push({ label: "", valueHtml: `<em>${escapeHtml(fiche.description.trim())}</em>` });
  add(t(fiche.environment ? "sheet.dh.impulses" : "sheet.dh.motives"), fiche.motives);
  add(t("sheet.dh.difficulty"), fiche.difficulty);
  if (!fiche.environment) {
    add(t("sheet.dh.thresholds"), [fiche.major, fiche.severe].filter((value) => value.trim()).join("/"));
    add(t("sheet.dh.hp"), fiche.hp);
    add(t("sheet.dh.stress"), fiche.stress);
    add(
      t("sheet.dh.atk"),
      [signed(fiche.atk), fiche.weapon.trim() && `${fiche.weapon.trim()}: ${fiche.range}`, fiche.damage.trim()]
        .filter(Boolean)
        .join(" | "),
    );
    add(t("sheet.dh.experience"), fiche.experience);
  } else {
    add(t("sheet.dh.adversaries"), fiche.adversaries);
  }
  const features = fiche.features
    .filter((feature) => feature.name.trim())
    .map((feature) =>
      entry(
        `<strong><em>${escapeHtml(feature.name.trim())}</em></strong> <span class="dh-kind">${t(`sheet.dh.kind.${feature.kind}`)}</span>`,
        feature.text,
      ),
    );
  return {
    system: "daggerheart",
    name: fiche.name,
    type: `${t("sheet.dh.tier")} ${fiche.tier} ${fiche.type}`,
    props,
    abilities: [],
    sections: features.length ? [{ title: t("sheet.dh.features"), entries: features }] : [],
    source: t("sheet.manualSource"),
    extrasHtml: "",
  };
}

/** Recopie une fiche Daggerheart (lien du SRD) dans la saisie guidée. */
export function statblockToDaggerheart(statblock: Statblock): DaggerheartFiche {
  const fiche = emptyDaggerheart(statblock.name);
  const type = statblock.type.match(/(\d)\s*(?:·\s*)?(.*)$/);
  if (type) {
    fiche.tier = type[1];
    fiche.type = type[2].trim() || fiche.type;
  }
  for (const prop of statblock.props) {
    const label = plain(prop.label).toLowerCase();
    const value = plain(prop.valueHtml);
    if (!label) fiche.description = value;
    else if (/motives|motivations/.test(label)) fiche.motives = value;
    else if (/impulses|pulsions/.test(label)) {
      fiche.environment = true;
      fiche.motives = value;
    } else if (/difficult/.test(label)) fiche.difficulty = value;
    else if (/thresholds|seuils/.test(label)) [fiche.major = "", fiche.severe = ""] = value.split("/");
    else if (/^(hp|pv)$/.test(label)) fiche.hp = value;
    else if (/^stress$/.test(label)) fiche.stress = value;
    else if (/^(atk|attaque)$/.test(label)) {
      // « +1 | Claws: Melee | 1d8+3 phy »
      const [atk = "", weapon = "", damage = ""] = value.split(/\s*[·|]\s*/);
      fiche.atk = atk;
      const [name, range] = weapon.split(/:\s*/);
      fiche.weapon = name ?? "";
      fiche.range = DH_RANGES.find((candidate) => candidate.toLowerCase() === range?.toLowerCase()) ?? fiche.range;
      fiche.damage = damage;
    } else if (/experience|expérience/.test(label)) fiche.experience = value;
    else if (/adversaries|adversaires/.test(label)) {
      fiche.environment = true;
      fiche.adversaries = value;
    }
  }
  if (fiche.environment && !DH_ENVIRONMENT_TYPES.includes(fiche.type)) fiche.type = "Exploration";
  for (const section of statblock.sections) {
    for (const html of section.entries) {
      const kind = html.match(/class="dh-kind">([^<:]*)/)?.[1]?.trim().toLowerCase() ?? "";
      const text = htmlToMini(html.replace(/<span class="dh-kind">[^<]*<\/span>/, ""));
      const head = text.match(/^\*\*(.+?)\*\*\s*(.*)$/s);
      fiche.features.push({
        name: head ? head[1] : "",
        kind: kind.startsWith("action") ? "Action" : kind.startsWith("reaction") || kind.startsWith("réaction") ? "Reaction" : "Passive",
        text: (head ? head[2] : text).trim(),
      });
    }
  }
  return fiche;
}
