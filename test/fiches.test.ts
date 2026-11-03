import {
  MAX_NOTE_BYTES,
  NOTE_MAX_HEIGHT,
  NOTE_WIDTH,
  buildNote,
  centeredView,
  filterNotes,
  isMapNote,
  noteImageUrl,
  noteLabel,
  notePopoverPosition,
  type ListedNote,
  type NoteType,
} from "../src/notes";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { handleFicheRequest, normalizeFicheUrl } from "../shared/aidedd";
import { manualToStatblock, parseManualBody, statblockToManual } from "../src/manual";
import { markdownPreview, renderMarkdown } from "../src/markdown";
import { parseStatblock } from "../src/parser";
import { statblockParts } from "../src/sheet";

const fixture = (name: string) =>
  readFileSync(`test/fixtures/${name}.html`, "utf8");
const parse = (name: string) =>
  parseStatblock(fixture(name), "https://www.aidedd.org/dnd/monstres.php?vf=x")!;
const prop = (s: NonNullable<ReturnType<typeof parse>>, label: string) =>
  s.props.find((p) => p.label === label)?.valueHtml;

describe("parseStatblock", () => {
  it("lit toutes les informations du tertre errant", () => {
    const s = parse("tertre-errant");
    expect(s.name).toBe("Tertre errant");
    expect(s.type).toBe("Plante de taille G, sans alignement");
    expect(prop(s, "Classe d'armure")).toBe("15 (armure naturelle)");
    expect(prop(s, "Points de vie")).toBe("136 (16d10 + 48)");
    expect(prop(s, "Vitesse")).toBe("6 m, nage 6 m");
    expect(prop(s, "Résistances aux dégâts")).toBe("froid, feu");
    expect(prop(s, "Immunités aux dégâts")).toBe("foudre");
    expect(prop(s, "Immunités aux états")).toBe("aveuglé, assourdi, épuisement");
    expect(prop(s, "Puissance")).toBe("5 (1800 PX)");
    expect(s.abilities.map((a) => `${a.label} ${a.score} ${a.mod}`)).toEqual([
      "FOR 18 +4", "DEX 8 -1", "CON 16 +3", "INT 5 -3", "SAG 10 +0", "CHA 5 -3",
    ]);
    expect(s.sections.map((x) => [x.title, x.entries.length])).toEqual([
      ["", 1],
      ["Actions", 3],
    ]);
    expect(s.sections[0].entries[0]).toContain("Absorption de foudre");
    expect(s.sections[1].entries[2]).toContain("Engloutissement");
    expect(s.source).toBe("Monster Manual (SRD)");
  });

  it("garde les actions légendaires et les liens de sorts de la liche", () => {
    const s = parse("liche");
    expect(s.sections.map((x) => x.title)).toEqual(["", "Actions", "Actions légendaires"]);
    expect(prop(s, "Jets de sauvegarde")).toBe("Con +10, Int +12, Sag +9");
    expect(s.sections.flatMap((x) => x.entries).join("")).toContain(
      'href="https://www.aidedd.org/dnd/sorts.php?vf=main-de-mage"',
    );
  });

  it("lit le format 2024 avec jets de sauvegarde et initiative", () => {
    const s = parse("goblin-warrior-2024");
    expect(s.name).toBe("Goblin Warrior");
    expect(s.type).toBe("Small Fey (Goblinoid), Chaotic Neutral");
    expect(prop(s, "Initiative")).toBe("+2 (12)");
    expect(prop(s, "HP")).toBe("10 (3d6)");
    expect(prop(s, "CR")).toBe("1/4 (XP 50; PB +2)");
    expect(s.abilities).toHaveLength(6);
    expect(s.abilities[1]).toEqual({ label: "Dex", score: "15", mod: "+2", save: "+2" });
    expect(s.sections.map((x) => [x.title, x.entries.length])).toEqual([
      ["Actions", 2],
      ["Bonus actions", 1],
    ]);
    expect(s.extrasHtml).toContain("Goblins are Feywild");
  });

  it("lit une fiche 2024 en français", () => {
    const s = parse("mimique-2024-fr");
    expect(s.name).toBe("Mimique");
    expect(s.type).toBe("Monstruosité de taille M, Neutre");
    expect(prop(s, "Initiative")).toBe("+3 (13)");
    expect(prop(s, "CA")).toBe("12");
    expect(prop(s, "Pv")).toBe("58 (9d8 + 18)");
    expect(prop(s, "Immunités")).toBe("acide ; À terre");
    expect(prop(s, "FP")).toBe("2 (PX 450 ; BM +2)");
    expect(s.abilities[0]).toEqual({ label: "For", score: "17", mod: "+3", save: "+3" });
    expect(s.abilities[4]).toEqual({ label: "Sag", score: "13", mod: "+1", save: "+1" });
    expect(s.sections.map((x) => [x.title, x.entries.length])).toEqual([
      ["Traits", 1],
      ["Actions", 2],
      ["Actions Bonus", 1],
    ]);
    expect(s.source).toBe("Monster Manual 2024 (BR)");

    const parts = statblockParts(s);
    expect(parts.map((p) => p.label)).toEqual([
      "Défense et déplacement",
      "Caractéristiques",
      "Résistances et immunités",
      "Compétences, sens et langues",
      "Traits",
      "Actions",
      "Actions Bonus",
    ]);
    const html = (label: string) => parts.find((p) => p.label === label)!.html;
    expect(html("Défense et déplacement")).toContain("<strong>CA</strong>");
    expect(html("Défense et déplacement")).toContain("<strong>Pv</strong>");
    expect(html("Compétences, sens et langues")).toContain("<strong>FP</strong>");
  });

  it("n'inclut rien de parasite dans les propriétés", () => {
    for (const name of ["tertre-errant", "liche", "dragon-rouge-adulte", "goblin-warrior-2024", "mimique-2024-fr"]) {
      const s = parse(name);
      const all = JSON.stringify(s);
      expect(all).not.toMatch(/<svg|<script|<div|polyline|style=/);
      for (const p of s.props) expect(p.valueHtml, p.label).not.toBe("");
    }
  });

  it("refuse une page qui n'est pas une fiche", () => {
    expect(parseStatblock(fixture("erreur"), "https://www.aidedd.org/monster/x")).toBeNull();
  });

  it("neutralise le HTML dangereux", () => {
    const html = `<div class="jaune"><h1>X</h1><div class="sansSerif"><div class="red"><strong>CA</strong> 1<br></div>
      <p onclick="evil()">ok<script>evil()</script><img src=x onerror=evil()><a href="javascript:evil()">a</a><a href="https://evil.test/">b</a></p></div></div>`;
    const out = JSON.stringify(parseStatblock(html, "https://www.aidedd.org/dnd/monstres.php?vf=x"));
    expect(out).not.toMatch(/evil|onclick|onerror|<img|<script/);
  });
});

describe("normalizeFicheUrl", () => {
  it.each([
    ["https://www.aidedd.org/dnd/monstres.php?vf=tertre-errant", "https://www.aidedd.org/dnd/monstres.php?vf=tertre-errant"],
    ["  http://aidedd.org/dnd/monstres.php?vo=goblin&x=1 ", "https://www.aidedd.org/dnd/monstres.php?vo=goblin"],
    ["www.aidedd.org/monster/goblin-warrior", "https://www.aidedd.org/monster/goblin-warrior"],
    ["https://www.aidedd.org/monster/fr/mimique", "https://www.aidedd.org/monster/fr/mimique"],
    ["aidedd.org/monster/es/mimeto/", "https://www.aidedd.org/monster/es/mimeto"],
  ])("accepte %s", (input, expected) => {
    expect(normalizeFicheUrl(input)).toBe(expected);
  });

  it.each([
    "",
    "pas un lien",
    "https://evil.test/dnd/monstres.php?vf=x",
    "https://www.aidedd.org.evil.test/dnd/monstres.php?vf=x",
    "https://www.aidedd.org@evil.test/dnd/monstres.php?vf=x",
    "https://www.aidedd.org/dnd/sorts.php?vf=x",
    "https://www.aidedd.org/dnd/monstres.php?vf=../../x",
    "https://www.aidedd.org/monster/..%2F..%2Fadmin",
    "https://www.aidedd.org/monster/fr/../../admin",
    "https://www.aidedd.org/monster/fr/mimique/autre",
    "https://www.aidedd.org/monster/FRA/mimique",
  ])("refuse %s", (input) => {
    expect(normalizeFicheUrl(input)).toBeNull();
  });
});

describe("relais", () => {
  const request = (url: string) =>
    new URL(`https://x.test/api/fiche?url=${encodeURIComponent(url)}`);

  it("refuse les sites tiers sans rien appeler", async () => {
    const fetchImpl = vi.fn();
    const response = await handleFicheRequest(request("https://evil.test/"), fetchImpl);
    expect(response.status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("renvoie la page en texte brut", async () => {
    const fetchImpl = vi.fn(async () => new Response("<h1>ok</h1>"));
    const response = await handleFicheRequest(
      request("https://www.aidedd.org/dnd/monstres.php?vf=x"),
      fetchImpl as unknown as typeof fetch,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
  });

  it("signale AideDD indisponible : panne réseau, erreur, redirection", async () => {
    const url = request("https://www.aidedd.org/dnd/monstres.php?vf=x");
    const down = vi.fn(async () => { throw new Error("down"); });
    expect((await handleFicheRequest(url, down as unknown as typeof fetch)).status).toBe(502);
    for (const status of [500, 503, 302]) {
      const f = vi.fn(async () => new Response(null, { status }));
      expect((await handleFicheRequest(url, f as unknown as typeof fetch)).status).toBe(502);
    }
  });
});

describe("saisie à la main", () => {
  const base = {
    name: "Ogre <b>", type: "Géant", ac: "11", hp: "59 (7d10 + 21)", speed: "12 m",
    abilities: ["19", "8", "16", "5", "7", ""],
    props: "Résistances aux dégâts : froid, feu\nsans libellé",
    body: "Brute. Frappe fort.\n# Actions\nMassue. +6 au toucher.\nRéactions\nParade : +2 CA.",
  };

  it("construit une fiche complète", () => {
    const s = manualToStatblock(base);
    expect(s.abilities.map((a) => a.mod)).toEqual(["+4", "-1", "+3", "-3", "-2", ""]);
    expect(s.props.find((p) => p.label === "Résistances aux dégâts")?.valueHtml).toBe("froid, feu");
    expect(s.props.at(-1)).toEqual({ label: "", valueHtml: "sans libellé" });
    expect(s.sections.map((x) => x.title)).toEqual(["", "Actions", "Réactions"]);
    expect(s.sections[1].entries[0]).toContain("<strong><em>Massue</em></strong>");
  });

  it("échappe tout le texte saisi", () => {
    const sections = parseManualBody("<img src=x onerror=evil()>. <script>evil()</script>");
    expect(JSON.stringify(sections)).not.toMatch(/<img|<script/);
    const s = manualToStatblock({
      ...base,
      ac: "<script>evil()</script>",
      props: "<b>x</b> : <img src=x>",
    });
    expect(JSON.stringify(s.props)).not.toMatch(/<script|<img|<b>/);
  });

  it("accepte une fiche réduite au nom", () => {
    const s = manualToStatblock({ ...base, ac: "", hp: "", speed: "", abilities: ["","","","","",""], props: "", body: "" });
    expect(s.props).toEqual([]);
    expect(s.abilities).toEqual([]);
    expect(s.sections).toEqual([]);
  });
});

describe("adapter une fiche AideDD", () => {
  const words = (html: string) => {
    const host = document.createElement("div");
    host.innerHTML = html.replace(/<(br|\/p|\/li|\/td|\/th|\/tr)\b[^>]*>/g, " $&");
    return (host.textContent ?? "").replace(/\s+/g, " ").trim();
  };

  it("répartit le tertre errant dans les champs de la saisie", () => {
    const m = statblockToManual(parse("tertre-errant"));
    expect(m.name).toBe("Tertre errant");
    expect(m.type).toBe("Plante de taille G, sans alignement");
    expect(m.ac).toBe("15 (armure naturelle)");
    expect(m.hp).toBe("136 (16d10 + 48)");
    expect(m.speed).toBe("6 m, nage 6 m");
    expect(m.abilities).toEqual(["18", "8", "16", "5", "10", "5"]);
    expect(m.props).toContain("Résistances aux dégâts : froid, feu");
    expect(m.props).not.toMatch(/Classe d'armure|Points de vie|Vitesse/);
    expect(m.props).toContain("Source : Monster Manual (SRD)");
    expect(m.body).toContain("# Actions");
  });

  it("reconnaît les libellés anglais et ceux de 2024", () => {
    const fr = statblockToManual(parse("mimique-2024-fr"));
    expect([fr.ac, fr.hp]).toEqual(["12", "58 (9d8 + 18)"]);
    expect(fr.abilities[0]).toBe("17");
    const en = statblockToManual(parse("goblin-warrior-2024"));
    expect(en.hp).toBe("10 (3d6)");
    expect(en.props).toContain("Initiative : +2 (12)");
    expect(en.body).toContain("# Description");
    expect(en.body).toContain("Goblins are Feywild");
  });

  it("garde un jet de sauvegarde différent du modificateur", () => {
    const m = statblockToManual({
      name: "X", type: "", props: [], sections: [], source: "", extrasHtml: "",
      abilities: [
        { label: "For", score: "17", mod: "+3", save: "+3" },
        { label: "Dex", score: "12", mod: "+1", save: "+5" },
      ],
    });
    expect(m.props).toBe("Jets de sauvegarde : Dex +5");
  });

  it.each(["tertre-errant", "liche", "dragon-rouge-adulte", "goblin-warrior-2024", "mimique-2024-fr"])(
    "ne perd aucun texte de %s et tient dans la limite",
    (name) => {
      const source = parse(name);
      const manual = statblockToManual(source);
      const copy = manualToStatblock(manual);
      expect(new TextEncoder().encode(JSON.stringify(manual)).length).toBeLessThan(12 * 1024);
      expect(copy.name).toBe(source.name);
      expect(copy.abilities.map((a) => a.mod)).toEqual(source.abilities.map((a) => a.mod));
      const text = words(
        copy.props.map((p) => `<p>${p.label} ${p.valueHtml}</p>`).join("") +
          copy.sections.flatMap((s) => [s.title, ...s.entries].map((e) => `<p>${e}</p>`)).join(""),
      );
      for (const section of source.sections) {
        if (section.title) expect(text).toContain(section.title);
        for (const entry of section.entries) expect(text).toContain(words(entry));
      }
      for (const prop of source.props) expect(text).toContain(words(prop.valueHtml));
    },
  );
});

describe("pictos de la fenêtre réduite", () => {
  it("découpe la liche en parties sans rien perdre", () => {
    const s = parse("liche");
    const parts = statblockParts(s);
    expect(parts.map((p) => p.label)).toEqual([
      "Défense et déplacement",
      "Caractéristiques",
      "Résistances et immunités",
      "Compétences, sens et langues",
      "Capacités",
      "Actions",
      "Actions légendaires",
      "Description",
    ]);
    const html = (label: string) => parts.find((p) => p.label === label)!.html;
    expect(html("Défense et déplacement")).toContain("135 (18d8 + 54)");
    expect(html("Caractéristiques")).toContain("20 (+5)");
    expect(html("Résistances et immunités")).toContain("nécrotique");
    expect(html("Compétences, sens et langues")).toContain("Perception +9");
    expect(html("Compétences, sens et langues")).toContain("33000 PX");
    // Chaque propriété apparaît dans exactement une partie.
    for (const prop of s.props) {
      const found = parts.filter((p) => p.html.includes(`<strong>${prop.label}</strong>`));
      expect(found, prop.label).toHaveLength(1);
    }
  });

  it("gère le format 2024 et omet les parties vides", () => {
    const parts = statblockParts(parse("goblin-warrior-2024"));
    expect(parts.map((p) => p.label)).toEqual([
      "Défense et déplacement",
      "Caractéristiques",
      "Compétences, sens et langues",
      "Actions",
      "Bonus actions",
      "Description",
    ]);
  });

  it("marche pour une fiche saisie à la main", () => {
    const parts = statblockParts(manualToStatblock({
      name: "X", type: "", ac: "11", hp: "", speed: "",
      abilities: ["", "", "", "", "", ""],
      props: "Résistances aux dégâts : feu",
      body: "# Réactions\nParade. +2 CA.",
    }));
    expect(parts.map((p) => p.label)).toEqual([
      "Défense et déplacement",
      "Résistances et immunités",
      "Réactions",
    ]);
  });
});

describe("markdown des notes", () => {
  it("met en forme le texte", () => {
    const html = renderMarkdown("# Piège\n\n**Fosse** et *pieux*\n\n- un\n- deux\n\n|a|b|\n|-|-|\n|1|2|");
    expect(html).toContain("<h1>Piège</h1>");
    expect(html).toContain("<strong>Fosse</strong> et <em>pieux</em>");
    expect(html).toContain("<li>deux</li>");
    expect(html).toContain("<td>2</td>");
  });

  it("garde les retours à la ligne d'une note en texte brut", () => {
    expect(renderMarkdown("ligne 1\nligne 2")).toMatch(/ligne 1<br>\s*ligne 2/);
  });

  it("affiche le HTML écrit à la main comme du texte", () => {
    const html = renderMarkdown('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)"> et <b>x</b>');
    const host = document.createElement("div");
    host.innerHTML = html;
    expect(host.querySelector("script, img, b")).toBeNull();
    expect(host.textContent).toContain("<script>alert(1)</script>");
    expect(renderMarkdown("moins de <5 PV")).toContain("&lt;5 PV");
  });

  it("retire les liens dangereux et ouvre les autres dans un nouvel onglet", () => {
    expect(renderMarkdown("[x](javascript:alert(1))")).not.toContain("javascript:");
    expect(renderMarkdown("![x](javascript:alert(1))")).not.toContain("javascript:");
    const host = document.createElement("div");
    host.innerHTML = renderMarkdown("[règle](https://example.com/a)");
    const link = host.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://example.com/a");
    expect(link.target).toBe("_blank");
    expect(link.rel).toBe("noopener noreferrer");
  });

  it("donne un aperçu sans mise en forme pour la liste", () => {
    expect(markdownPreview("## **Fosse** cachée\n\nDétail")).toBe("Fosse cachée");
    expect(markdownPreview("- un\n- deux")).toBe("un");
    expect(markdownPreview("ligne 1\nligne 2")).toBe("ligne 1");
    expect(markdownPreview("")).toBe("");
  });
});

describe("notes de carte", () => {
  it("reconnaît une note valide et refuse le reste", () => {
    expect(isMapNote({ type: "piege", title: "Fosse", text: "" })).toBe(true);
    expect(isMapNote({ type: "constructor", title: "x", text: "" })).toBe(false);
    expect(isMapNote({ type: "piege", title: "x" })).toBe(false);
    expect(isMapNote(undefined)).toBe(false);
  });

  it("donne le nom du type à une note sans titre et refuse une note vide", () => {
    expect(buildNote("objet", "  ", " Clé sous le tapis ")).toEqual({
      note: { type: "objet", title: "Objet caché", text: "Clé sous le tapis" },
    });
    expect(buildNote("piege", " ", "\n")).toHaveProperty("error");
  });

  it("refuse une note trop longue, en comptant les octets", () => {
    expect(buildNote("libre", "t", "é".repeat(MAX_NOTE_BYTES))).toHaveProperty("error");
  });

  it("garde l'état « fait » à la modification et change d'image", () => {
    expect(buildNote("piege", "Fosse", "", true)).toEqual({
      note: { type: "piege", title: "Fosse", text: "", done: true },
    });
    expect(noteImageUrl("https://x.test", { type: "piege", done: true })).toBe(
      "https://x.test/notes/piege-fait.png",
    );
    expect(noteImageUrl("https://x.test", { type: "piege" })).toBe(
      "https://x.test/notes/piege.png",
    );
  });

  it("filtre par type et texte, sans casse, et range les notes faites à la fin", () => {
    const notes = [
      { id: "1", note: { type: "piege", title: "Zone", text: "", done: true } },
      { id: "2", note: { type: "piege", title: "Fosse", text: "Pieux ÉPAIS" } },
      { id: "3", note: { type: "objet", title: "Clé", text: "" } },
    ] as ListedNote[];
    const ids = (type: NoteType | "", search: string) =>
      filterNotes(notes, type, search).map(({ id }) => id);
    expect(ids("", "")).toEqual(["3", "2", "1"]);
    expect(ids("piege", "")).toEqual(["2", "1"]);
    expect(ids("", "épais")).toEqual(["2"]);
  });

  it("ouvre la note à côté du picto, sans sortir de l'écran", () => {
    expect(notePopoverPosition({ x: 100, y: 200 }, 1000, 800)).toEqual({ left: 132, top: 160 });
    expect(notePopoverPosition({ x: 900, y: 200 }, 1000, 800).left).toBe(900 - 32 - NOTE_WIDTH);
    expect(notePopoverPosition({ x: 100, y: 790 }, 1000, 800).top).toBe(800 - NOTE_MAX_HEIGHT - 8);
    expect(notePopoverPosition({ x: 100, y: 0 }, 1000, 800).top).toBe(8);
  });

  it("affiche le titre sur la carte, coupé s'il est long, ou rien si l'option est coupée", () => {
    expect(noteLabel({ title: "Fosse" }, true)).toBe("Fosse");
    expect(noteLabel({ title: "Fosse" }, false)).toBe("");
    const label = noteLabel({ title: "é".repeat(50) }, true);
    expect(Array.from(label)).toHaveLength(32);
    expect(label.endsWith("…")).toBe(true);
    expect(noteLabel({ title: "x".repeat(32) }, true)).toBe("x".repeat(32));
  });

  it("calcule la vue qui centre un point", () => {
    expect(centeredView({ x: 100, y: 50 }, 2, 1000, 800)).toEqual({ x: 300, y: 300 });
  });
});

describe("manifest", () => {
  it("respecte la limite de description d'Owlbear", () => {
    const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8"));
    expect(manifest.description.length).toBeLessThanOrEqual(128);
  });
});
