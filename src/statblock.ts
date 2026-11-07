import OBR from "@owlbear-rodeo/sdk";
import { normalizeFicheUrl } from "../shared/aidedd";
import { reveal } from "./crypto";
import { FicheError, loadFromAidedd, resolveFiche } from "./data";
import { currentLanguage, t } from "./i18n";
import { icon } from "./icons";
import { escapeHtml } from "./manual";
import { statblockHtml, statblockParts, windowHtml, type Part } from "./sheet";
import { startFrame } from "./frame";
import "./style.css";
import {
  CHANNEL,
  METADATA_KEY,
  TOKEN_NOTE_KEY,
  MINI_HEIGHT,
  MINI_PANEL_MAX,
  MINI_PANEL_RESERVE,
  MINI_WIDTH,
  windowPopoverId,
  type Message,
  type TokenFiche,
} from "./types";

const params = new URLSearchParams(location.search);
const itemId = params.get("item") ?? "";
const popoverId = windowPopoverId(itemId);
const app = document.querySelector<HTMLDivElement>("#app")!;
const MIN_WIDTH = 300;
const MIN_HEIGHT = 240;
/** Environ 30 mises à jour par seconde : fluide, sans inonder Owlbear. */
const SEND_INTERVAL_MS = 33;
/** Signal de vie pendant un déplacement, même si la souris ne bouge plus. */
const DRAG_HEARTBEAT_MS = 400;
/**
 * Plus aucun mouvement reçu pendant ce délai : la fenêtre a peut-être perdu la
 * souris sans en être prévenue, et elle ne saura jamais que le bouton a été relâché.
 */
const DRAG_IDLE_RELEASE_MS = 2500;

let fiche: TokenFiche | undefined;
let minimized = params.has("min");

const send = (message: Message) =>
  OBR.broadcast.sendMessage(CHANNEL, message, { destination: "LOCAL" });

const sheetElement = () => document.querySelector<HTMLElement>(".sheet");
/**
 * Position de lecture, mémorisée à part : le navigateur la perd quand le contenu
 * est masqué (fenêtre réduite) ou écrasé (fenêtre à 1 pixel pendant un déplacement).
 */
let savedScroll = Number(params.get("scroll")) || 0;
const rememberScroll = (sheet: HTMLElement) => {
  sheet.addEventListener("scroll", () => {
    if (!minimized && !document.body.classList.contains("dragging")) {
      savedScroll = sheet.scrollTop;
    }
  });
};

interface PointerHandlers {
  onMove: (dx: number, dy: number) => void;
  onEnd: (dx: number, dy: number) => void;
  onCancel: () => void;
}

interface TrackOptions {
  /** Pose la fenêtre si plus aucun mouvement n'arrive pendant ce délai. */
  idleReleaseMs?: number;
}

/**
 * Suit un glissement même hors de la fenêtre grâce à la capture du pointeur.
 * Les événements sont écoutés sur toute la page : si la capture se perd, un
 * mouvement revenant au-dessus de la fenêtre reste détecté.
 */
function trackPointer(
  handle: HTMLElement,
  handlers: PointerHandlers,
  options: TrackOptions = {},
) {
  /** Glissement resté ouvert parce que le relâchement n'a jamais été reçu. */
  let abandon: (() => void) | undefined;
  handle.addEventListener("pointerdown", (start) => {
    if ((start.target as HTMLElement).closest("button, a")) return;
    abandon?.();
    start.preventDefault();
    handle.setPointerCapture(start.pointerId);
    document.body.classList.add("dragging");
    let lastSent = 0;
    let lastEvent = performance.now();
    let done = false;
    let pending: ReturnType<typeof setTimeout> | undefined;
    let latest = { dx: 0, dy: 0 };
    const isOurs = (event: PointerEvent) => event.pointerId === start.pointerId;
    const delta = (event: PointerEvent) => ({
      dx: event.screenX - start.screenX,
      dy: event.screenY - start.screenY,
    });

    const flush = () => {
      pending = undefined;
      lastSent = performance.now();
      handlers.onMove(latest.dx, latest.dy);
    };
    const move = (event: PointerEvent) => {
      if (!isOurs(event)) return;
      lastEvent = performance.now();
      // Bouton déjà relâché : le navigateur n'a pas transmis le relâchement.
      // Sa position n'est pas fiable, on garde la dernière position suivie.
      if (event.buttons === 0) {
        release("bouton déjà relâché");
        return;
      }
      latest = delta(event);
      if (pending !== undefined) return;
      // Le dernier mouvement part toujours, même si la souris s'arrête juste après.
      const wait = SEND_INTERVAL_MS - (performance.now() - lastSent);
      if (wait <= 0) flush();
      else pending = setTimeout(flush, wait);
    };
    const finish = () => {
      done = true;
      abandon = undefined;
      clearTimeout(pending);
      clearInterval(watchdog);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", cancel, true);
      handle.removeEventListener("lostpointercapture", lost);
      document.body.classList.remove("dragging");
    };
    const release = (reason?: string) => {
      if (done) return;
      finish();
      if (reason) console.warn(`Glissement terminé sans relâchement reçu : ${reason}`);
      handlers.onEnd(latest.dx, latest.dy);
    };
    const up = (event: PointerEvent) => {
      if (!isOurs(event)) return;
      latest = delta(event);
      release();
    };
    const lost = () => release("capture perdue");
    const cancel = () => {
      if (done) return;
      finish();
      handlers.onCancel();
    };
    const watchdog = setInterval(() => {
      if (!handle.hasPointerCapture(start.pointerId)) {
        release("capture absente");
      } else if (
        options.idleReleaseMs &&
        performance.now() - lastEvent > options.idleReleaseMs
      ) {
        release("plus aucun mouvement reçu");
      }
    }, 200);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", cancel, true);
    handle.addEventListener("lostpointercapture", lost);
    abandon = cancel;
  });
}

function wireMove(handle: HTMLElement) {
  let startWidth = 0;
  let startHeight = 0;
  let dragId: string | undefined;
  let frame: ReturnType<typeof startFrame> | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stop = () => {
    clearInterval(heartbeat);
    const id = dragId;
    dragId = undefined;
    const current = frame;
    frame = undefined;
    void current?.remove();
    return id;
  };

  trackPointer(
    handle,
    {
      onMove(dx, dy) {
        if (!dragId) {
          if (Math.abs(dx) + Math.abs(dy) < 3) return;
          const id = (dragId = crypto.randomUUID());
          hidePart();
          startWidth = window.innerWidth;
          startHeight = window.innerHeight;
          // Un seul message au départ : le cadre est piloté directement par cette page.
          send({ type: "drag-start", itemId, dragId: id });
          heartbeat = setInterval(() => send({ type: "drag-alive", dragId: id }), DRAG_HEARTBEAT_MS);
          frame = startFrame({
            left: windowLeft,
            top: windowTop,
            width: minimized ? MINI_WIDTH : startWidth,
            height: minimized ? MINI_HEIGHT : startHeight,
            minimized,
          });
        }
        frame?.move(dx, dy);
      },
      onEnd(dx, dy) {
        const id = stop();
        if (!id) return;
        const message: Message = {
          type: "move",
          itemId,
          dragId: id,
          dx,
          dy,
          width: startWidth,
          height: startHeight,
          scroll: savedScroll,
        };
        // Sans ce message la fenêtre ne bouge pas : une nouvelle tentative vaut le coup.
        send(message).catch(() => send(message));
      },
      onCancel() {
        const id = stop();
        if (id) send({ type: "drag-cancel", itemId, dragId: id });
      },
    },
    { idleReleaseMs: DRAG_IDLE_RELEASE_MS },
  );
}

/** Détail d'une partie sous les pictos : l'infobulle ne peut pas sortir de la fenêtre, qui s'agrandit donc. */
let hideTimer: ReturnType<typeof setTimeout> | undefined;
let viewportHeight = 0;
const windowLeft = Number(params.get("left")) || 0;
const windowTop = Number(params.get("top")) || 0;

function hidePart() {
  clearTimeout(hideTimer);
  const panel = document.querySelector<HTMLElement>("#mini-panel");
  if (!panel || panel.hidden) return;
  panel.hidden = true;
  panel.innerHTML = "";
  document
    .querySelectorAll("#mini-tools button.active")
    .forEach((button) => button.classList.remove("active"));
  if (minimized) OBR.popover.setHeight(popoverId, MINI_HEIGHT);
}

function showPart(part: Part, button: HTMLElement) {
  clearTimeout(hideTimer);
  const panel = document.querySelector<HTMLElement>("#mini-panel")!;
  document
    .querySelectorAll("#mini-tools button.active")
    .forEach((other) => other.classList.remove("active"));
  button.classList.add("active");
  panel.innerHTML = `<h2>${escapeHtml(part.label)}</h2>${part.html}`;
  panel.hidden = false;
  panel.scrollTop = 0;
  const available = Math.max(
    MINI_PANEL_RESERVE,
    Math.min(MINI_PANEL_MAX, viewportHeight - windowTop - MINI_HEIGHT - 8),
  );
  // Mesure hors du cadre actuel : la fenêtre doit aussi rétrécir pour une partie courte.
  panel.style.flex = "none";
  const wanted = panel.offsetHeight;
  panel.style.flex = "";
  OBR.popover.setHeight(popoverId, MINI_HEIGHT + Math.min(wanted, available));
}

function renderTools(parts: Part[]) {
  const tools = document.querySelector<HTMLElement>("#mini-tools")!;
  if (!parts.length) {
    tools.innerHTML = `<span class="hint">${t("window.unavailable")}</span>`;
    return;
  }
  tools.innerHTML = parts
    .map(
      (part, index) =>
        `<button type="button" class="part" data-part="${index}" aria-label="${escapeHtml(part.label)}">${part.icon}</button>`,
    )
    .join("");
  tools.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const part = parts[Number(button.dataset.part)];
    button.addEventListener("pointerenter", () => showPart(part, button));
    button.addEventListener("focus", () => showPart(part, button));
    button.addEventListener("click", () => showPart(part, button));
  });
}

function wireMiniHover() {
  // Le détail reste ouvert quand la souris y entre, pour pouvoir le faire défiler.
  document.querySelector<HTMLElement>(".window")!.addEventListener("pointerleave", () => {
    if (document.body.classList.contains("dragging")) return;
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePart, 200);
  });
  document.querySelector<HTMLElement>(".window")!.addEventListener("pointerenter", () => {
    clearTimeout(hideTimer);
  });
}

function wireResize(handle: HTMLElement) {
  let startWidth = 0;
  let startHeight = 0;
  const size = (dx: number, dy: number) => ({
    width: Math.max(MIN_WIDTH, startWidth + dx),
    height: Math.max(MIN_HEIGHT, startHeight + dy),
  });
  const apply = (dx: number, dy: number) => {
    const { width, height } = size(dx, dy);
    OBR.popover.setWidth(popoverId, width);
    OBR.popover.setHeight(popoverId, height);
  };
  handle.addEventListener("pointerdown", () => {
    startWidth = window.innerWidth;
    startHeight = window.innerHeight;
  });
  trackPointer(handle, {
    onMove: apply,
    onEnd(dx, dy) {
      apply(dx, dy);
      send({ type: "resized", itemId, ...size(dx, dy) });
    },
    onCancel() {
      apply(0, 0);
    },
  });
}

function setMinimized(value: boolean) {
  minimized = value;
  document.body.classList.toggle("minimized", value);
  const button = document.querySelector<HTMLButtonElement>("#minimize");
  if (button) {
    button.innerHTML = icon(value ? "restore" : "minimize");
    button.title = value ? t("window.restore") : t("window.minimize");
  }
}

function wireControls() {
  document.querySelector<HTMLButtonElement>("#close")!.onclick = () =>
    send({ type: "close", itemId });
  document.querySelector<HTMLButtonElement>("#edit")!.onclick = () =>
    send({ type: "edit", itemId, tab: fiche?.kind ?? "choice" });
  document.querySelector<HTMLButtonElement>("#note")!.onclick = () =>
    send({ type: "token-note", itemId });
  document.querySelector<HTMLButtonElement>("#minimize")!.onclick = () => {
    const next = !minimized;
    hidePart();
    setMinimized(next);
    send({ type: "minimize", itemId, minimized: next, scroll: savedScroll });
    if (!next) sheetElement()!.scrollTop = savedScroll;
  };
  wireMove(document.querySelector<HTMLElement>("#drag")!);
  wireResize(document.querySelector<HTMLElement>("#resize")!);
}

function errorHtml(message: string) {
  return `
    <div class="unavailable">
      <p class="error">${escapeHtml(message)}</p>
      <p>${t("window.retry")}</p>
      <button type="button" class="btn primary" id="fill-manual">${icon("pen", 14)}${t("window.fillManual")}</button>
    </div>`;
}

OBR.onReady(async () => {
  // Double sécurité : la fenêtre ne doit jamais s'afficher chez un joueur.
  if ((await OBR.player.getRole()) !== "GM") {
    await OBR.popover.close(popoverId);
    return;
  }
  document.documentElement.lang = currentLanguage();
  const [item] = await OBR.scene.items.getItems([itemId]);
  if (!item?.metadata[METADATA_KEY]) {
    await send({ type: "close", itemId });
    return;
  }
  let locked = false;
  try {
    fiche = await reveal<TokenFiche>(item.metadata[METADATA_KEY]);
  } catch {
    locked = true;
  }
  viewportHeight = await OBR.viewport.getHeight();

  const sourceUrl = fiche?.kind === "link" ? normalizeFicheUrl(fiche.url) ?? undefined : undefined;
  app.innerHTML = windowHtml(
    `<p class="loading"><span class="spinner"></span>${t("common.loading")}</p>`,
    item.name,
    sourceUrl,
    Boolean(item.metadata[TOKEN_NOTE_KEY]),
  );
  setMinimized(minimized);
  wireControls();
  wireMiniHover();

  const sheet = sheetElement()!;
  rememberScroll(sheet);
  if (locked || !fiche) {
    renderTools([]);
    sheet.innerHTML = `<div class="unavailable"><p class="error">${icon("lock", 14)}${escapeHtml(t("crypto.lockedFiche"))}</p></div>`;
    return;
  }
  try {
    const statblock = await resolveFiche(fiche);
    sheet.innerHTML = statblockHtml(statblock);
    renderTools(statblockParts(statblock));
    document.querySelector<HTMLElement>(".title")!.textContent = statblock.name;
    sheet.scrollTop = savedScroll;
  } catch (error) {
    renderTools([]);
    sheet.innerHTML = errorHtml(
      error instanceof FicheError ? error.message : t("window.error"),
    );
    document.querySelector<HTMLButtonElement>("#fill-manual")!.onclick = () =>
      send({ type: "edit", itemId, tab: "manual" });
  }
});

// Aperçu hors d'Owlbear, en développement uniquement : /statblock.html?preview=<lien>
if (import.meta.env.DEV && !OBR.isAvailable) {
  app.innerHTML = windowHtml(`<p class="hint">${t("common.loading")}</p>`, "Preview");
  const sheet = sheetElement()!;
  loadFromAidedd(params.get("preview") ?? "")
    .then((statblock) => (sheet.innerHTML = statblockHtml(statblock)))
    .catch((error) => (sheet.innerHTML = errorHtml(error.message)));
}
