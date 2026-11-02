import { escapeHtml } from "./manual";
import type { Ability, Statblock } from "./types";

const ALLOWED_TAGS = new Set(
  "p strong em b i u br ul ol li table thead tbody tr td th sup sub span a".split(" "),
);
const DROPPED_TAGS = new Set(
  "script style svg iframe object embed link meta img video audio form input button template noscript".split(" "),
);

/** Ne garde que des balises de mise en forme, sans aucun attribut (sauf les liens AideDD). */
function clean(nodes: Iterable<Node>, baseUrl: string, doc: Document): string {
  const out = doc.createElement("div");

  const copy = (node: Node, parent: Node) => {
    if (node.nodeType === 3) {
      parent.appendChild(doc.createTextNode(node.textContent ?? ""));
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as Element;
    const tag = element.tagName.toLowerCase();
    if (DROPPED_TAGS.has(tag)) return;

    let target: Node = parent;
    if (ALLOWED_TAGS.has(tag)) {
      if (tag === "a") {
        const href = safeHref(element.getAttribute("href"), baseUrl);
        if (href) {
          const link = doc.createElement("a");
          link.setAttribute("href", href);
          link.setAttribute("target", "_blank");
          link.setAttribute("rel", "noopener noreferrer");
          target = parent.appendChild(link);
        }
      } else {
        target = parent.appendChild(doc.createElement(tag));
      }
    }
    element.childNodes.forEach((child) => copy(child, target));
  };

  for (const node of nodes) copy(node, out);
  return out.innerHTML.trim();
}

function safeHref(href: string | null, baseUrl: string): string | null {
  if (!href) return null;
  try {
    const url = new URL(href, baseUrl);
    return url.protocol === "https:" && /(^|\.)aidedd\.org$/.test(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, " ").trim() ?? "";

function parseAbilities(root: Element): Ability[] {
  // Fiches 2014 : <div class="carac"><strong>FOR</strong><br>18 (+4)</div>
  const classic = Array.from(root.querySelectorAll(".carac")).map((cell) => {
    const label = text(cell.querySelector("strong"));
    const value = text(cell).slice(label.length).trim();
    const match = value.match(/^(\S+)\s*\(([^)]+)\)/);
    return {
      label,
      score: match ? match[1] : value,
      mod: match ? match[2] : "",
    };
  });
  if (classic.length) return classic;

  // Fiches 2024 : cellules à plat libellé / valeur / mod / jet de sauvegarde
  const abilities: Ability[] = [];
  root.querySelectorAll(".car1, .car4").forEach((labelCell) => {
    const cells: string[] = [];
    let next = labelCell.nextElementSibling;
    while (next && cells.length < 3) {
      cells.push(text(next));
      next = next.nextElementSibling;
    }
    abilities.push({
      label: text(labelCell),
      score: cells[0] ?? "",
      mod: cells[1] ?? "",
      save: cells[2],
    });
  });
  return abilities;
}

function parseProps(root: Element, baseUrl: string, doc: Document) {
  const props: Statblock["props"] = [];

  const initiative = root.querySelector(".init");
  if (initiative) {
    const label = escapeHtml(text(initiative.querySelector("strong")));
    props.push({
      label,
      valueHtml: clean(
        Array.from(initiative.childNodes).filter((n) => n.nodeName !== "STRONG"),
        baseUrl,
        doc,
      ),
    });
  }

  const block = root.querySelector(".red");
  if (!block) return props;
  const children = Array.from(block.childNodes);
  children.forEach((node, index) => {
    if (node.nodeName !== "STRONG") return;
    const value: Node[] = [];
    for (let i = index + 1; i < children.length; i++) {
      const name = children[i].nodeName;
      if (name === "BR" || name === "STRONG" || name === "DIV") break;
      value.push(children[i]);
    }
    props.push({
      label: escapeHtml(text(node as Element)),
      valueHtml: clean(value, baseUrl, doc),
    });
  });
  return props;
}

function parseSections(root: Element, baseUrl: string, doc: Document) {
  const body = root.querySelector(".sansSerif");
  const sections: Statblock["sections"] = [];
  if (!body) return sections;

  const red = root.querySelector(".red");
  let current: Statblock["sections"][number] = { title: "", entries: [] };
  sections.push(current);

  const visit = (parent: Element) => {
    for (const child of Array.from(parent.children)) {
      if (child === red) continue;
      if (child.classList.contains("rub")) {
        current = { title: text(child), entries: [] };
        sections.push(current);
      } else if (child.classList.contains("type") || child.querySelector(":scope > svg")) {
        continue;
      } else if (child.tagName === "DIV" && child.children.length && !child.textContent?.trim()) {
        continue;
      } else {
        const html = clean([child], baseUrl, doc);
        if (html) current.entries.push(html);
      }
    }
  };
  visit(body);
  return sections.filter((section) => section.title || section.entries.length);
}

/** Extrait la fiche d'une page AideDD. Renvoie null si ce n'est pas une fiche. */
export function parseStatblock(html: string, pageUrl: string): Statblock | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const root = doc.querySelector(".jaune");
  const name = text(root?.querySelector("h1"));
  if (!root || !name) return null;

  const props = parseProps(root, pageUrl, doc);
  const sections = parseSections(root, pageUrl, doc);
  if (!props.length && !sections.length) return null;

  const extras = Array.from(doc.querySelectorAll(".description, .habitat"));
  return {
    name,
    type: text(root.querySelector(".type")),
    props,
    abilities: parseAbilities(root),
    sections,
    source: text(doc.querySelector(".source")),
    extrasHtml: extras
      .map((element) => clean(element.childNodes, pageUrl, doc))
      .filter(Boolean)
      .map((part) => `<p>${part}</p>`)
      .join(""),
  };
}
