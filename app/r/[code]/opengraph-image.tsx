import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "levera — launch coins on Robinhood with up to 2× leverage";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

/// Serve the branded OG card (hoodie + wordmark) so a tweet of /r/CODE
/// pulls the same image as the homepage, not the typographic fallback.
export default async function Image() {
  const file = await readFile(path.join(process.cwd(), "public/og-image.png"));
  return new Response(file, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
