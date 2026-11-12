import OBR, { type Item, type ToolEvent } from "@owlbear-rodeo/sdk";
import { t } from "./i18n";
import { KEY_STORAGE } from "./crypto";
import { forgetDrawn, syncNoteItems, toggleTitles } from "./notes-scene";
import { TOKEN_NOTE_KEY, clampPosition } from "./types";
import {
  LIST_POPOVER_ID,
  NOTE_CHANNEL,
  NOTE_KEY,
  NOTE_MAX_HEIGHT,
  NOTE_POPOVER_ID,
  NOTE_TOOL_ID,
  lastNoteType,
  NOTE_WIDTH,
  SETTINGS_POPOVER_ID,
  isNoteItem,
  notePopoverPosition,
  panelPosition,
  savePanelPosition,
  type NoteMessage,
  type NoteType,
  type PanelKind,
} from "./notes";

/** Note affichée et position de son objet à l'ouverture, pour la suivre s'il bouge. */
let shown: { id: string; x: number; y: number; token?: boolean } | undefined;
/** Une saisie en cours n'est jamais refermée par un clic sur la carte. */
let editing = false;

let queue = Promise.resolve();
function enqueue(action: () => Promise<void>) {
  queue = queue.then(action).catch((error) => {
    console.error(error);
    OBR.notification.show(t("error.action"), "ERROR");
  });
}

const noteOf = (item: Item | undefined) => (item && isNoteItem(item) ? item : undefined);

/** Note ouverte et sa place à l'écran : la rouvrir à l'identique ne ferait que la faire clignoter. */
let placed: { query: string; left: number; top: number } | undefined;
/**
 * Dernière hauteur mesurée de chaque note lue. Ouverte à pleine hauteur puis réduite, la fenêtre
 * clignotait : une note déjà vue s'ouvre directement à sa taille. Rien n'est gardé hors de cette session.
 */
const noteHeights = new Map<string, number>();

async function openPopover(query: URLSearchParams, point: { x: number; y: number }) {
  const screen = await OBR.viewport.transformPoint(point);
  const [viewportWidth, viewportHeight] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);
  const { left, top } = notePopoverPosition(screen, viewportWidth, viewportHeight);
  const next = { query: query.toString(), left, top };
  if (placed && placed.query === next.query && Math.abs(placed.left - left) < 1 && Math.abs(placed.top - top) < 1) return;
  placed = next;
  await OBR.popover.close(NOTE_POPOVER_ID);
  await OBR.popover.open({
    id: NOTE_POPOVER_ID,
    url: `/notes.html?${query}`,
    width: NOTE_WIDTH,
    height: noteHeights.get(next.query) ?? NOTE_MAX_HEIGHT,
    anchorReference: "POSITION",
    anchorPosition: { left, top },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    // La carte reste utilisable : cliquer ailleurs passe par la sélection.
    disableClickAway: true,
    marginThreshold: 8,
  });
}

async function showNote(item: Item) {
  shown = { id: item.id, ...item.position };
  await openPopover(new URLSearchParams({ item: item.id }), item.position);
}

/** Note secrète d'un token, ouverte à côté de lui. */
export async function showTokenNote(itemId: string) {
  const [item] = await OBR.scene.items.getItems([itemId]);
  if (!item) return;
  shown = { id: item.id, ...item.position, token: true };
  // Une nouvelle note s'ouvre directement en saisie.
  editing = item.metadata[TOKEN_NOTE_KEY] === undefined;
  await openPopover(new URLSearchParams({ token: item.id }), item.position);
}

async function hideNote() {
  shown = undefined;
  placed = undefined;
  editing = false;
  await OBR.popover.close(NOTE_POPOVER_ID);
}

async function syncSelection(selection: string[] | undefined) {
  if (editing) return;
  const [item] =
    selection?.length === 1 ? await OBR.scene.items.getItems(selection) : [];
  if (noteOf(item)) {
    if (shown?.id !== item.id) await showNote(item);
  } else if (shown && !shown.token) {
    // La note d'un token s'ouvre en le désélectionnant : elle ne se ferme que par son bouton.
    await hideNote();
  }
}

async function syncItems(items: Item[]) {
  if (!shown) return;
  const current = items.find((item) => item.id === shown?.id);
  const stillThere = shown.token ? current !== undefined : noteOf(current) !== undefined;
  if (!stillThere) {
    await hideNote();
  } else if (!editing && (current!.position.x !== shown.x || current!.position.y !== shown.y)) {
    if (shown.token) await showTokenNote(current!.id);
    else await showNote(current!);
  }
}

function startNewNote(type: NoteType, event: ToolEvent) {
  enqueue(async () => {
    if (editing) {
      await OBR.notification.show(t("notes.finishFirst"), "WARNING");
      return;
    }
    const target = event.target;
    if (noteOf(target)) {
      await showNote(target!);
      return;
    }
    shown = undefined;
    // Le mode reste actif : la note suivante se pose d'un simple clic.
    editing = true;
    const { x, y } = event.pointerPosition;
    await openPopover(
      new URLSearchParams({ new: type, x: String(x), y: String(y) }),
      event.pointerPosition,
    );
  });
}

const PANELS: Record<PanelKind, { id: string; url: string; width: number; maxHeight: number }> = {
  list: { id: LIST_POPOVER_ID, url: "/notes-list.html", width: 320, maxHeight: 520 },
  settings: { id: SETTINGS_POPOVER_ID, url: "/settings.html", width: 400, maxHeight: 560 },
};

/**
 * Ouvre la liste ou les réglages à leur dernière place, ou à `position`.
 * Owlbear ne sait pas déplacer une fenêtre ouverte : un déplacement la rouvre ailleurs.
 */
async function openPanel(panel: PanelKind, query = "", position = panelPosition(panel)) {
  const { id, url, width, maxHeight } = PANELS[panel];
  const [viewportWidth, viewportHeight] = await Promise.all([OBR.viewport.getWidth(), OBR.viewport.getHeight()]);
  const height = Math.min(maxHeight, viewportHeight - 96);
  const placed = clampPosition(position.left, position.top, width, height, viewportWidth, viewportHeight);
  savePanelPosition(panel, placed);
  await OBR.popover.close(id);
  await OBR.popover.open({
    id,
    url: query ? `${url}?${query}` : url,
    width,
    height,
    anchorReference: "POSITION",
    anchorPosition: placed,
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    disableClickAway: true,
    marginThreshold: 8,
  });
}

const openList = () => openPanel("list");

export const openSettings = () => openPanel("settings");

function createTool() {
  const gmOnly = { roles: ["GM" as const] };
  const whenActive = { activeTools: [NOTE_TOOL_ID], roles: ["GM" as const] };
  OBR.tool.create({
    id: NOTE_TOOL_ID,
    icons: [{ icon: "/notes/outil.svg", label: t("notes.tool"), filter: gmOnly }],
    disabled: { roles: ["PLAYER"] },
    defaultMode: `${NOTE_TOOL_ID}/poser`,
  });
  // Un seul mode : le type se choisit dans la note, qui reprend le dernier type utilisé.
  OBR.tool.createMode({
    id: `${NOTE_TOOL_ID}/poser`,
    icons: [{ icon: "/notes/outil.svg", label: t("notes.place"), filter: whenActive }],
    cursors: [
      {
        cursor: "pointer",
        filter: { target: [{ key: ["metadata", NOTE_KEY], operator: "!=", value: undefined }] },
      },
      { cursor: "crosshair" },
    ],
    onToolClick(_context, event) {
      startNewNote(lastNoteType(), event);
      return false;
    },
  });
  OBR.tool.createAction({
    id: `${NOTE_TOOL_ID}/liste`,
    icons: [{ icon: "/notes/liste.svg", label: t("notes.list"), filter: whenActive }],
    onClick() {
      enqueue(openList);
    },
  });
  OBR.tool.createAction({
    id: `${NOTE_TOOL_ID}/titres`,
    icons: [{ icon: "/notes/titres.svg", label: t("notes.titles"), filter: whenActive }],
    onClick() {
      enqueue(toggleTitles);
    },
  });
  OBR.tool.createAction({
    id: `${NOTE_TOOL_ID}/reglages`,
    icons: [{ icon: "/notes/reglages.svg", label: t("notes.settings"), filter: whenActive }],
    onClick() {
      enqueue(openSettings);
    },
  });
}

export function setupNotes() {
  createTool();

  OBR.broadcast.onMessage(NOTE_CHANNEL, ({ data }) => {
    const message = data as NoteMessage;
    // Immédiat : la sélection qui suit doit déjà connaître l'état de la saisie.
    if (message.type === "height") {
      noteHeights.set(message.query, Math.min(NOTE_MAX_HEIGHT, Math.max(80, message.height)));
      return;
    }
    if (message.type === "editing") {
      editing = message.value;
      return;
    }
    enqueue(async () => {
      if ((await OBR.player.getRole()) !== "GM") return;
      if (message.type === "settings") {
        await openSettings();
        return;
      }
      if (message.type === "move-panel") {
        const from = panelPosition(message.panel);
        await openPanel(message.panel, message.query, { left: from.left + message.dx, top: from.top + message.dy });
        return;
      }
      if (message.type === "hide") {
        await hideNote();
        // Sinon, recliquer sur le même picto ne rouvrirait pas la note.
        await OBR.player.deselect();
        return;
      }
      const [item] = await OBR.scene.items.getItems([message.itemId]);
      if (noteOf(item)) await showNote(item);
    });
  });

  let lastSelection = "";
  OBR.player.onChange((player) => {
    const key = (player.selection ?? []).join();
    if (key === lastSelection || player.role !== "GM") return;
    lastSelection = key;
    enqueue(() => syncSelection(player.selection));
  });

  const whenGm = async (action: () => Promise<void>) => {
    if ((await OBR.player.getRole()) === "GM") await action();
  };

  OBR.scene.items.onChange((items) => {
    enqueue(() => whenGm(() => syncItems(items)));
    // Titres, badges et chiffrement suivent les changements, sans bloquer la file.
    void syncNoteItems();
  });
  // Clé importée dans les réglages : les notes deviennent lisibles, les titres reviennent.
  window.addEventListener("storage", (event) => {
    if (event.key === KEY_STORAGE) void syncNoteItems();
  });

  const onSceneReady = (ready: boolean) => {
    enqueue(async () => {
      if (ready) {
        forgetDrawn();
        await whenGm(syncNoteItems);
      } else {
        await hideNote();
        await OBR.popover.close(LIST_POPOVER_ID);
      }
    });
  };
  OBR.scene.onReadyChange(onSceneReady);
  OBR.scene.isReady().then((ready) => {
    if (ready) onSceneReady(true);
  });
}
