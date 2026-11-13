// HTML de la fenêtre des réglages, sans Owlbear : l'extension (settings.ts) et le site guide l'affichent tel quel.
import { currentLanguage, t, type LanguageSetting } from "./i18n";
import { icon } from "./icons";
import { escapeHtml } from "./manual";

const PATREON_URL = "https://www.patreon.com/misterjj_obr";
/** Le site guide, en anglais ou en français sous /fr/. */
const GUIDE_URL = "https://hidden-ink.pages.dev/";

export type SettingsMessage = { text: string; kind: "success" | "error" | "warning" };

export interface SettingsState {
  /** Choix de langue de ce navigateur. */
  setting: LanguageSetting;
  /** Ce navigateur a une clé. */
  hasKey: boolean;
  /** La salle attend une clé (n'importe laquelle). */
  roomHasKey: boolean;
  /** La salle attend une clé que ce navigateur n'a pas. */
  stuck: boolean;
  /** La clé a déjà été copiée ou affichée. */
  saved: boolean;
  /**
   * Confirmation en cours, dans un encadré sous l'action : les fenêtres de confirmation du navigateur
   * sont bloquées dans Owlbear.
   */
  confirming?: "import" | "restart";
  importText: string;
  message?: SettingsMessage;
}

const confirmBox = (id: string, text: string, confirmLabel: string, extra = "") => `
  <div class="confirm" role="alertdialog" aria-labelledby="${id}-text">
    <p class="warning">${icon("key", 14)}<span id="${id}-text">${escapeHtml(text)}</span></p>
    ${extra}
    <div class="row">
      <button type="button" class="btn danger solid" id="${id}-yes">${escapeHtml(confirmLabel)}</button>
      <button type="button" class="btn ghost" id="${id}-no">${t("common.cancel")}</button>
    </div>
  </div>`;

export function settingsHtml(state: SettingsState) {
  const { setting, hasKey, roomHasKey, stuck, saved, confirming, importText, message } = state;
  const language = (value: LanguageSetting, label: string, lang = "") =>
    `<button type="button" data-language="${value}" aria-pressed="${setting === value}"${lang ? ` lang="${lang}"` : ""}>${label}</button>`;

  /**
   * Bloqué : la salle reprend la clé de ce navigateur, ou une neuve. Sinon, la réinitialisation
   * remplace la clé de ce navigateur par une neuve.
   */
  const restartText = stuck
    ? `${t(hasKey ? "settings.restartUseMine" : "settings.restartNew")} ${t("settings.restartLoss")}`
    : t("settings.resetReplace");
  const restart =
    !hasKey && !roomHasKey
      ? ""
      : confirming === "restart"
        ? confirmBox(
            "restart",
            restartText,
            t("settings.restartConfirm"),
            `<label class="check"><input type="checkbox" id="purge" /> ${t("settings.restartPurge")}</label>`,
          )
        : `<button type="button" class="btn small ${stuck ? "" : "danger"} reset-key" id="restart">${icon("key", 14)}${t(stuck ? "settings.restart" : "settings.reset")}</button>`;

  return `
    <div class="editor settings">
      <header class="bar" id="drag" title="${t("window.drag")}">
        <span class="grip">${icon("grip", 14)}</span>
        <span class="title">${t("app.name")} <small>· ${t("settings.title")}</small></span>
        <button type="button" class="icon" id="close" title="${t("common.close")}">${icon("close")}</button>
      </header>
      <div class="pane">
        <section>
          <h2>${t("settings.language")}</h2>
          <div class="segmented" role="group" aria-label="${t("settings.language")}">
            ${language("auto", t("settings.languageAuto"))}
            ${language("fr", "Français", "fr")}
            ${language("en", "English", "en")}
          </div>
          <p class="hint">${t("settings.languageHelp")}</p>
        </section>
        <section>
          <h2>${t("settings.key")}</h2>
          <p class="hint">${t("settings.keyIntro")}</p>
          ${
            hasKey
              ? `<div class="key-card">
                  <div class="row">
                    <button type="button" class="btn small ghost" id="show">${icon("eye", 14)}${t("settings.keyShow")}</button>
                    <button type="button" class="btn small ${saved ? "" : "primary"}" id="copy">${icon("copy", 14)}${t("settings.keyCopy")}</button>
                  </div>
                  <p class="key-value" id="key-value" hidden></p>
                </div>
                ${saved ? "" : `<p class="warning">${icon("key", 14)}<span>${t("settings.keyNotExported")}</span></p>`}
                ${stuck ? `<p class="warning">${icon("lock", 14)}<span>${t("settings.keyOtherRoom")}</span></p>` : ""}`
              : `<p class="info">${icon(roomHasKey ? "lock" : "key", 14)}<span>${t(roomHasKey ? "crypto.noKey" : "settings.keyNone")}</span></p>`
          }
          ${restart}
        </section>
        <section>
          <h2>${t("settings.keyImport")}</h2>
          <div class="row">
            <input id="import" autocomplete="off" spellcheck="false" placeholder="${t("settings.keyImportHint")}" aria-label="${t("settings.keyImport")}" value="${escapeHtml(importText)}" />
            <button type="button" class="btn" id="import-button">${t("settings.keyImportButton")}</button>
          </div>
          ${confirming === "import" ? confirmBox("replace", t("settings.keyReplace"), t("settings.keyReplaceConfirm")) : ""}
          ${message ? `<p class="${message.kind}">${icon(message.kind === "success" ? "check" : "key", 14)}<span>${escapeHtml(message.text)}</span></p>` : ""}
        </section>
        <section class="about">
          <h2>${t("settings.about")}</h2>
          <p class="hint">${t("settings.support")}</p>
          <p><a class="patreon" href="${PATREON_URL}" target="_blank" rel="noopener">${t("settings.patreon")}</a></p>
          <p class="hint"><a href="${currentLanguage() === "fr" ? `${GUIDE_URL}fr/` : GUIDE_URL}" target="_blank" rel="noopener">${t("settings.guide")}</a></p>
        </section>
      </div>
    </div>`;
}
