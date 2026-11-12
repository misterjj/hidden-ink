// Ce qui reste illisible dans la scène quand on repart avec une nouvelle clé.

import type { Item } from "@owlbear-rodeo/sdk";
import { isSealed } from "./crypto";
import { NOTE_KEY } from "./notes";
import { METADATA_KEY, TOKEN_NOTE_KEY } from "./types";

export interface Unreadable {
  /** Notes de carte : l'objet n'existe que pour sa note, on le supprime. */
  remove: string[];
  /** Tokens : on retire seulement la fiche ou la note secrète, le token reste. */
  clear: Map<string, string[]>;
}

/** Données chiffrées avec une autre clé que `kid`. Le texte en clair, lisible de tous côtés, n'est pas touché. */
export function unreadableData(items: Item[], kid: string): Unreadable {
  const locked = (value: unknown) => isSealed(value) && value.kid !== kid;
  const remove: string[] = [];
  const clear = new Map<string, string[]>();
  for (const item of items) {
    if (locked(item.metadata[NOTE_KEY])) {
      remove.push(item.id);
      continue;
    }
    const keys = [METADATA_KEY, TOKEN_NOTE_KEY].filter((key) => locked(item.metadata[key]));
    if (keys.length) clear.set(item.id, keys);
  }
  return { remove, clear };
}
