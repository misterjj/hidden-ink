import OBR from "@owlbear-rodeo/sdk";
import { PLUGIN_ID } from "./types";

/**
 * Tout ce que le MJ écrit est chiffré dans son navigateur avant d'aller dans la scène :
 * les joueurs reçoivent les mêmes objets, mais n'en lisent que des octets.
 * AES-GCM 256 bits, un vecteur d'initialisation neuf à chaque écriture.
 */
export interface Sealed {
  v: 1;
  /** Empreinte de la clé, pour reconnaître une donnée chiffrée avec une autre clé. */
  kid: string;
  iv: string;
  ct: string;
}

/** Dans le localStorage du MJ : la clé brute, en base64. */
export const KEY_STORAGE = `${PLUGIN_ID}/cle`;
/** Dans le localStorage du MJ : la clé a été copiée au moins une fois. */
const EXPORTED_STORAGE = `${PLUGIN_ID}/cle-sauvegardee`;
/** Dans les métadonnées de la salle : l'empreinte de la clé utilisée ici. Elle ne permet pas de la retrouver. */
export const ROOM_KID_KEY = `${PLUGIN_ID}/cle-empreinte`;

/** Donnée chiffrée avec une clé absente de ce navigateur. */
export class LockedError extends Error {}
/** La salle utilise une clé que ce navigateur n'a pas : écrire créerait des données illisibles ailleurs. */
export class MissingKeyError extends Error {}

export function isSealed(value: unknown): value is Sealed {
  if (!value || typeof value !== "object") return false;
  const sealed = value as Partial<Sealed>;
  return (
    sealed.v === 1 &&
    typeof sealed.kid === "string" &&
    typeof sealed.iv === "string" &&
    typeof sealed.ct === "string"
  );
}

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const fromBase64 = (text: string) => {
  const binary = atob(text);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
};

export interface Key {
  key: CryptoKey;
  kid: string;
  raw: string;
}

async function fingerprint(raw: Uint8Array<ArrayBuffer>) {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  return toBase64(hash).replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
}

/** Lit une clé exportée ; renvoie `null` si le texte n'en est pas une. */
export async function parseKey(text: string): Promise<Key | null> {
  try {
    const raw = fromBase64(text.trim());
    if (raw.length !== 32) return null;
    const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, [
      "encrypt",
      "decrypt",
    ]);
    return { key, kid: await fingerprint(raw), raw: toBase64(raw) };
  } catch {
    return null;
  }
}

export async function generateKey(): Promise<Key> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  return (await parseKey(toBase64(raw)))!;
}

export async function sealWith(key: Key, value: unknown): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(value));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key.key, plain));
  return { v: 1, kid: key.kid, iv: toBase64(iv), ct: toBase64(ct) };
}

export async function openWith<T>(key: Key | null, sealed: Sealed): Promise<T> {
  if (!key || key.kid !== sealed.kid) throw new LockedError();
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(sealed.iv) },
      key.key,
      fromBase64(sealed.ct),
    );
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  } catch {
    throw new LockedError();
  }
}

/** Taille réelle dans la scène, chiffrement compris. */
export const byteSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

// --- Clé de ce navigateur -------------------------------------------------------

let cached: Promise<Key | null> | undefined;

export function localKey(): Promise<Key | null> {
  cached ??= (async () => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      return saved ? await parseKey(saved) : null;
    } catch {
      return null;
    }
  })();
  return cached;
}

function storeKey(key: Key) {
  localStorage.setItem(KEY_STORAGE, key.raw);
  cached = Promise.resolve(key);
}

// Une autre fenêtre de l'extension a changé la clé.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === KEY_STORAGE) cached = undefined;
  });
}

export async function roomKid(): Promise<string | undefined> {
  const kid = (await OBR.room.getMetadata())[ROOM_KID_KEY];
  return typeof kid === "string" ? kid : undefined;
}

/**
 * La clé avec laquelle écrire dans cette salle. Elle est créée à la première note ;
 * si la salle utilise déjà une autre clé, on refuse plutôt que d'écrire des données illisibles ailleurs.
 */
export async function writeKey(): Promise<Key> {
  const [key, kid] = await Promise.all([localKey(), roomKid()]);
  if (key && (!kid || kid === key.kid)) {
    if (!kid) await OBR.room.setMetadata({ [ROOM_KID_KEY]: key.kid });
    return key;
  }
  if (kid) throw new MissingKeyError();
  const created = await generateKey();
  storeKey(created);
  await OBR.room.setMetadata({ [ROOM_KID_KEY]: created.kid });
  return created;
}

export async function seal(value: unknown): Promise<Sealed> {
  return sealWith(await writeKey(), value);
}

/** Valeur en clair : chiffrée par Hidden Ink, ou écrite en clair par une version plus ancienne. */
export async function reveal<T>(value: unknown): Promise<T> {
  return isSealed(value) ? openWith<T>(await localKey(), value) : (value as T);
}

/** Comme `reveal`, mais `undefined` si la donnée est illisible ici. */
export async function tryReveal<T>(value: unknown): Promise<T | undefined> {
  try {
    return await reveal<T>(value);
  } catch {
    return undefined;
  }
}

export async function importKey(text: string): Promise<Key | null> {
  const key = await parseKey(text);
  if (!key) return null;
  storeKey(key);
  markExported();
  return key;
}

export function markExported() {
  try {
    localStorage.setItem(EXPORTED_STORAGE, "1");
  } catch {
    // Sans stockage, le rappel continuera de s'afficher.
  }
}

export function isExported() {
  try {
    return localStorage.getItem(EXPORTED_STORAGE) === "1";
  } catch {
    return false;
  }
}
