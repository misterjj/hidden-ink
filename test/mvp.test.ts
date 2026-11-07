import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { byteSize, generateKey, isSealed, openWith, parseKey, sealWith, LockedError } from "../src/crypto";
import { DICTIONARIES, setLanguage, t } from "../src/i18n";
import { statblockToManual } from "../src/manual";
import { buildNote, noteTypeLabel } from "../src/notes";
import { attribution, creatureToStatblock, formatChallenge, type Open5eCreature } from "../src/open5e";
import { statblockHtml } from "../src/sheet";

const fixture = (name: string) =>
  JSON.parse(readFileSync(`test/fixtures/${name}`, "utf8")) as Open5eCreature;

afterEach(() => setLanguage(undefined));

describe("chiffrement", () => {
  it("chiffre et déchiffre, sans aucun texte lisible dans la donnée stockée", async () => {
    const key = await generateKey();
    const note = { type: "piege", title: "Trappe sous le tapis", text: "Jet de DEX 15" };
    const sealed = await sealWith(key, note);
    expect(isSealed(sealed)).toBe(true);
    expect(JSON.stringify(sealed)).not.toMatch(/Trappe|tapis|DEX/);
    expect(await openWith(key, sealed)).toEqual(note);
  });

  it("utilise un vecteur neuf à chaque écriture", async () => {
    const key = await generateKey();
    const [a, b] = await Promise.all([sealWith(key, "même texte"), sealWith(key, "même texte")]);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it("refuse une autre clé, une clé absente ou une donnée modifiée", async () => {
    const [key, other] = await Promise.all([generateKey(), generateKey()]);
    const sealed = await sealWith(key, { text: "secret" });
    await expect(openWith(other, sealed)).rejects.toBeInstanceOf(LockedError);
    await expect(openWith(null, sealed)).rejects.toBeInstanceOf(LockedError);
    const tampered = { ...sealed, ct: sealed.ct.replace(/^./, (c) => (c === "A" ? "B" : "A")) };
    await expect(openWith(key, tampered)).rejects.toBeInstanceOf(LockedError);
  });

  it("exporte une clé en texte et la relit à l'identique", async () => {
    const key = await generateKey();
    const copy = await parseKey(` ${key.raw}\n`);
    expect(copy?.kid).toBe(key.kid);
    expect(await openWith(copy, await sealWith(key, 42))).toBe(42);
    expect(await parseKey("pas une clé")).toBeNull();
    expect(await parseKey(btoa("trop court"))).toBeNull();
  });

  it("garde une note de 8 ko sous la limite d'Owlbear une fois chiffrée", async () => {
    const key = await generateKey();
    const sealed = await sealWith(key, { text: "é".repeat(4000) });
    // Environ +33 % : le base64 reste raisonnable.
    expect(byteSize(sealed)).toBeLessThan(12 * 1024);
  });
});

describe("traduction", () => {
  it("a les mêmes clés en français et en anglais, sans texte vide", () => {
    expect(Object.keys(DICTIONARIES.en).sort()).toEqual(Object.keys(DICTIONARIES.fr).sort());
    for (const dictionary of Object.values(DICTIONARIES)) {
      for (const text of Object.values(dictionary)) expect(text.trim()).not.toBe("");
    }
  });

  it("suit la langue choisie, avec les variables", () => {
    setLanguage("en");
    expect(noteTypeLabel("piege")).toBe("Trap");
    expect(t("notes.tooLong", { size: 9, max: 8 })).toBe("Note too long (9 KB, 8 KB maximum).");
    expect(buildNote("objet", "", "Under the rug")).toEqual({
      note: { type: "objet", title: "Hidden item", text: "Under the rug" },
    });
    setLanguage("fr");
    expect(noteTypeLabel("piege")).toBe("Piège");
  });
});

describe("Open5e", () => {
  it("écrit le facteur de puissance comme dans les livres", () => {
    expect([0.125, 0.25, 0.5, 1, 17].map(formatChallenge)).toEqual(["1/8", "1/4", "1/2", "1", "17"]);
  });

  it("construit la fiche du gobelin avec sa source et sa licence", () => {
    setLanguage("en");
    const statblock = creatureToStatblock(fixture("open5e-goblin.json"));
    expect(statblock.name).toBe("Goblin");
    expect(statblock.type).toBe("Small humanoid, neutral evil");
    const props = Object.fromEntries(statblock.props.map((prop) => [prop.label, prop.valueHtml]));
    expect(props["Armor Class"]).toBe("15 (leather armor, shield)");
    expect(props["Hit Points"]).toBe("7 (2d6)");
    expect(props["Speed"]).toBe("30 ft.");
    expect(props["Skills"]).toBe("Stealth +6");
    expect(props["Senses"]).toBe("darkvision 60 ft., passive Perception 9");
    expect(props["Challenge"]).toBe("1/4 (50 XP)");
    expect(statblock.abilities.map((a) => `${a.label} ${a.score} ${a.mod}`)).toEqual([
      "STR 8 -1",
      "DEX 14 +2",
      "CON 10 +0",
      "INT 10 +0",
      "WIS 8 -1",
      "CHA 8 -1",
    ]);
    expect(statblock.sections.map((s) => s.title)).toEqual(["", "Actions"]);
    expect(statblock.sections[1].entries[0]).toContain("<strong><em>Scimitar</em></strong>");
    expect(statblock.source).toBe(attribution("srd-2014"));
    expect(statblockHtml(statblock)).toContain("CC-BY-4.0");
  });

  it("range les actions légendaires, la recharge et les jets de sauvegarde du dragon", () => {
    setLanguage("en");
    const statblock = creatureToStatblock(fixture("open5e-adult-red-dragon.json"));
    const titles = statblock.sections.map((s) => s.title);
    expect(titles).toEqual(["", "Actions", "Legendary Actions"]);
    const actions = statblock.sections[1].entries.join("");
    expect(actions).toContain("Fire Breath (Recharge 5–6)");
    // Dans l'ordre du livre, pas dans l'ordre alphabétique.
    expect(actions.indexOf("Multiattack")).toBeLessThan(actions.indexOf("Bite"));
    expect(statblock.sections[2].entries.join("")).toContain("Wing Attack (Costs 2 Actions)");
    expect(statblock.abilities.find((a) => a.label === "DEX")?.save).toBe("+6");
    expect(statblock.abilities.find((a) => a.label === "STR")?.save).toBeUndefined();
  });

  it("échappe le texte et se recopie dans la saisie à la main", () => {
    setLanguage("fr");
    const goblin = fixture("open5e-goblin.json");
    goblin.traits = [{ name: "<b>Ruse</b>", desc: "<img src=x onerror=alert(1)>" }];
    const statblock = creatureToStatblock(goblin);
    expect(statblockHtml(statblock)).not.toContain("<img");
    const manual = statblockToManual(statblock);
    expect(manual.ac).toBe("15 (leather armor, shield)");
    expect(manual.abilities).toEqual(["8", "14", "10", "10", "8", "8"]);
    expect(manual.body).toContain("# Actions");
  });
});
