import DOMPurify from "dompurify";
import { Marked } from "marked";
import { escapeHtml } from "./manual";

const marked = new Marked({
  gfm: true,
  // Un simple retour à la ligne reste visible, comme dans les notes écrites en texte brut.
  breaks: true,
  renderer: {
    // Le HTML écrit dans une note s'affiche tel quel : « <5 PV » ou « <b> » restent du texte.
    html: ({ text }) => escapeHtml(text),
  },
});

// Dans la fenêtre d'Owlbear, un lien ne doit pas remplacer la note.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName !== "A") return;
  node.setAttribute("target", "_blank");
  node.setAttribute("rel", "noopener noreferrer");
});

/** HTML sûr à partir du markdown d'une note. Les liens dangereux (`javascript:`…) sont retirés. */
export function renderMarkdown(text: string) {
  return DOMPurify.sanitize(marked.parse(text, { async: false }));
}

/** Première ligne du texte, sans ses marques de mise en forme. */
export function markdownPreview(text: string) {
  // Un <template> est inerte : ses images ne sont pas chargées.
  const template = document.createElement("template");
  template.innerHTML = renderMarkdown(text);
  template.content.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
  return (template.content.textContent ?? "").trim().split("\n", 1)[0];
}
