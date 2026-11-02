# Fiches de monstres pour Owlbear Rodeo

Attache une fiche de monstre à un token, dans une fenêtre réservée au MJ.
La fiche vient d'un lien AideDD ou d'une saisie à la main.

## Utilisation

1. Clic droit sur un token, puis **Ajouter une fiche de monstre**.
2. Choisis **Lien AideDD** (colle le lien) ou **Saisie à la main**.
3. Ensuite, clic droit puis **Voir la fiche de monstre**.

Dans la fenêtre :

- la barre rouge sert à la déplacer : un cadre rouge suit la souris sur la carte, puis la fenêtre s'y pose ;
- le coin en bas à droite sert à la redimensionner en direct ;
- le bouton `–` la réduit à une ligne de pictos, un par partie de la fiche ; survoler un picto affiche cette partie ;
- le bouton `▢` la remet en grand ;
- le crayon permet de modifier la fiche, de changer de méthode ou de retirer la fiche.

Liens acceptés :

- `https://www.aidedd.org/dnd/monstres.php?vf=tertre-errant`
- `https://www.aidedd.org/dnd/monstres.php?vo=shambling-mound`
- `https://www.aidedd.org/monster/goblin-warrior`
- `https://www.aidedd.org/monster/fr/mimique`

## Notes de carte

Pour les pièges, les objets cachés et les mécaniques spéciales.

**En préparation :**

1. Prends l'outil **Notes de carte** dans la barre d'outils.
2. Choisis un type : piège, objet caché, mécanique ou note libre.
3. Clique sur la carte, écris la note, puis **Enregistrer** (ou `Ctrl`/`Cmd` + `Entrée`).

L'outil reste actif pour poser la note suivante. Un picto se déplace, se copie et
se supprime comme n'importe quel objet Owlbear.

**En partie :**

- le titre de chaque note est affiché sous son picto ; le bouton **T** de l'outil Notes les masque ou les réaffiche pour toute la scène ;
- clique sur un picto avec l'outil normal : la note s'ouvre à côté, et se ferme quand tu cliques ailleurs ;
- **Marquer comme fait** estompe le picto ;
- le bouton **Liste des notes** de l'outil permet de chercher, filtrer par type et centrer la carte sur une note.

## Développement

```sh
pnpm install
pnpm test
pnpm dev
```

Pour essayer dans Owlbear Rodeo, ajoute l'extension personnalisée
`http://localhost:5173/manifest.json`, puis active-la dans la salle.

Aperçu d'une fiche hors d'Owlbear :
`http://localhost:5173/statblock.html?preview=<lien AideDD>`

## Mise en ligne (Cloudflare Pages, gratuit)

```sh
npx wrangler login
pnpm run deploy
```

Le manifest est alors à l'adresse
`https://fiches-monstres-owlbear.pages.dev/manifest.json`, ou à l'adresse affichée
par la commande si ce nom est déjà pris.

Le relais doit être hébergé avec le site, car AideDD n'autorise pas la lecture
directe depuis un navigateur. Il est dans `functions/api/fiche.ts` et ne peut
atteindre que les fiches de monstres d'aidedd.org.

## Bon à savoir

- **Stockage :** un lien ou une fiche saisie à la main est enregistré sur le token,
  dans la scène. L'interface ne le montre qu'au MJ, mais un joueur qui fouille les
  outils de développement de son navigateur pourrait techniquement le lire.
- **Notes de carte :** les pictos sont des objets masqués, que les joueurs ne voient
  pas sur leur carte. Leur texte reste lisible avec les outils de développement.
- **Pannes d'AideDD :** une fiche déjà ouverte reste en cache dans le navigateur où
  elle a été lue. Une fiche jamais ouverte ne peut pas s'afficher pendant une panne.
- **Taille :** une fiche saisie à la main est limitée à 12 ko.
- **Usage :** projet prévu pour un usage personnel. Avant de le publier dans le
  catalogue Owlbear, demande l'accord d'AideDD, car il réutilise le contenu de ses pages.
