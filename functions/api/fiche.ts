import { handleFicheRequest } from "../../shared/aidedd";

// Cloudflare Pages Function : GET /api/fiche?url=<fiche AideDD>
export const onRequestGet = ({ request }: { request: Request }) =>
  handleFicheRequest(new URL(request.url));
