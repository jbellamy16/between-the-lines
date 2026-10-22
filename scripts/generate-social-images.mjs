import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";

// Approved cinematic concept, shared with the YouTube hero's visual identity.
// Contain the complete composition so narrower cards never crop its lettering.
export function renderSocialHero(width, height) {
  return sharp(
    fileURLToPath(new URL("../assets/brand/social-hero.png", import.meta.url)),
  )
    .resize(width, height, { fit: "contain", background: "#030d20" })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  for (const [name, width, height] of [
    ["opengraph-image", 1200, 630],
    ["twitter-image", 1200, 675],
  ]) {
    await writeFile(
      `public/${name}.png`,
      await renderSocialHero(width, height),
    );
  }
}
