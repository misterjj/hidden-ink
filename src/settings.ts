import OBR from "@owlbear-rodeo/sdk";
import { importKey, isExported, localKey, markExported, roomKid, type Key } from "./crypto";
import { currentLanguage, languageSetting, saveLanguageSetting, t, type LanguageSetting } from "./i18n";
import { icon } from "./icons";
import { escapeHtml } from "./manual";
import { SETTINGS_POPOVER_ID } from "./notes";
import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app")!;
/** Remplacer une clé existante demande un deuxième clic : les fenêtres de confirmation sont bloquées dans Owlbear. */
let replaceArmed = false;

async function render(message?: { text: string; kind: "success" | "error" | "warning" }) {
  document.documentElement.lang = currentLanguage();
  const [key, kid] = await Promise.all([localKey(), roomKid()]);
  const setting = languageSetting();
  const language = (value: LanguageSetting, label: string) =>
    `<button type="button" data-language="${value}" aria-pressed="${setting === value}">${label}</button>`;
  const saved = isExported();

  app.innerHTML = `
    <div class="editor settings">
      <header class="bar">
        <span class="title">${t("app.name")} <small>· ${t("settings.title")}</small></span>
        <button type="button" class="icon" id="close" title="${t("common.close")}">${icon("close")}</button>
      </header>
      <div class="pane">
        <section>
          <h2>${t("settings.language")}</h2>
          <div class="segmented" role="group" aria-label="${t("settings.language")}">
            ${language("auto", t("settings.languageAuto"))}
            ${language("en", "English")}
            ${language("fr", "Français")}
          </div>
        </section>
        <section>
          <h2>${t("settings.key")}</h2>
          <p class="hint">${t("settings.keyIntro")}</p>
          ${
            key
              ? `<div class="key-card">
                  <div class="row">
                    <span class="status ${saved ? "ok" : "todo"}">${icon(saved ? "check" : "key", 14)}${t(saved ? "settings.keySaved" : "settings.keyToSave")}</span>
                    <span class="row">
                      <button type="button" class="btn small ghost" id="show">${icon("eye", 14)}${t("settings.keyShow")}</button>
                      <button type="button" class="btn small primary" id="copy">${icon("copy", 14)}${t("settings.keyCopy")}</button>
                    </span>
                  </div>
                  <p class="key-value" id="key-value" hidden></p>
                </div>
                ${saved ? "" : `<p class="warning">${icon("key", 14)}<span>${t("settings.keyNotExported")}</span></p>`}
                ${kid && kid !== key.kid ? `<p class="warning">${icon("lock", 14)}<span>${t("settings.keyOtherRoom")}</span></p>` : ""}`
              : `<p class="info">${icon(kid ? "lock" : "key", 14)}<span>${t(kid ? "crypto.noKey" : "settings.keyNone")}</span></p>`
          }
        </section>
        <section>
          <h2>${t("settings.keyImport")}</h2>
          <div class="row">
            <input id="import" autocomplete="off" spellcheck="false" placeholder="${t("settings.keyImportHint")}" aria-label="${t("settings.keyImport")}" />
            <button type="button" class="btn" id="import-button">${t("settings.keyImportButton")}</button>
          </div>
          <div id="import-message">${
            message ? `<p class="${message.kind}">${icon(message.kind === "success" ? "check" : "key", 14)}<span>${escapeHtml(message.text)}</span></p>` : ""
          }</div>
        </section>
      </div>
    </div>`;

  app.querySelector<HTMLButtonElement>("#close")!.onclick = () => OBR.popover.close(SETTINGS_POPOVER_ID);
  app.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.onclick = () => {
      saveLanguageSetting(button.dataset.language as LanguageSetting);
      // Les menus et outils d'Owlbear gardent leur texte jusqu'au rechargement de la page.
      render();
    };
  });
  if (key) wireKey(key);

  app.querySelector<HTMLButtonElement>("#import-button")!.onclick = async () => {
    const text = app.querySelector<HTMLInputElement>("#import")!.value;
    if (!text.trim()) return;
    const current = await localKey();
    if (current && current.raw !== text.trim() && !replaceArmed) {
      replaceArmed = true;
      const button = app.querySelector<HTMLButtonElement>("#import-button")!;
      button.classList.add("primary");
      app.querySelector("#import-message")!.innerHTML = `<p class="warning">${icon("key", 14)}<span>${escapeHtml(t("settings.keyReplace"))}</span></p>`;
      return;
    }
    replaceArmed = false;
    const imported = await importKey(text);
    if (!imported) {
      render({ text: t("settings.keyInvalid"), kind: "error" });
      return;
    }
    const room = await roomKid();
    render(
      room && room !== imported.kid
        ? { text: t("settings.keyOtherRoom"), kind: "warning" }
        : { text: t("settings.keyImported"), kind: "success" },
    );
  };
}

function wireKey(key: Key) {
  const value = app.querySelector<HTMLElement>("#key-value")!;
  const show = app.querySelector<HTMLButtonElement>("#show")!;
  // La clé n'est jamais visible sans un clic, pour ne pas la montrer en partage d'écran.
  show.onclick = () => {
    value.hidden = !value.hidden;
    value.textContent = value.hidden ? "" : key.raw;
    show.innerHTML = value.hidden ? `${icon("eye", 14)}${t("settings.keyShow")}` : `${icon("eyeOff", 14)}${t("settings.keyHide")}`;
    if (!value.hidden) markExported();
  };
  const copy = app.querySelector<HTMLButtonElement>("#copy")!;
  copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(key.raw);
    } catch {
      // Copie refusée par le navigateur : la clé s'affiche, prête à être sélectionnée.
      value.hidden = false;
      value.textContent = key.raw;
      show.innerHTML = `${icon("eyeOff", 14)}${t("settings.keyHide")}`;
      return;
    }
    markExported();
    copy.innerHTML = `${icon("check", 14)}${t("settings.keyCopied")}`;
    // Le statut passe à « Sauvegardée ».
    setTimeout(() => render(), 1200);
  };
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    await OBR.popover.close(SETTINGS_POPOVER_ID);
    return;
  }
  render();
});
