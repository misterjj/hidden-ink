# Hidden Ink for Owlbear Rodeo

**Secret GM notes and stat blocks on your tokens and maps.** Everything the GM writes is encrypted in their
browser before it reaches the scene: players cannot read it, not even with their browser's developer tools.

*Version française plus bas.*

## Features

- **Stat blocks on tokens:** search the SRD with [Open5e](https://open5e.com), or write one by hand.
  The window can be moved, resized, and minimized to a row of icons.
- **Secret notes on any token**, including a player's own token: they never see it.
- **Map notes** for traps, hidden items and mechanisms: Markdown, a "done" state, titles shown only to the GM,
  and a list with search and filters.
- **Real secrecy:** stat blocks and notes are encrypted with AES-GCM 256. The key stays in the GM's browser.
- **English and French**, following the browser's language.

## Usage

**Stat block:** right-click a token, then **Add a stat block**. Search Open5e, or write it by hand.
**Adapt** copies an Open5e stat block into the manual form so you can change it.

**Secret note:** right-click any token, then **Add a secret note**. A small envelope marks tokens that have one,
on the GM's screen only.

**Map notes:** pick the **Map notes** tool, click the map, choose a type, write, then **Save**
(or `Ctrl`/`Cmd` + `Enter`). Click a note with the normal tool to read it. The tool also has the notes list,
a button to show or hide titles, and the settings.

## Your encryption key

The key is created with your first note and kept in this browser. **Export it** from the settings (gear icon in
the Map notes tool) and keep it somewhere safe:

- without it, a cleared browser loses access to every note;
- import it on another computer, or give it to a co-GM, to read and write the same notes.

Notes written by older versions are encrypted automatically the first time the GM opens the scene.
Stat blocks from Open5e are public, so only the link is encrypted, to hide which monster is behind a token.

**Good to know:** hidden note icons stay known to players' browsers. Only their content is protected.

## Development

```sh
pnpm install
pnpm test
pnpm dev
```

To try it in Owlbear Rodeo, add the custom extension `http://localhost:5173/manifest.json`, then enable it in the
room.

The AideDD source (French stat blocks, pasted as a link) is offered when the interface is in French. Build with
`VITE_AIDEDD=0` to remove it, or `VITE_AIDEDD=1` to offer it in every language.

## Licences

Code: [MIT](LICENSE). Open5e stat blocks come from the System Reference Documents 5.1 and 5.2 by Wizards of the
Coast LLC, under CC-BY-4.0; the source is shown under each stat block.

---

# Hidden Ink pour Owlbear Rodeo (français)

**Fiches de monstres et notes secrètes pour le MJ, sur les tokens et la carte.** Tout ce que le MJ écrit est
chiffré dans son navigateur : les joueurs ne peuvent pas le lire, même avec les outils de développement.

- **Fiche de monstre :** clic droit sur un token, **Ajouter une fiche de monstre**, puis recherche Open5e, lien
  AideDD (colle le lien, la fiche se charge seule) ou saisie à la main.
- **Note secrète :** clic droit sur n'importe quel token, même celui d'un joueur, puis **Ajouter une note secrète**.
- **Notes de carte :** outil **Notes de carte**, clique sur la carte, puis choisis le type dans la note.
- **Clé de chiffrement :** dans les réglages (roue dentée de l'outil Notes de carte). Exporte-la et garde-la :
  sans elle, un navigateur vidé perd toutes les notes. Importe-la sur un autre appareil ou chez un co-MJ.

L'interface suit la langue du navigateur, et se change dans les réglages.
