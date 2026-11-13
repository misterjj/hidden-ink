// Petit « ? » à côté d'un champ : sa bulle donne le format attendu.
// Une seule bulle pour toute la page, placée pour rester visible dans la fenêtre.

import { escapeHtml } from "./manual";

export const help = (text: string) =>
  `<span class="help" tabindex="0" role="button" aria-label="${escapeHtml(text)}" data-tip="${escapeHtml(text)}">?</span>`;

/** Libellé de champ suivi de son « ? ». */
export const labelWithHelp = (label: string, text: string) => `<span class="label-row">${label}${help(text)}</span>`;

const MARGIN = 8;

export function wireHelp(root: HTMLElement) {
  // La page peut être redessinée plusieurs fois : une seule bulle et un seul jeu d'écouteurs.
  if (root.dataset.help) return;
  root.dataset.help = "1";
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  // Dans un Shadow DOM (site guide), la bulle reste à l'intérieur pour garder ses styles.
  const container = root.getRootNode();
  (container instanceof ShadowRoot ? container : document.body).append(tooltip);
  let pinned: HTMLElement | null = null;

  const show = (target: HTMLElement) => {
    tooltip.textContent = target.dataset.tip ?? "";
    tooltip.hidden = false;
    const anchor = target.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(anchor.left + anchor.width / 2 - box.width / 2, innerWidth - box.width - MARGIN));
    // Sous le « ? », ou au-dessus s'il n'y a plus la place.
    const below = anchor.bottom + 6;
    const top = below + box.height > innerHeight - MARGIN ? Math.max(MARGIN, anchor.top - box.height - 6) : below;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  };
  const hide = () => {
    tooltip.hidden = true;
    pinned = null;
  };
  const helpOf = (event: Event) => (event.target as HTMLElement).closest<HTMLElement>(".help");

  root.addEventListener("pointerover", (event) => {
    const target = helpOf(event);
    if (target) show(target);
  });
  root.addEventListener("pointerout", (event) => {
    if (helpOf(event) && !pinned) tooltip.hidden = true;
  });
  root.addEventListener("focusin", (event) => {
    const target = helpOf(event);
    if (target) show(target);
  });
  root.addEventListener("focusout", (event) => {
    if (helpOf(event)) hide();
  });
  // Sur écran tactile : un appui affiche la bulle, un autre la referme. Le champ ne prend pas le focus.
  root.addEventListener("click", (event) => {
    const target = helpOf(event);
    if (!target) {
      if (pinned) hide();
      return;
    }
    event.preventDefault();
    if (pinned === target) hide();
    else {
      pinned = target;
      show(target);
    }
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !tooltip.hidden) hide();
  });
  root.addEventListener("scroll", hide, true);
}
