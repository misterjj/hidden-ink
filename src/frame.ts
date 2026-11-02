import OBR, { buildShape, type Item, type Vector2 } from "@owlbear-rodeo/sdk";
import { FRAME_ID, clampWindow } from "./types";

/** Cadre dessiné sur la carte pendant un déplacement : il montre où la fenêtre va se poser. */
export interface Origin {
  left: number;
  top: number;
  width: number;
  height: number;
  minimized: boolean;
}

interface Drawn {
  item: Item;
  position: Vector2;
  scale: number;
  viewportWidth: number;
  viewportHeight: number;
}

/** Une mise à jour lente ou perdue ne doit ni bloquer ni interrompre le déplacement. */
const warn = (error: unknown) => console.warn("Cadre de déplacement :", error);

export function startFrame(origin: Origin) {
  let drawn: Drawn | undefined;
  let latest: { dx: number; dy: number } | undefined;

  const move = (dx: number, dy: number) => {
    latest = { dx, dy };
    if (!drawn) return;
    const placed = clampWindow(
      origin.left + dx,
      origin.top + dy,
      origin.width,
      origin.height,
      origin.minimized,
      drawn.viewportWidth,
      drawn.viewportHeight,
    );
    const position = {
      x: drawn.position.x + (placed.left - origin.left) / drawn.scale,
      y: drawn.position.y + (placed.top - origin.top) / drawn.scale,
    };
    const previous = drawn.item;
    drawn.item = { ...previous, position };
    OBR.scene.local
      .updateItems(
        [previous],
        (items) => {
          items[0].position = position;
        },
        true,
      )
      .catch(warn);
  };

  const ready = (async () => {
    await OBR.scene.local.deleteItems([FRAME_ID]).catch(warn);
    const [viewportWidth, viewportHeight, scale] = await Promise.all([
      OBR.viewport.getWidth(),
      OBR.viewport.getHeight(),
      OBR.viewport.getScale(),
    ]);
    const position = await OBR.viewport.inverseTransformPoint({
      x: origin.left,
      y: origin.top,
    });
    const item = buildShape()
      .id(FRAME_ID)
      .shapeType("RECTANGLE")
      .width(origin.width / scale)
      .height(origin.height / scale)
      .position(position)
      .fillColor("#922610")
      .fillOpacity(0.25)
      .strokeColor("#922610")
      .strokeOpacity(1)
      .strokeWidth(3 / scale)
      .layer("POPOVER")
      .locked(true)
      .disableHit(true)
      .build();
    await OBR.scene.local.addItems([item]);
    drawn = { item, position, scale, viewportWidth, viewportHeight };
    if (latest) move(latest.dx, latest.dy);
  })().catch(warn);

  return {
    move,
    /** Attend la fin de la création : un relâchement très rapide ne laisse rien derrière lui. */
    async remove() {
      await ready;
      drawn = undefined;
      await OBR.scene.local.deleteItems([FRAME_ID]).catch(warn);
    },
  };
}
