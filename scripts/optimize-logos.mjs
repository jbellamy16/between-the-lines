import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { optimize } from "svgo";

// Keep the original artwork for future exports. Runtime crests support up to
// 4× density at their largest displayed width (48 CSS pixels).
for (const team of ["harbor", "riverside"]) {
  await sharp(`public/teams/${team}.png`)
    .resize(192, 192)
    .webp({ lossless: true, effort: 6 })
    .toFile(`public/teams/${team}.webp`);
}

for (const kind of ["horizontal", "mark"]) {
  for (const theme of ["dark", "light"]) {
    const source = `public/brand/btl-${kind}-${theme}.svg`;
    const { data } = optimize(await readFile(source, "utf8"), {
      path: source,
      multipass: true,
    });
    await writeFile(source.replace(/\.svg$/, ".min.svg"), data);
  }
}
