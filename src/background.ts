import OBR, { type ContextMenuContext } from "@owlbear-rodeo/sdk";
import { setupNotes } from "./notes-background";
import {
  CHANNEL,
  EDITOR_POPOVER_ID,
  METADATA_KEY,
  MINI_HEIGHT,
  MINI_WIDTH,
  PLUGIN_ID,
  FRAME_ID,
  clampWindow,
  windowPopoverId,
  type Message,
} from "./types";

const WIDTH = 430;
const HEIGHT = 660;
const CASCADE = 28;
const POSITION_KEY = "fenetre:position";

interface Geometry {
  left: number;
  top: number;
  /** Taille en grand, conservée quand la fenêtre est réduite. */
  width: number;
  height: number;
  minimized?: boolean;
  scroll?: number;
}

const openWindows = new Map<string, Geometry>();

const displayedSize = (geometry: Geometry) =>
  geometry.minimized
    ? { width: MINI_WIDTH, height: MINI_HEIGHT }
    : { width: geometry.width, height: geometry.height };

function clampTo(
  geometry: Geometry,
  viewportWidth: number,
  viewportHeight: number,
): Geometry {
  const height = Math.min(geometry.height, viewportHeight - 16);
  const size = displayedSize({ ...geometry, height });
  return {
    ...geometry,
    height,
    ...clampWindow(
      geometry.left,
      geometry.top,
      size.width,
      size.height,
      Boolean(geometry.minimized),
      viewportWidth,
      viewportHeight,
    ),
  };
}

async function clamp(geometry: Geometry): Promise<Geometry> {
  const [viewportWidth, viewportHeight] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);
  return clampTo(geometry, viewportWidth, viewportHeight);
}

async function defaultGeometry(): Promise<Geometry> {
  const offset = openWindows.size * CASCADE;
  try {
    const saved = localStorage.getItem(POSITION_KEY);
    if (saved) {
      const { left, top } = JSON.parse(saved);
      return { left: left + offset, top: top + offset, width: WIDTH, height: HEIGHT };
    }
  } catch {
    // Position illisible : on retombe sur la position par défaut.
  }
  const viewportWidth = await OBR.viewport.getWidth();
  return {
    left: viewportWidth - WIDTH - 24 - offset,
    top: 72 + offset,
    width: WIDTH,
    height: HEIGHT,
  };
}

async function showWindow(itemId: string, geometry: Geometry) {
  const id = windowPopoverId(itemId);
  const placed = await clamp(geometry);
  openWindows.set(itemId, placed);
  // Owlbear ne sait pas déplacer une fenêtre ouverte : on la rouvre ailleurs.
  await OBR.popover.close(id);
  const query = new URLSearchParams({ item: itemId });
  if (placed.minimized) query.set("min", "1");
  if (placed.scroll) query.set("scroll", String(placed.scroll));
  query.set("left", String(placed.left));
  query.set("top", String(placed.top));
  await OBR.popover.open({
    id,
    url: `/statblock.html?${query}`,
    ...displayedSize(placed),
    anchorReference: "POSITION",
    anchorPosition: { left: placed.left, top: placed.top },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    disableClickAway: true,
    marginThreshold: 8,
  });
}

/** Sans nouvelle de la fenêtre pendant ce délai, son déplacement est abandonné. */
const DRAG_TIMEOUT_MS = 2000;

let activeDragId: string | undefined;
let lastDragSignal = 0;

/** Ne lève jamais d'erreur : un échec ici ne doit pas bloquer les actions suivantes. */
async function removeFrame() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      await OBR.scene.local.deleteItems([FRAME_ID]);
      return;
    } catch (error) {
      console.warn("Suppression du cadre impossible", error);
    }
  }
}

async function openEditor(itemId: string, tab?: "link" | "manual") {
  await OBR.popover.close(EDITOR_POPOVER_ID);
  await OBR.popover.open({
    id: EDITOR_POPOVER_ID,
    url: `/editor.html?item=${encodeURIComponent(itemId)}${tab ? `&tab=${tab}` : ""}`,
    width: 480,
    height: 270,
    anchorReference: "POSITION",
    anchorPosition: {
      left: (await OBR.viewport.getWidth()) / 2,
      top: (await OBR.viewport.getHeight()) / 2,
    },
    anchorOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    transformOrigin: { horizontal: "CENTER", vertical: "CENTER" },
    // Un clic à côté ne doit pas faire perdre une saisie en cours.
    disableClickAway: true,
  });
}

/** Une action à la fois : un clic rapide ne peut plus doubler l'action précédente. */
let queue = Promise.resolve();
function enqueue(message: Message) {
  queue = queue.then(() => handleMessage(message)).catch((error) => {
    console.error(error);
    OBR.notification.show("Fiches de monstres : action impossible.", "ERROR");
  });
}

async function handleMessage(message: Message) {
  if ((await OBR.player.getRole()) !== "GM") return;
  switch (message.type) {
    case "open": {
      const current = openWindows.get(message.itemId);
      await showWindow(
        message.itemId,
        current ? { ...current, minimized: false } : await defaultGeometry(),
      );
      break;
    }
    case "edit":
      await openEditor(message.itemId, message.tab);
      break;
    case "close":
      openWindows.delete(message.itemId);
      await OBR.popover.close(windowPopoverId(message.itemId));
      break;
    case "drag-cancel":
      await removeFrame();
      break;
    case "move": {
      // Le cadre part d'abord : si la réouverture échoue, il ne reste pas à l'écran.
      const removed = removeFrame();
      const current = openWindows.get(message.itemId) ?? (await defaultGeometry());
      await showWindow(message.itemId, {
        ...current,
        left: current.left + message.dx,
        top: current.top + message.dy,
        // Une fenêtre réduite garde sa taille en grand pour plus tard.
        width: current.minimized ? current.width : message.width,
        height: current.minimized ? current.height : message.height,
        scroll: message.scroll,
      });
      await removed;
      const placed = openWindows.get(message.itemId);
      if (placed) {
        localStorage.setItem(
          POSITION_KEY,
          JSON.stringify({ left: placed.left, top: placed.top }),
        );
      }
      break;
    }
    case "resized": {
      const current = openWindows.get(message.itemId);
      if (current) {
        openWindows.set(message.itemId, {
          ...current,
          width: message.width,
          height: message.height,
        });
      }
      break;
    }
    case "minimize": {
      const current = openWindows.get(message.itemId) ?? (await defaultGeometry());
      const next = await clamp({
        ...current,
        minimized: message.minimized,
        scroll: message.scroll,
      });
      if (next.left !== current.left || next.top !== current.top) {
        // La fenêtre dépasserait de l'écran : il faut la rouvrir un peu plus loin.
        await showWindow(message.itemId, next);
      } else {
        openWindows.set(message.itemId, next);
        const id = windowPopoverId(message.itemId);
        const size = displayedSize(next);
        await OBR.popover.setWidth(id, size.width);
        await OBR.popover.setHeight(id, size.height);
      }
      break;
    }
  }
}

OBR.onReady(() => {
  setupNotes();

  OBR.broadcast.onMessage(CHANNEL, ({ data }) => {
    const message = data as Message;
    // Traité dès la réception : la file peut être occupée par l'action précédente.
    if (message.type === "drag-start" || message.type === "drag-alive") {
      activeDragId = message.dragId;
      lastDragSignal = Date.now();
    } else {
      if (
        (message.type === "move" || message.type === "drag-cancel") &&
        activeDragId === message.dragId
      ) {
        activeDragId = undefined;
      }
      enqueue(message);
    }
  });

  // Fenêtre disparue en plein déplacement : le cadre ne reste pas à l'écran.
  setInterval(() => {
    if (activeDragId && Date.now() - lastDragSignal > DRAG_TIMEOUT_MS) {
      const dragId = activeDragId;
      activeDragId = undefined;
      enqueue({ type: "drag-cancel", itemId: "", dragId });
    }
  }, 500);

  // Cadre laissé par une version précédente de cette page.
  OBR.scene
    .isReady()
    .then((ready) => (ready ? removeFrame() : undefined))
    .catch(() => {});

  // Le filtre « roles » masque totalement ces entrées aux joueurs.
  const base = {
    roles: ["GM" as const],
    min: 1,
    max: 1,
  };
  const isToken = [
    { key: "type", value: "IMAGE" },
    { key: "layer", value: "CHARACTER", coordinator: "||" as const },
    { key: "layer", value: "MOUNT" },
  ];

  OBR.contextMenu.create({
    id: `${PLUGIN_ID}/menu`,
    icons: [
      {
        icon: "/icon.svg",
        label: "Ajouter une fiche de monstre",
        filter: {
          ...base,
          every: [...isToken, { key: ["metadata", METADATA_KEY], value: undefined }],
        },
      },
      {
        icon: "/icon.svg",
        label: "Voir la fiche de monstre",
        filter: { ...base, every: isToken },
      },
    ],
    onClick(context: ContextMenuContext) {
      const item = context.items[0];
      const message: Message = item.metadata[METADATA_KEY]
        ? { type: "open", itemId: item.id }
        : { type: "edit", itemId: item.id };
      enqueue(message);
    },
  });
});
