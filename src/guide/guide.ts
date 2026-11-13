// Page guide de Hidden Ink : encre qui se diffuse, loupe du MJ, chiffrement en direct, fiches et liens.
import "@fontsource-variable/fraunces";
import "@fontsource-variable/inter";
// En premier : les fenêtres de l'extension prennent la langue de la page.
import "./windows";
import { cipherWindow, keyDemo, notesDemo, sheetDemo, tokenDemo } from "./demos";

/** Liens à renseigner. Vide : le bouton reste visible et signale qu'il arrive bientôt. */
const LINKS: Record<string, string> = {
  store: "",
  patreon: "https://www.patreon.com/misterjj_obr",
};

/** La page est en anglais, ou en français sous /fr/. */
const lang = document.documentElement.lang === "fr" ? "fr" : "en";
const TEXT = {
  en: {
    soon: "Coming soon", copy: "Click to copy", copied: "Copied ✓", copyFailed: "Copy failed: select the address",
    decrypt: "Read it with the GM's key", encrypt: "Seal it again",
    locked: "Without the key: nothing to read.", opened: "Decrypted in this page, with its key.",
    noCrypto: "Your browser can't encrypt on this page (it needs HTTPS).",
  },
  fr: {
    soon: "Bientôt disponible", copy: "Cliquer pour copier", copied: "Copié ✓", copyFailed: "Échec : sélectionne l'adresse",
    decrypt: "La lire avec la clé du MJ", encrypt: "La sceller à nouveau",
    locked: "Sans la clé : rien à lire.", opened: "Déchiffrée dans cette page, avec sa clé.",
    noCrypto: "Ton navigateur ne peut pas chiffrer sur cette page (il faut HTTPS).",
  },
}[lang];

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// --- Encre qui se diffuse dans l'eau, derrière l'ouverture (WebGL) ------------------

const hero = document.querySelector<HTMLElement>(".hero")!;
const inkCanvas = document.getElementById("ink") as HTMLCanvasElement;
let heroVisible = true;
new IntersectionObserver(([e]) => (heroVisible = e.isIntersecting)).observe(hero);

/** Dernière goutte tombée : position (0 à 1) et instant, lus par le shader. */
let drop = { x: 0.78, y: 0.35, t: -100 };

const FRAG = `
precision mediump float;
uniform vec2 res; uniform float time; uniform vec3 drop;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { v += a * noise(p); p = p * 2.03 + 4.1; a *= 0.5; } return v; }
void main() {
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (gl_FragCoord.xy - 0.5 * res) / res.y;
  float t = time * 0.025;
  // Volutes d'encre : un bruit déformé par lui-même, qui tourne lentement.
  vec2 q = vec2(fbm(p * 1.4 + vec2(t, -t)), fbm(p * 1.4 + vec2(5.2 - t * 0.7, 1.3)));
  vec2 r = vec2(fbm(p * 1.6 + q * 3.0 + vec2(1.7, 9.2) + t), fbm(p * 1.6 + q * 3.0 + vec2(8.3, 2.8) - t));
  float n = fbm(p * 1.8 + r * 2.4);
  vec3 col = vec3(0.035, 0.028, 0.04);
  // Filaments d'encre rouge le long des crêtes du bruit.
  float vein = smoothstep(0.56, 0.62, n) * smoothstep(0.7, 0.63, n);
  float body = smoothstep(0.62, 0.9, n);
  col += vec3(0.36, 0.07, 0.04) * (vein * 0.55 + body * 0.18);
  col += vec3(0.1, 0.07, 0.06) * smoothstep(0.7, 1.0, length(r)) * 0.3;
  // La goutte : un anneau qui s'élargit et s'efface.
  float age = time - drop.z;
  vec2 d = (uv - drop.xy) * vec2(res.x / res.y, 1.0);
  float ring = exp(-pow((length(d) - age * 0.22) * 18.0, 2.0)) * exp(-age * 1.1);
  float stain = exp(-length(d) * 9.0) * exp(-age * 0.5) * smoothstep(0.0, 0.2, age);
  col += vec3(0.55, 0.14, 0.08) * (ring * 0.7 + stain * 0.6) * (0.6 + n);
  col *= 1.0 - 0.45 * length(uv - vec2(0.5, 0.55));
  gl_FragColor = vec4(col, 1.0);
}`;

let inkTime = 0;
function startInk() {
  const gl = inkCanvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return;
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, shader(gl.VERTEX_SHADER, "attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }"));
  gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  const [uRes, uTime, uDrop] = ["res", "time", "drop"].map((n) => gl.getUniformLocation(prog, n));
  const start = performance.now();

  const frame = () => {
    // Calculé à mi-résolution : l'encre est floue par nature.
    const w = Math.round(inkCanvas.clientWidth * 0.5), h = Math.round(inkCanvas.clientHeight * 0.5);
    if (inkCanvas.width !== w || inkCanvas.height !== h) { inkCanvas.width = w; inkCanvas.height = h; gl.viewport(0, 0, w, h); }
    inkTime = (performance.now() - start) / 1000;
    gl.uniform2f(uRes, w, h);
    gl.uniform1f(uTime, inkTime);
    gl.uniform3f(uDrop, drop.x, drop.y, drop.t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const loop = () => {
    if (heroVisible && !document.hidden) frame();
    requestAnimationFrame(loop);
  };
  if (reducedMotion) frame();
  else loop();
}
startInk();

// Une goutte d'encre là où l'on clique dans l'ouverture.
hero.addEventListener("click", (e) => {
  if (reducedMotion || (e.target as HTMLElement).closest("a, button, figure")) return;
  const r = hero.getBoundingClientRect();
  drop = { x: (e.clientX - r.left) / r.width, y: 1 - (e.clientY - r.top) / r.height, t: inkTime };
});
if (!reducedMotion) setTimeout(() => (drop = { x: 0.8, y: 0.62, t: inkTime }), 900);

// --- Loupe du MJ ---------------------------------------------------------------

const lens = document.querySelector<HTMLElement>("figure.lens")!;
const lensStage = lens.querySelector<HTMLElement>(".lens-stage")!;
const viewButtons = lens.querySelectorAll<HTMLButtonElement>("[data-view]");
let lensPos = { x: 40, y: 45 };
/** La souris ou le doigt guide la loupe ; sinon elle se promène seule sur la carte. */
let lastPointer = -Infinity;

const placeLens = (x: number, y: number) => {
  lensPos = { x: Math.min(100, Math.max(0, x)), y: Math.min(100, Math.max(0, y)) };
  lens.style.setProperty("--x", `${lensPos.x}%`);
  lens.style.setProperty("--y", `${lensPos.y}%`);
};
placeLens(lensPos.x, lensPos.y);

const setView = (view: string) => {
  lens.dataset.view = view;
  for (const b of viewButtons) b.setAttribute("aria-pressed", String(b.dataset.view === view));
};
setView("lens");
for (const b of viewButtons) b.addEventListener("click", () => setView(b.dataset.view!));

const fromPointer = (e: PointerEvent) => {
  const r = lensStage.getBoundingClientRect();
  lastPointer = performance.now();
  lens.classList.add("following");
  if (lens.dataset.view !== "lens") setView("lens");
  placeLens(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
};
lensStage.addEventListener("pointermove", (e) => {
  // Au doigt, la loupe ne suit que pendant le glissé.
  if (e.pointerType === "mouse" || lensStage.hasPointerCapture(e.pointerId)) fromPointer(e);
});
lensStage.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "mouse") lensStage.setPointerCapture(e.pointerId);
  fromPointer(e);
});
lensStage.addEventListener("pointerleave", () => (lastPointer = performance.now()));

// Promenade : d'une note à l'autre, pour que la carte raconte quelque chose sans qu'on y touche.
const stops = [...lens.querySelectorAll<HTMLElement>(".gm .pin, .gm .badge")].map((el) => ({
  x: parseFloat(el.style.getPropertyValue("--x")),
  y: parseFloat(el.style.getPropertyValue("--y")) + (el.classList.contains("badge") ? 4 : 2),
}));
let stop = 0;
let lensVisible = false;
new IntersectionObserver(([e]) => (lensVisible = e.isIntersecting)).observe(lens);
if (!reducedMotion && stops.length) {
  const wander = () => {
    requestAnimationFrame(wander);
    if (!lensVisible || document.hidden || lens.dataset.view !== "lens") return;
    if (performance.now() - lastPointer < 2500) return;
    lens.classList.remove("following");
    const target = stops[stop];
    const dx = target.x - lensPos.x, dy = target.y - lensPos.y;
    if (Math.hypot(dx, dy) < 0.4) {
      // Une pause sur chaque secret, puis le suivant.
      lastPointer = performance.now() - 1300;
      stop = (stop + 1) % stops.length;
      return;
    }
    placeLens(lensPos.x + dx * 0.025, lensPos.y + dy * 0.025);
  };
  requestAnimationFrame(wander);
}

// --- Chiffrement en direct : AES-GCM 256, comme l'extension ----------------------

// Le texte vient de la vraie fenêtre de saisie d'une note secrète.
const secret = cipherWindow(document.getElementById("cipher-window")!);
const out = document.getElementById("cipher-out")!;
const decryptButton = document.getElementById("decrypt") as HTMLButtonElement;
const cipherNote = document.getElementById("cipher-note")!;
const KEY_NAME = "fiches-monstres-owlbear/note-jeton";

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

let key: CryptoKey | null = null;
let kid = "";
let sealed = { iv: "", ct: "" };
let opened = false;
let animation = 0;

/** Les métadonnées de l'objet, telles qu'un joueur les lirait dans les outils de développement. */
function render(ct: string, open = false) {
  out.classList.toggle("open", open);
  out.innerHTML =
    `<span class="k">"${KEY_NAME}"</span>: {\n` +
    `  <span class="k">"v"</span>: 1,\n` +
    `  <span class="k">"kid"</span>: "${kid}",\n` +
    `  <span class="k">"iv"</span>: "${sealed.iv}",\n` +
    `  <span class="k">"ct"</span>: "<span class="ct">${escapeHtml(ct)}</span>"\n}`;
}

/** Passe d'un texte à l'autre lettre par lettre, en brouillant ce qui n'est pas encore arrivé. */
function morph(from: string, to: string, open: boolean) {
  cancelAnimationFrame(animation);
  if (reducedMotion) return render(to, open);
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const start = performance.now();
  const length = Math.max(from.length, to.length);
  const step = (now: number) => {
    const done = Math.min(1, (now - start) / 900);
    const settled = Math.floor(done * length);
    let text = "";
    for (let i = 0; i < length; i++) {
      if (i < settled) text += to[i] ?? "";
      else if (i < settled + 12) text += to[i] === " " ? " " : glyphs[(Math.random() * glyphs.length) | 0];
      else text += from[i] ?? "";
    }
    render(text, open);
    if (done < 1) animation = requestAnimationFrame(step);
    else render(to, open);
  };
  animation = requestAnimationFrame(step);
}

async function seal() {
  if (!key) return;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify({ text: secret.value }));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  sealed = { iv: b64(iv), ct: b64(ct) };
}

async function openSealed() {
  const iv = Uint8Array.from(atob(sealed.iv), (c) => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(sealed.ct), (c) => c.charCodeAt(0));
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key!, ct);
  return (JSON.parse(new TextDecoder().decode(plain)) as { text: string }).text;
}

const setOpened = (value: boolean) => {
  opened = value;
  decryptButton.textContent = value ? TEXT.encrypt : TEXT.decrypt;
  cipherNote.textContent = value ? TEXT.opened : TEXT.locked;
};

async function startCipher() {
  if (!crypto.subtle) {
    cipherNote.textContent = TEXT.noCrypto;
    decryptButton.hidden = true;
    return;
  }
  key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  // Empreinte de la clé, calculée comme dans l'extension.
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  kid = b64(hash).replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
  await seal();
  render(sealed.ct);

  // Chaque frappe chiffre à nouveau, avec un vecteur neuf : le texte chiffré change entièrement.
  let pending = 0;
  secret.addEventListener("input", () => {
    clearTimeout(pending);
    pending = window.setTimeout(async () => {
      const before = sealed.ct;
      await seal();
      setOpened(false);
      morph(before, sealed.ct, false);
    }, 120);
  });

  decryptButton.addEventListener("click", async () => {
    if (opened) {
      const text = await openSealed();
      setOpened(false);
      morph(text, sealed.ct, false);
    } else {
      const text = await openSealed();
      setOpened(true);
      morph(sealed.ct, text, true);
    }
  });
}
startCipher();

// --- Fenêtres de l'extension : fiche (un onglet par jeu), note de token, notes de carte, clé -------

sheetDemo(document.getElementById("sheet-window")!, document.querySelectorAll<HTMLButtonElement>(".systems [data-system]"));
tokenDemo(document.getElementById("token-note-window")!);
notesDemo(document.getElementById("notes-list-window")!, document.getElementById("map-note-window")!);
keyDemo(document.getElementById("settings-window")!);

// --- En-tête, apparition au défilement ----------------------------------------

const top = document.querySelector<HTMLElement>(".top")!;
const nav = top.querySelector<HTMLElement>("nav")!;
const menuButton = top.querySelector<HTMLButtonElement>(".menu-toggle")!;
const narrow = matchMedia("(max-width: 1100px)");
const hasPopover = Object.hasOwn(HTMLElement.prototype, "popover");

// Sur petit écran, le menu est un popover : le bouton l'ouvre, Échap ou un clic à côté le ferment.
// Sur grand écran, c'est une barre de liens ordinaire.
const syncMenu = () => {
  if (hasPopover && narrow.matches) nav.setAttribute("popover", "auto");
  else nav.removeAttribute("popover");
  top.classList.remove("open");
};
narrow.addEventListener("change", syncMenu);
syncMenu();

// Navigateurs sans popover : l'ancien menu, ouvert par une classe.
if (!hasPopover) {
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.addEventListener("click", () => {
    const open = !top.classList.contains("open");
    top.classList.toggle("open", open);
    menuButton.setAttribute("aria-expanded", String(open));
  });
}
for (const link of nav.querySelectorAll("a")) {
  link.addEventListener("click", () => {
    if (hasPopover && nav.matches(":popover-open")) nav.hidePopover();
    top.classList.remove("open");
    menuButton.setAttribute("aria-expanded", "false");
  });
}

// L'en-tête se remplit au défilement en CSS ; ce relais ne sert qu'aux navigateurs qui ne savent pas le faire.
if (!CSS.supports("(animation-timeline: scroll()) and (animation-range: 0% 100%)")) {
  const onScroll = () => top.classList.toggle("scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
}

const reveal = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.classList.add("shown"); reveal.unobserve(e.target); }
  },
  { threshold: 0.12 },
);
for (const el of document.querySelectorAll(".chapter .wrap, .band .wrap, .ritual li")) {
  el.classList.add("reveal");
  reveal.observe(el);
}

// --- Liens externes ------------------------------------------------------------

for (const a of document.querySelectorAll<HTMLAnchorElement>("a[data-link]")) {
  const url = LINKS[a.dataset.link ?? ""];
  if (url) {
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
  } else {
    a.classList.add("soon");
    a.title = TEXT.soon;
    a.addEventListener("click", (e) => e.preventDefault());
  }
}

// --- Copie de l'adresse du manifest ----------------------------------------------

// La bulle à côté du bouton (role="status") montre et annonce le résultat, réussi ou non.
let lastMessage = "";
for (const button of document.querySelectorAll<HTMLElement>(".copy[data-copy]")) {
  const tip = button.nextElementSibling as HTMLElement;
  let timer = 0;
  button.title = TEXT.copy;
  button.addEventListener("click", async () => {
    let ok = true;
    try {
      await navigator.clipboard.writeText(button.dataset.copy!);
    } catch {
      ok = false;
    }
    let message = ok ? TEXT.copied : TEXT.copyFailed;
    // VoiceOver n'annonce pas deux fois de suite le même message : une espace insécable le rend différent.
    if (message === lastMessage) message += "\u00A0";
    lastMessage = message;
    clearTimeout(timer);
    button.classList.toggle("copied", ok);
    button.classList.toggle("failed", !ok);
    tip.classList.toggle("failed", !ok);
    tip.textContent = "";
    requestAnimationFrame(() => (tip.textContent = message));
    timer = window.setTimeout(() => {
      button.classList.remove("copied", "failed");
      tip.textContent = "";
    }, 2000);
  });
}
