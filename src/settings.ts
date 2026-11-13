import OBR from "@owlbear-rodeo/sdk";
import { importKey, isExported, localKey, markExported, parseKey, restartRoomKey, roomKid, type Key } from "./crypto";
import { currentLanguage, languageSetting, saveLanguageSetting, t, type LanguageSetting } from "./i18n";
import { icon } from "./icons";
import { settingsHtml, type SettingsMessage } from "./settings-view";
import { unreadableData } from "./key-reset";
import { wirePanelMove } from "./panel-move";
import { SETTINGS_POPOVER_ID } from "./notes";
import "./style.css";
import "./theme";

const app = document.querySelector<HTMLDivElement>("#app")!;

/**
 * Confirmation en cours, dans un encadré sous l'action : les fenêtres de confirmation du navigateur
 * sont bloquées dans Owlbear.
 */
let confirming: "import" | "restart" | undefined;
/** Le texte collé survit aux redessins de la page. */
let importText = "";

async function render(message?: SettingsMessage) {
  document.documentElement.lang = currentLanguage();
  const [key, kid] = await Promise.all([localKey(), roomKid()]);
  const setting = languageSetting();
  const saved = isExported();
  /** La salle attend une clé que ce navigateur n'a pas : sans sortie, plus rien ne s'écrit. */
  const stuck = !!kid && kid !== key?.kid;
  app.innerHTML = settingsHtml({ setting, hasKey: !!key, roomHasKey: !!kid, stuck, saved, confirming, importText, message });

  app.querySelector<HTMLButtonElement>("#close")!.onclick = () => OBR.popover.close(SETTINGS_POPOVER_ID);
  app.querySelectorAll<HTMLButtonElement>("[data-language]").forEach((button) => {
    button.onclick = () => {
      saveLanguageSetting(button.dataset.language as LanguageSetting);
      // Les menus et outils d'Owlbear gardent leur texte jusqu'au rechargement de la page.
      render();
    };
  });
  wirePanelMove(app.querySelector<HTMLElement>("#drag")!, "settings");
  if (key) wireKey(key);
  wireRestart();
  wireImport();
  app.querySelector<HTMLButtonElement>("#restart-yes, #replace-yes")?.focus();
}

function wireRestart() {
  const open = app.querySelector<HTMLButtonElement>("#restart");
  if (open)
    open.onclick = () => {
      confirming = "restart";
      render();
    };
  const no = app.querySelector<HTMLButtonElement>("#restart-no");
  if (no)
    no.onclick = () => {
      confirming = undefined;
      render();
    };
  const yes = app.querySelector<HTMLButtonElement>("#restart-yes");
  if (!yes) return;
  yes.onclick = async () => {
    const purge = app.querySelector<HTMLInputElement>("#purge")!.checked;
    const [current, kid] = await Promise.all([localKey(), roomKid()]);
    const fresh = !!current && (!kid || kid === current.kid);
    yes.setAttribute("aria-busy", "true");
    confirming = undefined;
    try {
      const key = await restartRoomKey(fresh);
      if (purge && (await OBR.scene.isReady())) {
        const { remove, clear } = unreadableData(await OBR.scene.items.getItems(), key.kid);
        if (remove.length) await OBR.scene.items.deleteItems(remove);
        if (clear.size)
          await OBR.scene.items.updateItems([...clear.keys()], (drafts) => {
            for (const draft of drafts) for (const metadataKey of clear.get(draft.id)!) delete draft.metadata[metadataKey];
          });
      }
      render({ text: t("settings.restartDone"), kind: "success" });
    } catch {
      render({ text: t("error.save"), kind: "error" });
    }
  };
}

function wireImport() {
  const field = app.querySelector<HTMLInputElement>("#import")!;
  field.oninput = () => {
    importText = field.value;
    // La clé collée a changé : la question posée ne vaut plus.
    if (confirming === "import") {
      confirming = undefined;
      app.querySelector(".confirm")?.remove();
    }
  };
  field.onkeydown = (event) => {
    if (event.key === "Enter") app.querySelector<HTMLButtonElement>("#import-button")!.click();
  };

  const finish = async (text: string) => {
    confirming = undefined;
    const imported = await importKey(text);
    if (!imported) {
      render({ text: t("settings.keyInvalid"), kind: "error" });
      return;
    }
    importText = "";
    const room = await roomKid();
    render(
      room && room !== imported.kid
        ? { text: t("settings.keyOtherRoom"), kind: "warning" }
        : { text: t("settings.keyImported"), kind: "success" },
    );
  };

  app.querySelector<HTMLButtonElement>("#import-button")!.onclick = async () => {
    const text = field.value.trim();
    if (!text) return;
    importText = text;
    const [current, parsed] = await Promise.all([localKey(), parseKey(text)]);
    if (!parsed) {
      render({ text: t("settings.keyInvalid"), kind: "error" });
      return;
    }
    // Remplacer une autre clé se confirme dans un encadré, avec ses conséquences.
    if (current && current.kid !== parsed.kid) {
      confirming = "import";
      render();
      return;
    }
    await finish(text);
  };
  const yes = app.querySelector<HTMLButtonElement>("#replace-yes");
  if (yes) yes.onclick = () => finish(importText.trim());
  const no = app.querySelector<HTMLButtonElement>("#replace-no");
  if (no)
    no.onclick = () => {
      confirming = undefined;
      render();
    };
}

/**
 * Owlbear ouvre les réglages dans une iframe sans le droit « clipboard-write » : l'API moderne
 * y est refusée. L'ancienne commande de copie, lancée pendant le clic, passe encore.
 */
async function copyText(text: string) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  area.remove();
  if (copied) return true;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
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
    if (!(await copyText(key.raw))) {
      // Copie refusée partout : la clé s'affiche déjà sélectionnée, prête pour Ctrl/Cmd + C.
      value.hidden = false;
      value.textContent = key.raw;
      show.innerHTML = `${icon("eyeOff", 14)}${t("settings.keyHide")}`;
      getSelection()?.selectAllChildren(value);
      copy.innerHTML = `${icon("copy", 14)}${t("settings.keyCopyManual")}`;
      return;
    }
    markExported();
    copy.innerHTML = `${icon("check", 14)}${t("settings.keyCopied")}`;
    // L'alerte « Copie ta clé » disparaît.
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
