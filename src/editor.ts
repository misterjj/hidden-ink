import OBR from "@owlbear-rodeo/sdk";
import { FicheError, loadFromAidedd } from "./data";
import { normalizeFicheUrl } from "../shared/aidedd";
import { escapeHtml, statblockToManual } from "./manual";
import "./style.css";
import {
  CHANNEL,
  EDITOR_POPOVER_ID,
  METADATA_KEY,
  type ManualFiche,
  type Message,
  type Statblock,
  type TokenFiche,
} from "./types";

// Les métadonnées sont synchronisées dans la scène : on évite d'y mettre un roman.
const MAX_MANUAL_BYTES = 12 * 1024;
const ABILITIES = ["FOR", "DEX", "CON", "INT", "SAG", "CHA"];
const PANE_HEIGHTS: Record<string, number> = { choice: 270, link: 310, manual: 760 };

const params = new URLSearchParams(location.search);
const itemId = params.get("item") ?? "";
const app = document.querySelector<HTMLDivElement>("#app")!;

const send = (message: Message) =>
  OBR.broadcast.sendMessage(CHANNEL, message, { destination: "LOCAL" });

async function save(fiche: TokenFiche | undefined) {
  await OBR.scene.items.updateItems([itemId], (items) => {
    for (const item of items) {
      if (fiche) item.metadata[METADATA_KEY] = fiche;
      else delete item.metadata[METADATA_KEY];
    }
  });
}

async function finish(open: boolean) {
  if (open) await send({ type: "open", itemId });
  else await send({ type: "close", itemId });
  await OBR.popover.close(EDITOR_POPOVER_ID);
}

function render(current: TokenFiche | undefined, tokenName: string, tab: string) {
  const manual: ManualFiche =
    current?.kind === "manual"
      ? current.fiche
      : {
          name: tokenName,
          type: "",
          ac: "",
          hp: "",
          speed: "",
          abilities: ["", "", "", "", "", ""],
          props: "",
          body: "",
        };
  const field = (name: keyof ManualFiche, label: string, placeholder = "") => `
    <label>${label}<input name="${name}" value="${escapeHtml(String(manual[name]))}" placeholder="${escapeHtml(placeholder)}" /></label>`;

  app.innerHTML = `
    <div class="editor">
      <header class="bar">
        <strong>Fiche de monstre</strong>
        <button type="button" class="icon" id="cancel" title="Fermer">✕</button>
      </header>
      <div class="pane" data-pane="choice">
        <p class="question">Comment veux-tu remplir cette fiche ?</p>
        <button type="button" class="choice" data-go="link">
          <strong>Lien AideDD</strong>
          <span>Colle un lien : toute la fiche est récupérée automatiquement.</span>
        </button>
        <button type="button" class="choice" data-go="manual">
          <strong>Saisie à la main</strong>
          <span>Remplis les informations toi-même, sans dépendre d'un site.</span>
        </button>
      </div>

      <button type="button" class="back" id="back" hidden>← Changer de méthode</button>

      <form id="link-form" class="pane" data-pane="link">
        <label>Lien de la fiche
          <input name="url" autocomplete="off" placeholder="https://www.aidedd.org/dnd/monstres.php?vf=tertre-errant"
            value="${current?.kind === "link" ? escapeHtml(current.url) : ""}" />
        </label>
        <p class="error" id="link-error" hidden></p>
        <div class="row">
          <button type="submit" class="primary" id="link-submit">Attacher au token</button>
          <button type="button" id="adapt">Adapter</button>
          <button type="button" id="to-manual" hidden>Saisir à la main</button>
        </div>
        <p class="hint">Colle le lien : la fiche se charge toute seule. <b>Adapter</b> la recopie dans la saisie à la main pour la modifier, sans les liens vers les sorts.</p>
      </form>

      <form id="manual-form" class="pane" data-pane="manual">
        ${field("name", "Nom *")}
        ${field("type", "Type", "Plante de taille G, sans alignement")}
        <div class="row3">
          ${field("ac", "Classe d'armure", "15 (armure naturelle)")}
          ${field("hp", "Points de vie", "136 (16d10 + 48)")}
          ${field("speed", "Vitesse", "6 m, nage 6 m")}
        </div>
        <div class="row6">
          ${ABILITIES.map(
            (label, index) => `
            <label>${label}<input name="ability${index}" inputmode="numeric" value="${escapeHtml(manual.abilities[index] ?? "")}" /></label>`,
          ).join("")}
        </div>
        <label>Autres informations <small>(une par ligne, « Libellé : valeur »)</small>
          <textarea name="props" rows="5" placeholder="Résistances aux dégâts : froid, feu&#10;Immunités aux états : aveuglé&#10;Sens : vision aveugle 18 m&#10;Puissance : 5 (1800 PX)">${escapeHtml(manual.props)}</textarea>
        </label>
        <label>Capacités et actions <small>(une par ligne, « Nom. Description » ; « # Titre » pour une section)</small>
          <textarea name="body" rows="9" placeholder="Absorption de foudre. Ne subit aucun dégât de foudre et récupère autant de PV.&#10;# Actions&#10;Coup. +7 au toucher, allonge 1,50 m. Touché : 13 (2d8 + 4) contondants.">${escapeHtml(manual.body)}</textarea>
        </label>
        <p class="error" id="manual-error" hidden></p>
        <button type="submit" class="primary">Enregistrer sur le token</button>
      </form>

      ${current ? `<button type="button" class="danger" id="remove">Retirer la fiche de ce token</button>` : ""}
    </div>`;

  const showTab = (name: string) => {
    app.querySelectorAll<HTMLElement>(".pane").forEach((pane) => {
      pane.hidden = pane.dataset.pane !== name;
    });
    app.querySelector<HTMLButtonElement>("#back")!.hidden = name === "choice";
    const wanted = PANE_HEIGHTS[name] + (current ? 56 : 0);
    OBR.viewport
      .getHeight()
      .then((viewport) =>
        OBR.popover.setHeight(EDITOR_POPOVER_ID, Math.min(wanted, viewport - 32)),
      );
    if (name === "link") {
      app.querySelector<HTMLInputElement>("#link-form input")!.focus();
    }
  };
  showTab(tab);
  app.querySelector<HTMLButtonElement>("#back")!.onclick = () => showTab("choice");
  app.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((button) => {
    button.onclick = () => showTab(button.dataset.go!);
  });

  app.querySelector<HTMLButtonElement>("#cancel")!.onclick = () =>
    OBR.popover.close(EDITOR_POPOVER_ID);

  app.querySelector<HTMLButtonElement>("#remove")?.addEventListener("click", async () => {
    await save(undefined);
    await finish(false);
  });

  const linkForm = app.querySelector<HTMLFormElement>("#link-form")!;
  const linkInput = linkForm.elements.namedItem("url") as HTMLInputElement;
  const linkError = app.querySelector<HTMLParagraphElement>("#link-error")!;
  const submit = app.querySelector<HTMLButtonElement>("#link-submit")!;
  const toManual = app.querySelector<HTMLButtonElement>("#to-manual")!;
  toManual.onclick = () => showTab("manual");
  const adapt = app.querySelector<HTMLButtonElement>("#adapt")!;

  const withLoadedLink = async (
    button: HTMLButtonElement,
    fallbackError: string,
    action: (statblock: Statblock) => Promise<void> | void,
  ) => {
    const label = button.textContent;
    linkError.hidden = true;
    toManual.hidden = true;
    submit.disabled = adapt.disabled = true;
    button.textContent = "Chargement…";
    try {
      await action(await loadFromAidedd(linkInput.value));
    } catch (error) {
      linkError.textContent = error instanceof FicheError ? error.message : fallbackError;
      linkError.hidden = false;
      toManual.hidden = false;
    } finally {
      submit.disabled = adapt.disabled = false;
      button.textContent = label;
    }
  };
  const attach = () =>
    withLoadedLink(submit, "Impossible d'attacher cette fiche.", async () => {
      await save({ kind: "link", url: normalizeFicheUrl(linkInput.value)! });
      await finish(true);
    });
  // Rien n'est enregistré ici : le lien reste en place tant que le formulaire n'est pas validé.
  adapt.onclick = () =>
    withLoadedLink(adapt, "Impossible de charger cette fiche.", (statblock) => {
      fillManualForm(statblockToManual(statblock));
      showTab("manual");
    });
  linkForm.onsubmit = (event) => {
    event.preventDefault();
    attach();
  };
  linkInput.addEventListener("paste", () => {
    // La valeur n'est à jour qu'après l'événement.
    setTimeout(() => {
      if (normalizeFicheUrl(linkInput.value)) attach();
    });
  });

  const fillManualForm = (fiche: ManualFiche) => {
    const set = (name: string, value: string) => {
      (manualForm.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value = value;
    };
    for (const name of ["name", "type", "ac", "hp", "speed", "props", "body"] as const) {
      set(name, fiche[name]);
    }
    ABILITIES.forEach((_, index) => set(`ability${index}`, fiche.abilities[index] ?? ""));
  };

  const manualForm = app.querySelector<HTMLFormElement>("#manual-form")!;
  manualForm.oninput = () => {
    app.querySelector<HTMLParagraphElement>("#manual-error")!.hidden = true;
  };
  manualForm.onsubmit = async (event) => {
    event.preventDefault();
    const data = new FormData(manualForm);
    const value = (key: string) => String(data.get(key) ?? "").trim();
    const fiche: ManualFiche = {
      name: value("name"),
      type: value("type"),
      ac: value("ac"),
      hp: value("hp"),
      speed: value("speed"),
      abilities: ABILITIES.map((_, index) => value(`ability${index}`)),
      props: value("props"),
      body: value("body"),
    };
    const manualError = app.querySelector<HTMLParagraphElement>("#manual-error")!;
    const size = new TextEncoder().encode(JSON.stringify(fiche)).length;
    if (!fiche.name) {
      manualError.textContent = "Le nom est obligatoire.";
    } else if (size > MAX_MANUAL_BYTES) {
      manualError.textContent = `Fiche trop longue (${Math.ceil(size / 1024)} ko, 12 ko maximum).`;
    } else {
      try {
        await save({ kind: "manual", fiche });
        await finish(true);
        return;
      } catch {
        manualError.textContent = "Enregistrement impossible sur ce token.";
      }
    }
    manualError.hidden = false;
  };
}

OBR.onReady(async () => {
  if ((await OBR.player.getRole()) !== "GM") {
    await OBR.popover.close(EDITOR_POPOVER_ID);
    return;
  }
  const [item] = await OBR.scene.items.getItems([itemId]);
  const current = item?.metadata[METADATA_KEY] as TokenFiche | undefined;
  // Token sans fiche : on commence par le choix de la méthode.
  render(current, item?.name ?? "", params.get("tab") ?? current?.kind ?? "choice");
});
