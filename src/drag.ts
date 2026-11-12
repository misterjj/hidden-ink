// Glissement d'une fenêtre par sa barre de titre, partagé par les fiches, la liste des notes et les réglages.

/** Environ 30 mises à jour par seconde : fluide, sans inonder Owlbear. */
const SEND_INTERVAL_MS = 33;

export interface PointerHandlers {
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
export function trackPointer(
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
