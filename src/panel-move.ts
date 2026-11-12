// La liste des notes et les réglages se déplacent par leur barre de titre, comme les fiches.

import OBR from "@owlbear-rodeo/sdk";
import { trackPointer } from "./drag";
import { startFrame } from "./frame";
import { NOTE_CHANNEL, panelPosition, type NoteMessage, type PanelKind } from "./notes";

/**
 * Pendant le glissement, un cadre montre sur la carte où la fenêtre va se poser ; au relâchement,
 * la page de fond la rouvre à cet endroit. `query` garde ce qui doit survivre à la réouverture.
 */
export function wirePanelMove(handle: HTMLElement, panel: PanelKind, query: () => string = () => "") {
  let frame: ReturnType<typeof startFrame> | undefined;
  const stop = async () => {
    const current = frame;
    frame = undefined;
    await current?.remove();
    return !!current;
  };
  trackPointer(handle, {
    onMove(dx, dy) {
      if (!frame) {
        if (Math.abs(dx) + Math.abs(dy) < 3) return;
        const { left, top } = panelPosition(panel);
        frame = startFrame({ left, top, width: window.innerWidth, height: window.innerHeight, minimized: false });
      }
      frame.move(dx, dy);
    },
    async onEnd(dx, dy) {
      // Le cadre part avant la réouverture : la nouvelle page ne saurait pas l'enlever.
      if (!(await stop())) return;
      const message: NoteMessage = { type: "move-panel", panel, dx, dy, query: query() };
      OBR.broadcast.sendMessage(NOTE_CHANNEL, message, { destination: "LOCAL" });
    },
    onCancel() {
      void stop();
    },
  });
}
