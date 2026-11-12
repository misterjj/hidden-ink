// Chaque fenêtre suit le thème clair ou sombre d'Owlbear Rodeo, comme Tempest! et Spellcast FX.

import OBR, { type Theme } from "@owlbear-rodeo/sdk";

const apply = (theme: Theme) => {
  document.documentElement.dataset.theme = theme.mode === "LIGHT" ? "light" : "dark";
};

OBR.onReady(async () => {
  apply(await OBR.theme.getTheme());
  OBR.theme.onChange(apply);
});
