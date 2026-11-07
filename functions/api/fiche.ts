import { handleFicheRequest } from "../../shared/fiche-url";

// Cloudflare Pages Function : GET /api/fiche?url=<fiche AideDD, Archives of Nethys ou SRD Daggerheart>
export const onRequestGet = ({ request }: { request: Request }) =>
  handleFicheRequest(new URL(request.url));
