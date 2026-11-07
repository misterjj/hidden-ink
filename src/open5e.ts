import { t } from "./i18n";
import { escapeHtml } from "./manual";
import type { Ability, Statblock } from "./types";

/** Fiches en anglais et libres de droits : seuls les documents SRD sont proposés. */
const API = "https://api.open5e.com/v2/creatures/";
const DOCUMENTS = "srd-2014,srd-2024";

/** Mention exigée par la licence CC-BY-4.0 des SRD. */
const ATTRIBUTION: Record<string, string> = {
  "srd-2014": "System Reference Document 5.1 by Wizards of the Coast LLC, CC-BY-4.0",
  "srd-2024": "System Reference Document 5.2 by Wizards of the Coast LLC, CC-BY-4.0",
};

interface Named {
  name: string;
  key: string;
}

export interface Open5eResult {
  key: string;
  name: string;
  type: Named;
  size: Named;
  challenge_rating: number;
  document: Named & { display_name?: string };
}

interface Action {
  name: string;
  desc: string;
  action_type: string;
  order_in_statblock?: number;
  usage_limits?: { type: string; param: number } | null;
  legendary_action_cost?: number | null;
}

export interface Open5eCreature extends Open5eResult {
  alignment: string;
  armor_class: number;
  armor_detail?: string;
  hit_points: number;
  hit_dice?: string;
  speed?: Record<string, number | string | boolean>;
  ability_scores: Record<string, number>;
  modifiers: Record<string, number>;
  saving_throws?: Record<string, number>;
  skill_bonuses?: Record<string, number>;
  initiative_bonus?: number | null;
  passive_perception?: number | null;
  experience_points?: number | null;
  resistances_and_immunities?: Record<string, unknown>;
  darkvision_range?: number | null;
  blindsight_range?: number | null;
  tremorsense_range?: number | null;
  truesight_range?: number | null;
  languages?: { as_string?: string };
  traits?: { name: string; desc: string }[];
  actions?: Action[];
}

export class Open5eError extends Error {}

const ABILITIES = ["strength", "dexterity", "constitution", "intelligence", "wisdom", "charisma"];

const signed = (value: number) => (value >= 0 ? `+${value}` : `${value}`);

/** 0.25 → « 1/4 ». */
export function formatChallenge(value: number) {
  const fractions: Record<string, string> = { "0.125": "1/8", "0.25": "1/4", "0.5": "1/2" };
  return fractions[String(value)] ?? String(Math.round(value));
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const words = (key: string) => key.replace(/_/g, " ");

function speedText(speed: Open5eCreature["speed"]) {
  if (!speed) return "";
  const unit = speed.unit === "feet" || !speed.unit ? "ft." : String(speed.unit);
  return Object.entries(speed)
    .filter(([mode, value]) => mode !== "unit" && mode !== "hover" && typeof value === "number" && value > 0)
    .map(([mode, value]) => (mode === "walk" ? `${value} ${unit}` : `${mode} ${value} ${unit}`))
    .concat(speed.hover === true ? ["(hover)"] : [])
    .join(", ");
}

function sensesText(creature: Open5eCreature) {
  const senses = (
    [
      ["blindsight", creature.blindsight_range],
      ["darkvision", creature.darkvision_range],
      ["tremorsense", creature.tremorsense_range],
      ["truesight", creature.truesight_range],
    ] as const
  )
    .filter(([, range]) => range)
    .map(([sense, range]) => `${sense} ${range} ft.`);
  if (creature.passive_perception != null) {
    senses.push(`passive Perception ${creature.passive_perception}`);
  }
  return senses.join(", ");
}

function usage(action: Action) {
  const limit = action.usage_limits;
  if (!limit) return "";
  if (limit.type === "RECHARGE_ON_ROLL") {
    return limit.param >= 6 ? " (Recharge 6)" : ` (Recharge ${limit.param}–6)`;
  }
  if (limit.type === "PER_DAY") return ` (${limit.param}/Day)`;
  return "";
}

function entryHtml(name: string, desc: string) {
  const [first, ...rest] = desc.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  return [
    `<p><strong><em>${escapeHtml(name)}</em></strong>. ${escapeHtml(first ?? "")}</p>`,
    ...rest.map((line) => `<p>${escapeHtml(line)}</p>`),
  ].join("");
}

const SECTIONS: [string, () => string][] = [
  ["ACTION", () => t("sheet.actions")],
  ["BONUS_ACTION", () => t("sheet.bonusActions")],
  ["REACTION", () => t("sheet.reactions")],
  ["LEGENDARY_ACTION", () => t("sheet.legendaryActions")],
  ["LAIR_ACTION", () => t("sheet.lairActions")],
];

export function attribution(documentKey: string, documentName = "") {
  return `Open5e · ${ATTRIBUTION[documentKey] ?? documentName}`;
}

/** Fiche prête à afficher, à partir d'une créature Open5e. Tout le texte est échappé. */
export function creatureToStatblock(creature: Open5eCreature): Statblock {
  const labels = t("sheet.abilities").split(",");
  const saves = creature.saving_throws ?? {};
  const abilities: Ability[] = ABILITIES.map((ability, index) => ({
    label: labels[index],
    score: String(creature.ability_scores?.[ability] ?? ""),
    mod: creature.modifiers?.[ability] != null ? signed(creature.modifiers[ability]) : "",
    ...(saves[ability] != null ? { save: signed(saves[ability]) } : {}),
  }));

  const resist = creature.resistances_and_immunities ?? {};
  const display = (key: string) => String(resist[`${key}_display`] ?? "");
  const skills = Object.entries(creature.skill_bonuses ?? {})
    .map(([skill, bonus]) => `${capitalize(words(skill))} ${signed(bonus)}`)
    .join(", ");
  const challenge = `${formatChallenge(creature.challenge_rating)}${
    creature.experience_points ? ` (${creature.experience_points.toLocaleString("en")} XP)` : ""
  }`;

  const props = (
    [
      [t("sheet.ac"), `${creature.armor_class}${creature.armor_detail ? ` (${creature.armor_detail})` : ""}`],
      [t("sheet.hp"), `${creature.hit_points}${creature.hit_dice ? ` (${creature.hit_dice})` : ""}`],
      [t("sheet.speed"), speedText(creature.speed)],
      [t("sheet.initiative"), creature.initiative_bonus != null ? signed(creature.initiative_bonus) : ""],
      [t("sheet.skills"), skills],
      [t("sheet.damageVulnerabilities"), display("damage_vulnerabilities")],
      [t("sheet.damageResistances"), display("damage_resistances")],
      [t("sheet.damageImmunities"), display("damage_immunities")],
      [t("sheet.conditionImmunities"), display("condition_immunities")],
      [t("sheet.senses"), sensesText(creature)],
      [t("sheet.languages"), creature.languages?.as_string || "—"],
      [t("sheet.challenge"), challenge],
    ] as [string, string][]
  )
    .filter(([, value]) => value)
    .map(([label, value]) => ({ label: escapeHtml(label), valueHtml: escapeHtml(value) }));

  const sections: Statblock["sections"] = [];
  if (creature.traits?.length) {
    sections.push({ title: "", entries: creature.traits.map((trait) => entryHtml(trait.name, trait.desc)) });
  }
  const actions = [...(creature.actions ?? [])].sort(
    (a, b) => (a.order_in_statblock ?? 0) - (b.order_in_statblock ?? 0),
  );
  for (const [type, title] of SECTIONS) {
    const entries = actions
      .filter((action) => action.action_type === type)
      .map((action) => {
        const cost =
          type === "LEGENDARY_ACTION" && (action.legendary_action_cost ?? 1) > 1
            ? ` (Costs ${action.legendary_action_cost} Actions)`
            : "";
        return entryHtml(`${action.name}${usage(action)}${cost}`, action.desc);
      });
    if (entries.length) sections.push({ title: title(), entries });
  }

  const type = [creature.size?.name, creature.type?.name?.toLowerCase()].filter(Boolean).join(" ");
  return {
    name: creature.name,
    type: [type, creature.alignment].filter(Boolean).join(", "),
    props,
    abilities,
    sections,
    source: attribution(creature.document?.key, creature.document?.name),
    extrasHtml: "",
  };
}

// --- Réseau et cache ---------------------------------------------------------------

const cacheKey = (key: string) => `open5e:v1:${key}`;

export async function searchCreatures(name: string, signal?: AbortSignal): Promise<Open5eResult[]> {
  const query = new URLSearchParams({
    name__icontains: name.trim(),
    document__key__in: DOCUMENTS,
    fields: "key,name,type,size,challenge_rating,document",
    ordering: "name",
    limit: "20",
  });
  let response: Response;
  try {
    response = await fetch(`${API}?${query}`, { signal });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Open5eError(t("fiche.open5eUnreachable"));
  }
  if (!response.ok) throw new Open5eError(t("fiche.open5eUnreachable"));
  const data = (await response.json()) as { results?: Open5eResult[] };
  return data.results ?? [];
}

/** Une fiche déjà vue reste disponible sans connexion. */
export async function loadCreature(key: string): Promise<Statblock> {
  let creature: Open5eCreature | undefined;
  try {
    const cached = localStorage.getItem(cacheKey(key));
    if (cached) creature = JSON.parse(cached) as Open5eCreature;
  } catch {
    // Cache illisible : on recharge.
  }
  if (!creature) {
    let response: Response;
    try {
      response = await fetch(`${API}${encodeURIComponent(key)}/`);
    } catch {
      throw new Open5eError(t("fiche.open5eUnreachable"));
    }
    if (response.status === 404) throw new Open5eError(t("fiche.open5eMissing"));
    if (!response.ok) throw new Open5eError(t("fiche.open5eUnreachable"));
    creature = (await response.json()) as Open5eCreature;
    try {
      localStorage.setItem(cacheKey(key), JSON.stringify(creature));
    } catch {
      // Cache plein : la fiche reste affichable.
    }
  }
  // Construite à chaque fois, pour suivre la langue des libellés.
  return creatureToStatblock(creature);
}
