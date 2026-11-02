import OBR, { type Item, type ToolEvent } from "@owlbear-rodeo/sdk";
import { syncNoteItems, toggleTitles } from "./notes-scene";
import {
  LIST_POPOVER_ID,
  NOTE_CHANNEL,
  NOTE_KEY,
  NOTE_MAX_HEIGHT,
  NOTE_POPOVER_ID,
  NOTE_TOOL_ID,
  NOTE_TYPES,
  NOTE_TYPE_IDS,
  NOTE_WIDTH,
  isMapNote,
  notePopoverPosition,
  type NoteMessage,
  type NoteType,
} from "./notes";

/** Note affichée et position du picto à l'ouverture, pour la suivre s'il bouge. */
let shown: { id: string; x: number; y: number } | undefined;
/** Une saisie en cours n'est jamais refermée par un clic sur la carte. */
let editing = false;

let queue = Promise.resolve();
function enqueue(action: () => Promise<void>) {
  queue = queue.then(action).catch((error) => {
    console.error(error);
    OBR.notification.show("Notes de carte : action impossible.", "ERROR");
  });
}

const noteOf = (item: Item | undefined) => {
  const note = item?.metadata[NOTE_KEY];
  return isMapNote(note) ? note : undefined;
};

async function openPopover(query: URLSearchParams, point: { x: number; y: number }) {
  const screen = await OBR.viewport.transformPoint(point);
  const [viewportWidth, viewportHeight] = await Promise.all([
    OBR.viewport.getWidth(),
    OBR.viewport.getHeight(),
  ]);
  const { left, top } = notePopoverPosition(screen, viewportWidth, viewportHeight);
  await OBR.popover.close(NOTE_POPOVER_ID);
  await OBR.popover.open({
    id: NOTE_POPOVER_ID,
    url: `/notes.html?${query}`,
    width: NOTE_WIDTH,
    height: NOTE_MAX_HEIGHT,
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

async function hideNote() {
  shown = undefined;
  editing = false;
  await OBR.popover.close(NOTE_POPOVER_ID);
}

async function syncSelection(selection: string[] | undefined) {
  if (editing) return;
  const [item] =
    selection?.length === 1 ? await OBR.scene.items.getItems(selection) : [];
  if (noteOf(item)) {
    if (shown?.id !== item.id) await showNote(item);
  } else if (shown) {
    await hideNote();
  }
}

async function syncItems(items: Item[]) {
  if (!shown) return;
  const current = items.find((item) => item.id === shown?.id);
  if (!noteOf(current)) {
    await hideNote();
  } else if (
    !editing &&
    (current!.position.x !== shown.x || current!.position.y !== shown.y)
  ) {
    await showNote(current!);
  }
}

function startNewNote(type: NoteType, event: ToolEvent) {
  enqueue(async () => {
    if (editing) {
      await OBR.notification.show("Termine d'abord la note en cours.", "WARNING");
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

async function openList() {
  await OBR.popover.close(LIST_POPOVER_ID);
  await OBR.popover.open({
    id: LIST_POPOVER_ID,
    url: "/notes-list.html",
    width: 320,
    height: Math.min(520, (await OBR.viewport.getHeight()) - 96),
    anchorReference: "POSITION",
    anchorPosition: { left: 72, top: 72 },
    anchorOrigin: { horizontal: "LEFT", vertical: "TOP" },
    transformOrigin: { horizontal: "LEFT", vertical: "TOP" },
    disableClickAway: true,
    marginThreshold: 8,
  });
}

function createTool() {
  const gmOnly = { roles: ["GM" as const] };
  const whenActive = { activeTools: [NOTE_TOOL_ID], roles: ["GM" as const] };
  OBR.tool.create({
    id: NOTE_TOOL_ID,
    icons: [{ icon: "/notes/outil.svg", label: "Notes de carte", filter: gmOnly }],
    disabled: { roles: ["PLAYER"] },
    defaultMode: `${NOTE_TOOL_ID}/piege`,
  });
  for (const type of NOTE_TYPE_IDS) {
    OBR.tool.createMode({
      id: `${NOTE_TOOL_ID}/${type}`,
      // Owlbear ne garde que la silhouette des icônes de la barre : pas de fond ni de couleur ici.
      icons: [{ icon: `/notes/mode-${type}.svg`, label: NOTE_TYPES[type], filter: whenActive }],
      cursors: [
        {
          cursor: "pointer",
          filter: { target: [{ key: ["metadata", NOTE_KEY], operator: "!=", value: undefined }] },
        },
        { cursor: "crosshair" },
      ],
      onToolClick(_context, event) {
        startNewNote(type, event);
        return false;
      },
    });
  }
  OBR.tool.createAction({
    id: `${NOTE_TOOL_ID}/liste`,
    icons: [{ icon: "/notes/liste.svg", label: "Liste des notes de la scène", filter: whenActive }],
    onClick() {
      enqueue(openList);
    },
  });
  OBR.tool.createAction({
    id: `${NOTE_TOOL_ID}/titres`,
    icons: [{ icon: "/notes/titres.svg", label: "Afficher ou masquer les titres", filter: whenActive }],
    onClick() {
      enqueue(toggleTitles);
    },
  });
}

export function setupNotes() {
  createTool();

  OBR.broadcast.onMessage(NOTE_CHANNEL, ({ data }) => {
    const message = data as NoteMessage;
    // Immédiat : la sélection qui suit doit déjà connaître l'état de la saisie.
    if (message.type === "editing") {
      editing = message.value;
      return;
    }
    enqueue(async () => {
      if ((await OBR.player.getRole()) !== "GM") return;
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
  });

  const onSceneReady = (ready: boolean) => {
    enqueue(async () => {
      if (ready) {
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
