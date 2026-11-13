// Exemples affichés par le site guide, dans les vraies structures de l'extension.
// Le gobelin anglais est la créature Open5e du SRD 5.1, telle que l'API la renvoie ;
// les autres fiches sont inventées pour le site, saisies comme dans les formulaires de l'extension.
import type { ListedNote } from "../notes";
import type { Open5eCreature } from "../open5e";
import type { DaggerheartFiche, GenericFiche, ManualFiche, Pf2eFiche, TokenNote } from "../types";

export const GOBLIN_OPEN5E: Open5eCreature = {
  key: "srd_goblin",
  name: "Goblin",
  type: { name: "Humanoid", key: "humanoid" },
  size: { name: "Small", key: "small" },
  challenge_rating: 0.25,
  document: { name: "Systems Reference Document", key: "srd-2014" },
  alignment: "neutral evil",
  armor_class: 15,
  armor_detail: "leather armor, shield",
  hit_points: 7,
  hit_dice: "2d6",
  speed: { walk: 30, unit: "feet" },
  ability_scores: { strength: 8, dexterity: 14, constitution: 10, intelligence: 10, wisdom: 8, charisma: 8 },
  modifiers: { strength: -1, dexterity: 2, constitution: 0, intelligence: 0, wisdom: -1, charisma: -1 },
  skill_bonuses: { stealth: 6 },
  passive_perception: 9,
  experience_points: 50,
  darkvision_range: 60,
  languages: { as_string: "Common, Goblin" },
  traits: [
    { name: "Nimble Escape", desc: "The goblin can take the Disengage or Hide action as a bonus action on each of its turns." },
  ],
  actions: [
    {
      name: "Scimitar",
      desc: "Melee Weapon Attack: +4 to hit, reach 5 ft., one target. Hit: 5 (1d6 + 2) slashing damage.",
      action_type: "ACTION",
      order_in_statblock: 1,
    },
    {
      name: "Shortbow",
      desc: "Ranged Weapon Attack: +4 to hit, range 80/320 ft., one target. Hit: 5 (1d6 + 2) piercing damage.",
      action_type: "ACTION",
      order_in_statblock: 2,
    },
  ],
};

interface Examples {
  /** Le gobelin en français, saisi à la main (Open5e ne parle qu'anglais). */
  goblinManual?: ManualFiche;
  pf2e: Pf2eFiche;
  daggerheart: DaggerheartFiche;
  generic: GenericFiche;
  tokenName: string;
  /** Note de Marta, celle que l'on chiffre en direct. */
  secret: string;
  tokenNote: TokenNote;
  mapNotes: ListedNote[];
  /** Note ouverte à côté de la liste. */
  openNote: string;
}

const en: Examples = {
  pf2e: {
    name: "Lantern Wisp",
    level: "2",
    rarity: "uncommon",
    size: "small",
    traits: "Spirit",
    perception: "+9; darkvision",
    languages: "",
    skills: "Deception +8, Stealth +9",
    attributes: ["-5", "+4", "+0", "+1", "+3", "+3"],
    items: "",
    ac: "18",
    saves: ["5", "10", "8"],
    hp: "24",
    immunities: "disease, poison",
    weaknesses: "",
    resistances: "",
    speed: "fly 40 feet",
    strikes: [{ ranged: false, name: "spark", bonus: "10", traits: "agile", damage: "1d8+2 fire" }],
    spells: "",
    abilities: [
      {
        name: "Lure",
        actions: "2",
        traits: "",
        text: "The wisp glows like a lantern on a doorstep. Each creature within 30 feet attempts a DC 18 Will save.",
        place: "offense",
      },
    ],
  },
  daggerheart: {
    name: "Harbour Smuggler",
    environment: false,
    tier: "1",
    type: "Skulk",
    description: "A grinning sailor with too many pockets.",
    motives: "Pick pockets, slip away, sell anything",
    difficulty: "12",
    major: "6",
    severe: "11",
    hp: "3",
    stress: "3",
    atk: "1",
    weapon: "Cutlass",
    range: "Melee",
    damage: "1d8+1 phy",
    experience: "Sleight of Hand +2",
    adversaries: "",
    features: [
      { name: "Slippery", kind: "Passive", text: "Attacks against the smuggler are made with disadvantage while it stands in shadow." },
      { name: "Smoke Bomb", kind: "Action", text: "Mark a Stress: the smuggler vanishes and reappears within Far range." },
    ],
  },
  generic: {
    name: "Ghoul of the Docks",
    type: "Horror, level 3",
    props: "Sanity loss: 1 / 1d6\nArmour: 2\nWounds: 14",
    body: "# Abilities\nGrave Hunger. When it bites a living creature, the ghoul heals 1d6 wounds.\nLow Tide. It hides under the pier until someone walks over it.",
  },
  tokenName: "Marta, fishmonger",
  secret: "Marta is the smuggler. She lies about the cargo, and gets nervous if anyone mentions the boathouse.",
  tokenNote: { text: "**Smuggler.** Lies about the cargo.\n\n- Nervous about the **boathouse**\n- Owes 40 gp to the harbour master" },
  mapNotes: [
    { id: "planks", note: { type: "piege", title: "Loose planks", text: "**DC 12** Dexterity save or fall into the water.", done: true } },
    { id: "well", note: { type: "objet", title: "Key in the well", text: "Tied to the bucket rope. Opens the boathouse." } },
    {
      id: "trapdoor",
      note: {
        type: "mecanique",
        title: "Trapdoor to the caves",
        text: "Under the crates. **DC 15** Perception to spot the ring.\n\nOpens on a ladder down to the smugglers' cave.",
      },
    },
    { id: "ambush", note: { type: "libre", title: "Ambush at nightfall", text: "Four smugglers wait behind the nets if the party lingers." } },
  ],
  openNote: "trapdoor",
};

const fr: Examples = {
  goblinManual: {
    name: "Gobelin",
    type: "Humanoïde (gobelinoïde) de taille P, neutre mauvais",
    ac: "15 (armure de cuir, bouclier)",
    hp: "7 (2d6)",
    speed: "9 m",
    abilities: ["8", "14", "10", "10", "8", "8"],
    props: "Compétences : Discrétion +6\nSens : vision dans le noir 18 m, Perception passive 9\nLangues : commun, gobelin\nPuissance : 1/4 (50 PX)",
    body:
      "Fuite agile. Le gobelin peut effectuer l'action Se désengager ou Se cacher par une action bonus à chacun de ses tours.\n" +
      "# Actions\n" +
      "Cimeterre. Attaque au corps à corps avec une arme : +4 au toucher, allonge 1,50 m, une cible. Touché : 5 (1d6 + 2) dégâts tranchants.\n" +
      "Arc court. Attaque à distance avec une arme : +4 au toucher, portée 24/96 m, une cible. Touché : 5 (1d6 + 2) dégâts perforants.",
  },
  pf2e: {
    ...en.pf2e,
    name: "Feu follet lanterne",
    traits: "Esprit",
    perception: "+9 ; vision dans le noir",
    skills: "Duperie +8, Discrétion +9",
    immunities: "maladie, poison",
    speed: "vol 12 m",
    strikes: [{ ranged: false, name: "étincelle", bonus: "10", traits: "agile", damage: "1d8+2 feu" }],
    abilities: [
      {
        name: "Leurre",
        actions: "2",
        traits: "",
        text: "Le feu follet brille comme une lanterne sur un seuil. Chaque créature à 9 m ou moins tente un jet de Volonté DD 18.",
        place: "offense",
      },
    ],
  },
  daggerheart: {
    ...en.daggerheart,
    name: "Contrebandier du port",
    description: "Un marin hilare, avec beaucoup trop de poches.",
    motives: "Faire les poches, filer, tout revendre",
    weapon: "Coutelas",
    experience: "Tour de passe-passe +2",
    features: [
      { name: "Insaisissable", kind: "Passive", text: "Les attaques contre le contrebandier ont un désavantage tant qu'il se tient dans l'ombre." },
      { name: "Bombe fumigène", kind: "Action", text: "Coche un Stress : le contrebandier disparaît et réapparaît à portée Lointaine." },
    ],
  },
  generic: {
    name: "Goule des quais",
    type: "Horreur, niveau 3",
    props: "Perte de SAN : 1 / 1d6\nArmure : 2\nBlessures : 14",
    body: "# Capacités\nFaim des tombes. Quand elle mord une créature vivante, la goule soigne 1d6 blessures.\nMarée basse. Elle se cache sous le ponton jusqu'à ce que quelqu'un marche dessus.",
  },
  tokenName: "Marta, poissonnière",
  secret: "Marta est la contrebandière. Elle ment sur la cargaison, et devient nerveuse si on parle du hangar à bateaux.",
  tokenNote: { text: "**Contrebandière.** Ment sur la cargaison.\n\n- Nerveuse quand on parle du **hangar**\n- Doit 40 po au maître du port" },
  mapNotes: [
    { id: "planks", note: { type: "piege", title: "Planches pourries", text: "Jet de sauvegarde de Dextérité **DD 12** ou chute dans l'eau.", done: true } },
    { id: "well", note: { type: "objet", title: "Clé au fond du puits", text: "Attachée à la corde du seau. Ouvre le hangar à bateaux." } },
    {
      id: "trapdoor",
      note: {
        type: "mecanique",
        title: "Trappe vers les grottes",
        text: "Sous les caisses. Perception **DD 15** pour repérer l'anneau.\n\nDonne sur une échelle qui descend à la grotte des contrebandiers.",
      },
    },
    { id: "ambush", note: { type: "libre", title: "Embuscade à la nuit", text: "Quatre contrebandiers attendent derrière les filets si le groupe s'attarde." } },
  ],
  openNote: "trapdoor",
};

export const EXAMPLES = document.documentElement.lang === "fr" ? fr : en;
