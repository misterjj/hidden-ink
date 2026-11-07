// Textes de l'interface, en français et en anglais. Le contenu écrit par le MJ n'est jamais traduit.

export type Language = "fr" | "en";
export type LanguageSetting = Language | "auto";

const fr = {
  // Général
  "editor.recommended": "Recommandé",
  "notes.openSettings": "Ouvrir les réglages",
  "settings.keySaved": "Sauvegardée",
  "settings.keyToSave": "À sauvegarder",
  "app.name": "Hidden Ink",
  "common.close": "Fermer",
  "common.save": "Enregistrer",
  "common.cancel": "Annuler",
  "common.delete": "Supprimer",
  "common.edit": "Modifier",
  "common.loading": "Chargement…",
  "error.action": "Hidden Ink : action impossible.",
  "error.save": "Enregistrement impossible.",

  // Menu contextuel
  "menu.addFiche": "Ajouter une fiche de monstre",
  "menu.viewFiche": "Voir la fiche de monstre",
  "menu.addTokenNote": "Ajouter une note secrète",
  "menu.viewTokenNote": "Voir la note secrète",

  // Éditeur de fiche
  "editor.title": "Fiche de monstre",
  "editor.question": "Comment veux-tu remplir cette fiche ?",
  "editor.choice.open5e": "Recherche Open5e",
  "editor.choice.open5eHint": "Cherche un monstre du SRD en anglais : la fiche complète est ajoutée.",
  "editor.choice.link": "Lien AideDD",
  "editor.choice.linkHint": "Colle un lien : toute la fiche est récupérée automatiquement.",
  "editor.choice.manual": "Saisie à la main",
  "editor.choice.manualHint": "Remplis les informations toi-même, sans dépendre d'un site.",
  "editor.back": "← Changer de méthode",
  "editor.link.label": "Lien de la fiche",
  "editor.link.attach": "Attacher au token",
  "editor.link.adapt": "Adapter",
  "editor.link.toManual": "Saisir à la main",
  "editor.link.hint":
    "Colle le lien : la fiche se charge toute seule. <b>Adapter</b> la recopie dans la saisie à la main pour la modifier, sans les liens vers les sorts.",
  "editor.link.attachError": "Impossible d'attacher cette fiche.",
  "editor.link.loadError": "Impossible de charger cette fiche.",
  "editor.open5e.label": "Nom du monstre",
  "editor.open5e.placeholder": "goblin, dragon, owlbear…",
  "editor.open5e.hint": "Monstres du SRD 5.1 et 5.2, en anglais. <b>Adapter</b> recopie la fiche dans la saisie à la main.",
  "editor.open5e.empty": "Aucun monstre trouvé.",
  "editor.open5e.short": "Tape au moins 2 lettres.",
  "editor.open5e.cr": "FP {cr}",
  "editor.open5e.attach": "Attacher",
  "editor.manual.name": "Nom *",
  "editor.manual.type": "Type",
  "editor.manual.typePlaceholder": "Plante de taille G, sans alignement",
  "editor.manual.ac": "Classe d'armure",
  "editor.manual.acPlaceholder": "15 (armure naturelle)",
  "editor.manual.hp": "Points de vie",
  "editor.manual.hpPlaceholder": "136 (16d10 + 48)",
  "editor.manual.speed": "Vitesse",
  "editor.manual.speedPlaceholder": "6 m, nage 6 m",
  "editor.manual.props": "Autres informations",
  "editor.manual.propsHint": "(une par ligne, « Libellé : valeur »)",
  "editor.manual.propsPlaceholder":
    "Résistances aux dégâts : froid, feu\nImmunités aux états : aveuglé\nSens : vision aveugle 18 m\nPuissance : 5 (1800 PX)",
  "editor.manual.body": "Capacités et actions",
  "editor.manual.bodyHint": "(une par ligne, « Nom. Description » ; « # Titre » pour une section)",
  "editor.manual.bodyPlaceholder":
    "Absorption de foudre. Ne subit aucun dégât de foudre et récupère autant de PV.\n# Actions\nCoup. +7 au toucher, allonge 1,50 m. Touché : 13 (2d8 + 4) contondants.",
  "editor.manual.submit": "Enregistrer sur le token",
  "editor.manual.nameRequired": "Le nom est obligatoire.",
  "editor.manual.tooLong": "Fiche trop longue ({size} ko, {max} ko maximum).",
  "editor.manual.saveError": "Enregistrement impossible sur ce token.",
  "editor.remove": "Retirer la fiche de ce token",

  // Fenêtre de fiche
  "window.drag": "Glisser pour déplacer",
  "window.openSource": "Ouvrir la source",
  "window.edit": "Modifier la fiche",
  "window.note": "Note secrète du token",
  "window.minimize": "Réduire",
  "window.restore": "Remettre en grand",
  "window.resize": "Redimensionner",
  "window.unavailable": "Fiche indisponible",
  "window.retry": "Tu peux réessayer plus tard, ou remplir cette fiche à la main.",
  "window.fillManual": "Saisir à la main",
  "window.error": "Impossible d'afficher cette fiche.",

  // Fiche
  "sheet.ac": "Classe d'armure",
  "sheet.hp": "Points de vie",
  "sheet.speed": "Vitesse",
  "sheet.initiative": "Initiative",
  "sheet.saves": "Jets de sauvegarde",
  "sheet.saveShort": "JS",
  "sheet.skills": "Compétences",
  "sheet.damageVulnerabilities": "Vulnérabilités aux dégâts",
  "sheet.damageResistances": "Résistances aux dégâts",
  "sheet.damageImmunities": "Immunités aux dégâts",
  "sheet.conditionImmunities": "Immunités aux états",
  "sheet.senses": "Sens",
  "sheet.languages": "Langues",
  "sheet.challenge": "Puissance",
  "sheet.traits": "Capacités",
  "sheet.actions": "Actions",
  "sheet.bonusActions": "Actions bonus",
  "sheet.reactions": "Réactions",
  "sheet.legendaryActions": "Actions légendaires",
  "sheet.lairActions": "Actions d'antre",
  "sheet.description": "Description",
  "sheet.manualSource": "Saisie à la main",
  "sheet.abilities": "FOR,DEX,CON,INT,SAG,CHA",
  "part.defense": "Défense et déplacement",
  "part.abilities": "Caractéristiques",
  "part.resist": "Résistances et immunités",
  "part.info": "Compétences, sens et langues",

  // Erreurs de chargement
  "fiche.badLink":
    "Ce lien n'est pas une fiche de monstre AideDD. Exemple : https://www.aidedd.org/dnd/monstres.php?vf=gobelin",
  "fiche.aideddUnreachable": "Impossible de joindre AideDD pour le moment.",
  "fiche.aideddDown": "AideDD n'est pas disponible pour le moment.",
  "fiche.aideddUnreadable": "Cette page AideDD ne contient pas de fiche lisible.",
  "fiche.open5eUnreachable": "Impossible de joindre Open5e pour le moment.",
  "fiche.open5eMissing": "Ce monstre n'existe plus sur Open5e.",

  // Notes de carte
  "notes.tool": "Notes de carte",
  "notes.place": "Poser une note",
  "notes.list": "Liste des notes de la scène",
  "notes.titles": "Afficher ou masquer les titres",
  "notes.settings": "Réglages de Hidden Ink",
  "notes.type.piege": "Piège",
  "notes.type.objet": "Objet caché",
  "notes.type.mecanique": "Mécanique",
  "notes.type.libre": "Note libre",
  "notes.finishFirst": "Termine d'abord la note en cours.",
  "notes.markDone": "Marquer comme fait",
  "notes.markTodo": "Remettre à faire",
  "notes.fieldType": "Type",
  "notes.fieldTitle": "Titre",
  "notes.fieldText": "Texte",
  "notes.markdownHint": "(markdown : **gras**, *italique*, # titre, - liste…)",
  "notes.empty": "Écris au moins un titre ou un texte.",
  "notes.tooLong": "Note trop longue ({size} ko, {max} ko maximum).",
  "notes.listTitle": "Notes de la scène",
  "notes.search": "Rechercher…",
  "notes.all": "Toutes",
  "notes.noMatch": "Aucune note ne correspond.",
  "notes.noneYet": "Aucune note dans cette scène. Clique sur la carte avec l'outil Notes pour en poser une.",

  // Note secrète d'un token
  "tokenNote.title": "Note secrète",
  "tokenNote.placeholder": "Ce que seul le MJ sait de ce token…",
  "tokenNote.empty": "Écris un texte, ou supprime la note.",
  "tokenNote.openFiche": "Fiche",

  // Chiffrement
  "crypto.locked": "Note chiffrée — importe la clé dans les réglages de Hidden Ink.",
  "crypto.lockedFiche": "Fiche chiffrée — importe la clé dans les réglages de Hidden Ink.",
  "crypto.noKey":
    "Cette salle utilise une clé que ce navigateur n'a pas. Importe-la dans les réglages de Hidden Ink avant d'écrire.",
  "crypto.backupReminder": "Hidden Ink : exporte ta clé dans les réglages, sinon tes notes seront perdues avec ce navigateur.",

  // Réglages
  "settings.title": "Réglages",
  "settings.language": "Langue",
  "settings.languageAuto": "Auto",
  "settings.key": "Clé de chiffrement",
  "settings.keyIntro":
    "Tes fiches et notes sont chiffrées avec une clé gardée dans ce navigateur. Sans elle, personne ne peut les lire, pas même toi sur un autre appareil.",
  "settings.keyNotExported": "Tu n'as pas encore sauvegardé ta clé : un navigateur vidé ferait perdre toutes tes notes.",
  "settings.keyShow": "Afficher la clé",
  "settings.keyHide": "Masquer",
  "settings.keyCopy": "Copier",
  "settings.keyCopied": "Copiée ✓",
  "settings.keyNone": "Aucune clé dans ce navigateur pour le moment. Elle sera créée à ta première note.",
  "settings.keyImport": "Importer une clé",
  "settings.keyImportHint": "Colle la clé d'un autre appareil ou d'un co-MJ.",
  "settings.keyImportButton": "Importer",
  "settings.keyInvalid": "Cette clé n'est pas valide.",
  "settings.keyOtherRoom": "Attention : cette clé n'est pas celle de cette salle.",
  "settings.keyImported": "Clé importée.",
  "settings.keyReplace": "Remplacer la clé actuelle ? Les notes chiffrées avec elle deviendront illisibles sans une copie.",
};

type Key = keyof typeof fr;

const en: Record<Key, string> = {
  "editor.recommended": "Recommended",
  "notes.openSettings": "Open settings",
  "settings.keySaved": "Saved",
  "settings.keyToSave": "Not saved yet",
  "app.name": "Hidden Ink",
  "common.close": "Close",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.delete": "Delete",
  "common.edit": "Edit",
  "common.loading": "Loading…",
  "error.action": "Hidden Ink: action failed.",
  "error.save": "Could not save.",

  "menu.addFiche": "Add a stat block",
  "menu.viewFiche": "View stat block",
  "menu.addTokenNote": "Add a secret note",
  "menu.viewTokenNote": "View secret note",

  "editor.title": "Stat block",
  "editor.question": "How do you want to fill this stat block?",
  "editor.choice.open5e": "Search Open5e",
  "editor.choice.open5eHint": "Find a monster from the SRD: the full stat block is added.",
  "editor.choice.link": "AideDD link",
  "editor.choice.linkHint": "Paste a link to a French AideDD page: the whole stat block is fetched.",
  "editor.choice.manual": "Write it by hand",
  "editor.choice.manualHint": "Fill in the details yourself, without relying on a website.",
  "editor.back": "← Change method",
  "editor.link.label": "Stat block link",
  "editor.link.attach": "Attach to token",
  "editor.link.adapt": "Adapt",
  "editor.link.toManual": "Write by hand",
  "editor.link.hint":
    "Paste the link: the stat block loads by itself. <b>Adapt</b> copies it into the manual form so you can change it, without spell links.",
  "editor.link.attachError": "Could not attach this stat block.",
  "editor.link.loadError": "Could not load this stat block.",
  "editor.open5e.label": "Monster name",
  "editor.open5e.placeholder": "goblin, dragon, owlbear…",
  "editor.open5e.hint": "Monsters from SRD 5.1 and 5.2. <b>Adapt</b> copies the stat block into the manual form.",
  "editor.open5e.empty": "No monster found.",
  "editor.open5e.short": "Type at least 2 letters.",
  "editor.open5e.cr": "CR {cr}",
  "editor.open5e.attach": "Attach",
  "editor.manual.name": "Name *",
  "editor.manual.type": "Type",
  "editor.manual.typePlaceholder": "Large plant, unaligned",
  "editor.manual.ac": "Armor Class",
  "editor.manual.acPlaceholder": "15 (natural armor)",
  "editor.manual.hp": "Hit Points",
  "editor.manual.hpPlaceholder": "136 (16d10 + 48)",
  "editor.manual.speed": "Speed",
  "editor.manual.speedPlaceholder": "20 ft., swim 20 ft.",
  "editor.manual.props": "Other details",
  "editor.manual.propsHint": "(one per line, “Label: value”)",
  "editor.manual.propsPlaceholder":
    "Damage Resistances: cold, fire\nCondition Immunities: blinded\nSenses: blindsight 60 ft.\nChallenge: 5 (1,800 XP)",
  "editor.manual.body": "Traits and actions",
  "editor.manual.bodyHint": "(one per line, “Name. Description”; “# Title” for a section)",
  "editor.manual.bodyPlaceholder":
    "Lightning Absorption. Takes no lightning damage and regains that many hit points.\n# Actions\nSlam. +7 to hit, reach 5 ft. Hit: 13 (2d8 + 4) bludgeoning damage.",
  "editor.manual.submit": "Save on the token",
  "editor.manual.nameRequired": "The name is required.",
  "editor.manual.tooLong": "Stat block too long ({size} KB, {max} KB maximum).",
  "editor.manual.saveError": "Could not save on this token.",
  "editor.remove": "Remove the stat block from this token",

  "window.drag": "Drag to move",
  "window.openSource": "Open the source",
  "window.edit": "Edit the stat block",
  "window.note": "Token's secret note",
  "window.minimize": "Minimize",
  "window.restore": "Restore",
  "window.resize": "Resize",
  "window.unavailable": "Stat block unavailable",
  "window.retry": "You can try again later, or fill this stat block by hand.",
  "window.fillManual": "Write by hand",
  "window.error": "Could not show this stat block.",

  "sheet.ac": "Armor Class",
  "sheet.hp": "Hit Points",
  "sheet.speed": "Speed",
  "sheet.initiative": "Initiative",
  "sheet.saves": "Saving Throws",
  "sheet.saveShort": "Save",
  "sheet.skills": "Skills",
  "sheet.damageVulnerabilities": "Damage Vulnerabilities",
  "sheet.damageResistances": "Damage Resistances",
  "sheet.damageImmunities": "Damage Immunities",
  "sheet.conditionImmunities": "Condition Immunities",
  "sheet.senses": "Senses",
  "sheet.languages": "Languages",
  "sheet.challenge": "Challenge",
  "sheet.traits": "Traits",
  "sheet.actions": "Actions",
  "sheet.bonusActions": "Bonus Actions",
  "sheet.reactions": "Reactions",
  "sheet.legendaryActions": "Legendary Actions",
  "sheet.lairActions": "Lair Actions",
  "sheet.description": "Description",
  "sheet.manualSource": "Written by hand",
  "sheet.abilities": "STR,DEX,CON,INT,WIS,CHA",
  "part.defense": "Defense and movement",
  "part.abilities": "Ability scores",
  "part.resist": "Resistances and immunities",
  "part.info": "Skills, senses and languages",

  "fiche.badLink":
    "This link is not an AideDD monster page. Example: https://www.aidedd.org/dnd/monstres.php?vf=gobelin",
  "fiche.aideddUnreachable": "Cannot reach AideDD right now.",
  "fiche.aideddDown": "AideDD is not available right now.",
  "fiche.aideddUnreadable": "This AideDD page has no readable stat block.",
  "fiche.open5eUnreachable": "Cannot reach Open5e right now.",
  "fiche.open5eMissing": "This monster no longer exists on Open5e.",

  "notes.tool": "Map notes",
  "notes.place": "Place a note",
  "notes.list": "Scene notes list",
  "notes.titles": "Show or hide titles",
  "notes.settings": "Hidden Ink settings",
  "notes.type.piege": "Trap",
  "notes.type.objet": "Hidden item",
  "notes.type.mecanique": "Mechanism",
  "notes.type.libre": "Free note",
  "notes.finishFirst": "Finish the current note first.",
  "notes.markDone": "Mark as done",
  "notes.markTodo": "Mark as to do",
  "notes.fieldType": "Type",
  "notes.fieldTitle": "Title",
  "notes.fieldText": "Text",
  "notes.markdownHint": "(markdown: **bold**, *italic*, # heading, - list…)",
  "notes.empty": "Write at least a title or some text.",
  "notes.tooLong": "Note too long ({size} KB, {max} KB maximum).",
  "notes.listTitle": "Scene notes",
  "notes.search": "Search…",
  "notes.all": "All",
  "notes.noMatch": "No note matches.",
  "notes.noneYet": "No notes in this scene yet. Click the map with the Notes tool to place one.",

  "tokenNote.title": "Secret note",
  "tokenNote.placeholder": "What only the GM knows about this token…",
  "tokenNote.empty": "Write some text, or delete the note.",
  "tokenNote.openFiche": "Stat block",

  "crypto.locked": "Encrypted note — import the key in Hidden Ink settings.",
  "crypto.lockedFiche": "Encrypted stat block — import the key in Hidden Ink settings.",
  "crypto.noKey":
    "This room uses a key this browser does not have. Import it in Hidden Ink settings before writing.",
  "crypto.backupReminder": "Hidden Ink: export your key in the settings, or your notes will be lost with this browser.",

  "settings.title": "Settings",
  "settings.language": "Language",
  "settings.languageAuto": "Auto",
  "settings.key": "Encryption key",
  "settings.keyIntro":
    "Your stat blocks and notes are encrypted with a key kept in this browser. Without it, nobody can read them, not even you on another device.",
  "settings.keyNotExported": "You have not saved your key yet: clearing this browser would lose all your notes.",
  "settings.keyShow": "Show the key",
  "settings.keyHide": "Hide",
  "settings.keyCopy": "Copy",
  "settings.keyCopied": "Copied ✓",
  "settings.keyNone": "No key in this browser yet. It will be created with your first note.",
  "settings.keyImport": "Import a key",
  "settings.keyImportHint": "Paste the key from another device or a co-GM.",
  "settings.keyImportButton": "Import",
  "settings.keyInvalid": "This key is not valid.",
  "settings.keyOtherRoom": "Warning: this key is not the one used in this room.",
  "settings.keyImported": "Key imported.",
  "settings.keyReplace": "Replace the current key? Notes encrypted with it will become unreadable without a copy.",
};

export const DICTIONARIES: Record<Language, Record<Key, string>> = { fr, en };

const SETTING_KEY = "hidden-ink/langue";

export function languageSetting(): LanguageSetting {
  try {
    const saved = localStorage.getItem(SETTING_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    // Stockage indisponible : on suit le navigateur.
  }
  return "auto";
}

const browserLanguage = (): Language =>
  typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("fr")
    ? "fr"
    : "en";

let forced: Language | undefined;

export function currentLanguage(): Language {
  if (forced) return forced;
  const setting = languageSetting();
  return setting === "auto" ? browserLanguage() : setting;
}

/** Change la langue de ce navigateur. `auto` suit la langue du navigateur. */
export function saveLanguageSetting(setting: LanguageSetting) {
  try {
    if (setting === "auto") localStorage.removeItem(SETTING_KEY);
    else localStorage.setItem(SETTING_KEY, setting);
  } catch {
    // Sans stockage, le choix ne dure que le temps de la page.
  }
  forced = setting === "auto" ? undefined : setting;
}

/** Pour les tests : impose une langue sans rien enregistrer. */
export function setLanguage(language: Language | undefined) {
  forced = language;
}

export function t(key: Key, vars: Record<string, string | number> = {}) {
  const text = DICTIONARIES[currentLanguage()][key] ?? fr[key];
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

/** Locale pour les comparaisons et la casse. */
export const locale = () => currentLanguage();

/** Les pages suivent la langue choisie dans un autre onglet ou une autre fenêtre. */
export function onLanguageChange(callback: () => void) {
  window.addEventListener("storage", (event) => {
    if (event.key === SETTING_KEY) callback();
  });
}
