// Original vector artwork. Rebuild every export with: npm run brand:build
import { readFile, writeFile, mkdir, copyFile, stat } from "node:fs/promises";
import * as fontkit from "fontkit";
import sharp from "sharp";
import { renderSocialHero } from "./generate-social-images.mjs";
const display = fontkit.openSync(
  "node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2",
);
const ui = fontkit.openSync(
  "node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
);
const C = {
  night: "#0B0F14",
  green: "#22C55E",
  slate: "#334155",
  mist: "#CBD5E1",
  white: "#F8FAFC",
  muted: "#94A3B8",
};
const inventory = [];
await mkdir("public/brand", { recursive: true });
await mkdir("docs/brand", { recursive: true });
function text(value, x, y, size, color = C.white, spacing = 0, font = display) {
  const run = font.layout(value);
  let cursor = 0;
  const scale = size / font.unitsPerEm;
  return `<g fill="${color}" aria-label="${value}">${run.glyphs
    .map((glyph, i) => {
      const p = run.positions[i];
      const path = `<path transform="translate(${(x + cursor + p.xOffset * scale).toFixed(3)} ${(y - p.yOffset * scale).toFixed(3)}) scale(${scale} ${-scale})" d="${glyph.path.toSVG()}"/>`;
      cursor += p.xAdvance * scale + spacing;
      return path;
    })
    .join("")}</g>`;
}
function mark(ink = C.white, accent = C.green, small = false) {
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="${small ? 6 : 3.5}"><path stroke="${ink}" d="M16 16V80M80 16V80M48 10V30M48 66V86"/><circle stroke="${ink}" cx="48" cy="48" r="18"/><path stroke="${accent}" d="M24 72C49 72 47 24 72 24M64 20L72 24L68 32"/>${small ? "" : `<circle cx="24" cy="72" r="3.5" fill="${accent}" stroke="none"/>`}</g>`;
}
function svg(w, h, body, title = "Between the Lines") {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img"><title>${title}</title>${body}</svg>`;
}
function logo(kind, ink, accent) {
  if (kind === "mark") return [96, 96, mark(ink, accent)];
  if (kind === "compact")
    return [224, 96, mark(ink, accent) + text("BTL", 112, 73, 72, ink, 3)];
  if (kind === "stacked")
    return [
      320,
      330,
      `<g transform="translate(94 10) scale(1.375)">${mark(ink, accent)}</g>` +
        text("BETWEEN", 28, 219, 68, ink, 5) +
        text("THE LINES", 28, 280, 68, ink, 2.2),
    ];
  return [
    376,
    112,
    `<g transform="translate(0 8)">${mark(ink, accent)}</g>` +
      text("BETWEEN", 116, 50, 58, ink, 5.5) +
      text("THE LINES", 116, 102, 58, ink, 3),
  ];
}
async function save(path, content, w, h, role) {
  await writeFile(path, content);
  inventory.push({
    file: path,
    width: w,
    height: h,
    role,
    bytes: (await stat(path)).size,
  });
}
async function raster(path, source, w, h, role) {
  await save(
    path,
    await sharp(Buffer.from(source))
      .resize(w, h)
      .png({ compressionLevel: 9 })
      .toBuffer(),
    w,
    h,
    role,
  );
}
for (const [variant, ink, accent] of [
  ["dark", C.white, C.green],
  ["light", C.night, "#15803D"],
  ["white", "#FFFFFF", "#FFFFFF"],
  ["black", "#000000", "#000000"],
]) {
  for (const kind of ["horizontal", "stacked", "mark", "compact"]) {
    const [w, h, body] = logo(kind, ink, accent);
    const art = svg(w, h, body);
    const base = `public/brand/btl-${kind}-${variant}`;
    await save(
      `${base}.svg`,
      art,
      w,
      h,
      `${kind}; ${variant} ink/surface variant; outlined type`,
    );
    await raster(
      `${base}.png`,
      art,
      w * 4,
      h * 4,
      `${kind}; transparent high-resolution PNG`,
    );
  }
}
// Install icons use a full-bleed brand tile. A knockout keeps the route distinct
// when it crosses the field geometry; the navigation logo remains unchanged.
function tileMark() {
  const route = "M24 72C49 72 47 24 72 24M64 20L72 24L68 32";
  return `<g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="5"><path stroke="${C.night}" d="M16 16V80M80 16V80M48 10V30M48 66V86"/><circle stroke="${C.night}" cx="48" cy="48" r="18"/><path stroke="${C.green}" stroke-width="10" d="${route}"/><path stroke="${C.night}" d="${route}"/></g>`;
}
function appTile(rounded = true, scale = 4) {
  const inset = (512 - 96 * scale) / 2;
  return svg(
    512,
    512,
    `<rect width="512" height="512" rx="${rounded ? 108 : 0}" fill="${C.green}"/><g transform="translate(${inset} ${inset}) scale(${scale})">${tileMark()}</g>`,
  );
}
// Pixel-size geometry, with fewer crossings than the full application symbol.
const favicon = svg(
  32,
  32,
  `<rect width="32" height="32" rx="7" fill="${C.green}"/><g fill="none" stroke="${C.night}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8V24M26 8V24"/><circle cx="16" cy="16" r="6"/><path stroke="${C.green}" stroke-width="5" d="M10 24L22 8"/><path d="M10 24L22 8M17 8H22V13"/></g>`,
);
const icon = appTile();
const maskable = appTile(false, 3.6);
const appleIcon = appTile(false);
await save("public/icon.svg", icon, 512, 512, "App icon");
await save(
  "public/favicon.svg",
  favicon,
  32,
  32,
  "Simplified small-size symbol",
);
await save(
  "public/safari-pinned-tab.svg",
  svg(96, 96, mark("#000", "#000", true)),
  96,
  96,
  "Monochrome browser mask",
);
for (const size of [16, 32, 48])
  await raster(
    `public/favicon-${size}x${size}.png`,
    favicon,
    size,
    size,
    "Optically simplified favicon",
  );
for (const size of [64, 192, 256, 512, 1024])
  await raster(`public/icon-${size}.png`, icon, size, size, "Application icon");
await raster(
  "public/apple-touch-icon.png",
  appleIcon,
  180,
  180,
  "Opaque Apple touch icon; OS supplies the corner mask",
);
await raster(
  "public/icon-maskable-512.png",
  maskable,
  512,
  512,
  "Maskable; all foreground inside 80% safe circle",
);
const pngs = await Promise.all(
  [16, 32, 48].map((n) => readFile(`public/favicon-${n}x${n}.png`)),
);
const ico = Buffer.alloc(6 + 16 * pngs.length);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(3, 4);
let offset = ico.length;
pngs.forEach((p, i) => {
  const at = 6 + i * 16;
  ico[at] = [16, 32, 48][i];
  ico[at + 1] = ico[at];
  ico.writeUInt16LE(1, at + 4);
  ico.writeUInt16LE(32, at + 6);
  ico.writeUInt32LE(p.length, at + 8);
  ico.writeUInt32LE(offset, at + 12);
  offset += p.length;
});
await save(
  "public/favicon.ico",
  Buffer.concat([ico, ...pngs]),
  48,
  48,
  "Multi-resolution ICO: 16, 32, 48",
);
// A decorative tactical study, not a fabricated match statistic or screenshot.
function tactical(x, y, width, height) {
  const W = width,
    H = height,
    inset = 24;
  const px = (v) => (v * W) / 440,
    py = (v) => (v * H) / 400;
  const landscape = W > H * 1.5;
  const markings = landscape
    ? `<path d="M${W / 2} ${inset}V${H - inset}M${inset} ${H * 0.26}H${W * 0.17}V${H * 0.74}H${inset}M${W - inset} ${H * 0.26}H${W * 0.83}V${H * 0.74}H${W - inset}"/>`
    : `<path d="M${inset} ${H / 2}H${W - inset}M${W * 0.3} ${inset}V${H * 0.22}H${W * 0.7}V${inset}M${W * 0.3} ${H - inset}V${H * 0.78}H${W * 0.7}V${H - inset}"/>`;
  return `<g transform="translate(${x} ${y})">
    <defs><clipPath id="field-crop"><rect width="${W}" height="${H}" rx="20"/></clipPath></defs>
    <g clip-path="url(#field-crop)"><rect width="${W}" height="${H}" fill="#14241E"/>
    <path d="M${W / 4} 0H${W / 2}V${H}H${W / 4}ZM${W * 0.75} 0H${W}V${H}H${W * 0.75}Z" fill="#193126"/></g>
    <g fill="none" stroke="#42644F" stroke-width="1.5">
      <rect x="${inset}" y="${inset}" width="${W - inset * 2}" height="${H - inset * 2}" rx="2"/>
      ${markings}<circle cx="${W / 2}" cy="${H / 2}" r="${Math.min(W, H) * 0.13}"/>
    </g>
    <path d="M${inset} ${py(132)}H${W - inset}" stroke="${C.green}" stroke-dasharray="4 7" opacity=".4"/>
    <g fill="${C.mist}" opacity=".65">${[
      [90, 95],
      [177, 140],
      [290, 150],
      [342, 223],
      [107, 231],
      [249, 303],
    ]
      .map(
        ([x, y]) =>
          `<rect x="${px(x) - 4}" y="${py(y) - 4}" width="8" height="8" rx="1"/>`,
      )
      .join("")}</g>
    <path d="${[
      [87, 321],
      [155, 256],
      [242, 210],
      [272, 115],
      [350, 66],
    ]
      .map(([x, y], i) => `${i ? "L" : "M"}${px(x)} ${py(y)}`)
      .join(
        "",
      )}" stroke="${C.green}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M${px(350) - 19} ${py(66) - 1}L${px(350)} ${py(66)}L${px(350) - 5} ${py(66) + 18}" stroke="${C.green}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    ${[
      [87, 321],
      [155, 256],
      [242, 210],
    ]
      .map(
        ([x, y]) =>
          `<circle cx="${px(x)}" cy="${py(y)}" r="7" fill="${C.night}" stroke="${C.green}" stroke-width="3"/>`,
      )
      .join("")}
    <circle cx="${px(272)}" cy="${py(115)}" r="23" fill="none" stroke="${C.green}" opacity=".25"/>
    <circle cx="${px(272)}" cy="${py(115)}" r="11" fill="${C.green}"/>
  </g>`;
}
function social(w, h) {
  const square = w === h;
  const portrait = h > w;
  const scale = w / 1200;
  const H = h / scale;
  let body = `<rect width="1200" height="${H}" fill="${C.night}"/><path d="M64 0H1136" stroke="${C.green}" stroke-width="8"/>`;
  body += `<g transform="translate(64 ${portrait ? 156 : 48}) scale(.72)">${logo("horizontal", C.white, C.green)[2]}</g>`;
  if (!square && !portrait) {
    body += `<rect x="840" y="54" width="296" height="34" rx="17" fill="#193126"/>`;
    body += text("FOOTBALL INTELLIGENCE", 862, 77, 13, C.green, 1.1, ui);
    body += text("MORE THAN", 64, 270, 112, C.white, 1);
    body += text("THE SCORE.", 64, 382, 112, C.green, 1);
    body += text(
      "See the pattern. Follow the play.",
      68,
      441,
      23,
      C.mist,
      0,
      ui,
    );
    body += tactical(700, 151, 436, 396);
    body += `<path d="M64 ${H - 56}H1136" stroke="${C.slate}"/>`;
    body += text(
      "FOOTBALL INSIGHTS THAT GO DEEPER.",
      64,
      H - 26,
      13,
      C.mist,
      1.1,
      ui,
    );
    body += text("BETWEEN THE LINES", 955, H - 26, 13, C.muted, 1, ui);
  } else {
    const top = portrait ? 460 : 325;
    body += text("MORE THAN", 64, top, 154, C.white, 1);
    body += text("THE SCORE.", 64, top + 155, 154, C.green, 1);
    body += text(
      "See the pattern. Follow the play.",
      68,
      top + 220,
      30,
      C.mist,
      0,
      ui,
    );
    const fieldY = top + (portrait ? 335 : 270);
    const fieldH = portrait ? 840 : 465;
    body += tactical(64, fieldY, 1072, fieldH);
    const footer = portrait ? H - 180 : H - 48;
    body += text(
      "FOOTBALL INSIGHTS THAT GO DEEPER.",
      64,
      footer,
      20,
      C.mist,
      1,
      ui,
    );
  }
  return svg(
    w,
    h,
    `<g transform="scale(${scale})">${body}</g>`,
    "Between the Lines. More than the score. See the pattern. Follow the play.",
  );
}
for (const [name, w, h] of [
  ["opengraph-image", 1200, 630],
  ["twitter-image", 1200, 675],
  ["social-square", 1080, 1080],
  ["social-story", 1080, 1920],
  ["video-title", 1920, 1080],
  ["hackathon-cover", 1920, 1080],
]) {
  const art = social(w, h);
  await save(
    `public/brand/${name}.svg`,
    art,
    w,
    h,
    "BTL editorial share composition; outlined lettering and illustrative tactical route",
  );
  if (name === "opengraph-image" || name === "twitter-image") {
    // Retain the vector alternative; published link cards use the approved hero.
    await save(
      `public/${name}.png`,
      await renderSocialHero(w, h),
      w,
      h,
      "Social-sharing export; approved cinematic hero",
    );
  } else {
    await raster(
      `public/brand/${name}.png`,
      art,
      w,
      h,
      "Social / presentation export",
    );
  }
}
// Review each export at its intended scale, including actual-size browser icons.
const innerSvg = (art) =>
  art.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
const metaPreview = svg(
  1280,
  1080,
  `<rect width="1280" height="1080" fill="${C.night}"/>` +
    text("BETWEEN THE LINES / SHARE + APP ASSETS", 64, 48, 20, C.mist, 2) +
    `<g transform="translate(64 88) scale(.96)">${innerSvg(social(1200, 630))}</g>` +
    `<path d="M64 730H1216" stroke="${C.slate}"/>` +
    `<g transform="translate(64 780) scale(.28125)">${innerSvg(icon)}</g>` +
    `<g transform="translate(284 780) scale(.28125)">${innerSvg(appleIcon)}</g>` +
    `<defs><clipPath id="launcher-circle"><circle cx="576" cy="852" r="72"/></clipPath></defs>` +
    `<g clip-path="url(#launcher-circle)"><g transform="translate(504 780) scale(.28125)">${innerSvg(maskable)}</g></g>` +
    text("APP ICON", 64, 966, 16, C.mist, 1, ui) +
    text("APPLE TOUCH", 284, 966, 16, C.mist, 1, ui) +
    text("MASKABLE", 504, 966, 16, C.mist, 1, ui) +
    [16, 32, 48]
      .map(
        (n, i) =>
          `<g transform="translate(${760 + i * 150} ${852 - n / 2}) scale(${n / 32})">${innerSvg(favicon)}</g>${text(n + " PX", 760 + i * 150, 966, 16, C.mist, 1, ui)}`,
      )
      .join("") +
    text(
      "One brand. Purpose-built for every size.",
      64,
      1040,
      20,
      C.muted,
      0,
      ui,
    ),
);
await save(
  "docs/brand/meta-assets-preview.svg",
  metaPreview,
  1280,
  1080,
  "Share and icon contact sheet; favicons shown at actual size",
);
await raster(
  "docs/brand/meta-assets-preview.png",
  metaPreview,
  1280,
  1080,
  "Share and icon visual review",
);
const swatches = Object.entries(C)
  .filter(([name]) => name !== "muted")
  .map(
    ([name, color], i) =>
      `<rect x="${64 + i * 230}" y="658" width="204" height="80" rx="4" fill="${color}" stroke="#64748B"/>${text(name.toUpperCase(), 64 + i * 230, 770, 22, C.white, 2)}${text(color, 64 + i * 230, 800, 16, C.mist, 0, ui)}`,
  )
  .join("");
const board = svg(
  1280,
  1080,
  `<rect width="1280" height="1080" fill="${C.night}"/>${text("BETWEEN THE LINES / IDENTITY SYSTEM", 64, 54, 20, C.muted, 3)}<g transform="translate(64 142) scale(1.5)">${logo("horizontal", C.white, C.green)[2]}</g><rect x="830" y="90" width="386" height="370" rx="8" fill="${C.white}"/><g transform="translate(863 110)">${logo("stacked", C.night, "#15803D")[2]}</g>${text("MORE THAN THE SCORE.", 64, 445, 66, C.white, 1)}${text("Football insights that go deeper.", 64, 494, 24, C.mist, 0, ui)}${text("01 / HALFWAY LINE + ONE TACTICAL ROUTE", 64, 606, 20, C.muted, 2)}${swatches}${text("BARLOW CONDENSED / DISPLAY", 64, 901, 38, C.white, 1)}${text("Inter / Clear, precise, readable.", 64, 950, 28, C.mist, 0, ui)}<g transform="translate(950 845) scale(1.75)">${mark()}</g>${text("ORIGINAL VECTOR ARTWORK • 2026", 64, 1030, 14, C.muted, 2, ui)}`,
);
await save(
  "docs/brand/identity-preview.svg",
  board,
  1280,
  1080,
  "Identity overview",
);
await raster(
  "docs/brand/identity-preview.png",
  board,
  1280,
  1080,
  "Identity overview preview",
);
await copyFile(
  "node_modules/@fontsource/barlow-condensed/LICENSE",
  "docs/brand/Barlow-OFL.txt",
);
await copyFile(
  "node_modules/@fontsource-variable/inter/LICENSE",
  "docs/brand/Inter-OFL.txt",
);
await writeFile(
  "docs/brand/asset-inventory.json",
  JSON.stringify(inventory, null, 2) + "\n",
);
console.log(`Generated ${inventory.length} original assets.`);

// Keep the documentation token reference synchronized with shipped CSS.
const css = await readFile("src/app/brand-tokens.css", "utf8");
const declarations = (blocks) =>
  Object.fromEntries(
    blocks.flatMap((block) =>
      [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2]]),
    ),
  );
const dark = declarations(
  [...css.matchAll(/:root\s*\{([^}]+)\}/g)].map((m) => m[1]),
);
const light = {
  ...dark,
  ...declarations(
    [...css.matchAll(/:root\[data-theme="light"\]\s*\{([^}]+)\}/g)].map(
      (m) => m[1],
    ),
  ),
};
await writeFile(
  "docs/brand/brand-tokens.json",
  JSON.stringify(
    {
      palette: C,
      themes: { dark, light },
      typography: {
        ui: "Inter",
        display: "Barlow Condensed",
        displayWeight: 700,
        numerals: "tabular-nums",
      },
      spacingUnit: 4,
    },
    null,
    2,
  ) + "\n",
);
await writeFile(
  "docs/brand/ASSETS.md",
  "# Between the Lines — asset inventory\n\nGenerated with `npm run brand:build`. SVG type is outlined. Transparent PNG logo exports are 4× the SVG canvas dimensions. Dark variants use light ink; light variants use dark ink. All social artwork is original vector composition.\n\n| Asset | Dimensions | Bytes | Purpose |\n| --- | --- | ---: | --- |\n" +
    inventory
      .map(
        (a) =>
          `| [${a.file}](${a.file.startsWith("docs/brand/") ? a.file.slice(11) : "../../" + a.file}) | ${a.width} × ${a.height} | ${a.bytes} | ${a.role} |`,
      )
      .join("\n") +
    "\n\nSupporting files: [Inter license](Inter-OFL.txt), [Barlow license](Barlow-OFL.txt), [semantic tokens](brand-tokens.json), [guidelines](README.md), [review screenshots](REVIEW.md).\n",
);
