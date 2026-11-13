// Les fenêtres de l'extension sur le site guide : le même HTML et la même feuille de style que dans Owlbear,
// chacune dans un Shadow DOM pour que les styles de l'extension et ceux du site ne se mélangent pas.
import extensionCss from "../style.css?inline";
import { setLanguage } from "../i18n";

// Les textes de l'extension suivent la langue de la page, pas le réglage enregistré dans ce navigateur.
setLanguage(document.documentElement.lang === "fr" ? "fr" : "en");

/**
 * La feuille de l'extension vise :root et body, qui n'existent pas dans un Shadow DOM :
 * :root devient l'hôte, body devient le conteneur .app.
 */
const sheet = new CSSStyleSheet();
sheet.replaceSync(
  extensionCss
    .replace(/:root\[data-theme="light"\]/g, ':host([data-theme="light"])')
    .replace(/:root/g, ":host")
    .replace(/(^|[\s,}])body(?=[\s.:{,])/g, "$1.app"),
);

export interface ExtWindow {
  /** Le conteneur, l'équivalent du <body> de la fenêtre dans Owlbear. */
  app: HTMLElement;
  /** L'équivalent de #app, où chaque page de l'extension écrit son HTML. */
  root: HTMLElement;
}

/** Prépare la fenêtre dans l'élément hôte ; `render` y écrit ensuite le HTML de l'extension. */
export function mountWindow(host: HTMLElement): ExtWindow {
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  shadow.adoptedStyleSheets = [sheet];
  shadow.innerHTML = `<div class="app"><div id="app"></div></div>`;
  // Démonstration : rien ne s'envoie, un formulaire validé ne doit pas recharger la page.
  shadow.addEventListener("submit", (event) => event.preventDefault());
  return { app: shadow.querySelector<HTMLElement>(".app")!, root: shadow.querySelector<HTMLElement>("#app")! };
}
