// Writes src/styles/dark.css from the light stylesheets, so dark mode follows the Figma design as it changes.
// Run `npm run theme:dark` after changing colours in portal.css or styles.css. `--check` fails if dark.css is stale.
// Node built ins only.
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCES = ['src/styles/portal.css', 'src/styles.css'];
const OUTPUT = 'src/styles/dark.css';

// Pieces that are dark on purpose in the design (navy sidebar, staff card, aqua banner and buttons) stay as they are.
const KEEP = /\.sidebar|\.location-|\.workspace-label|\.welcome|\.sun\b|\.island|\.wave|\.id-card|\.id-top|\.id-profile|\.portrait-|\.id-details|\.id-footer|\.primary-button|\.approve\b|\.success-state > div|\.today span|backdrop/;

// The dark surfaces, as OKLCH lightness: page, then cards a step above it, then lines a step above that.
const PAGE = 0.19;
const SURFACE = 0.255;
const LINE = 0.34;
const LIFTED_TEXT = 0.76;
const SURFACE_LIGHTNESS = 0.9;
const LINE_LIGHTNESS = 0.85;
// Text below this chroma is the design's blue grey (ink, muted). Above it, it's a status or accent colour.
const GREY_CHROMA = 0.07;
const TINT_CHROMA = 0.035;
// Neutral surfaces take the brand navy's hue, so dark Opro still feels like Opro rather than plain grey.
// Tinted ones (aqua, amber, coral pills) keep their own hue, strong enough to still read as that colour.
const NEUTRAL_CHROMA = 0.012;
const NAVY_TINT = 0.022;

const TEXT = /^(color|fill|stroke|caret-color|text-decoration-color)$/;
const BACKGROUND = /^background/;
const EDGE = /^(border|outline|box-shadow|column-rule)/;

// Custom properties by role. Anything not listed keeps its light value.
const VARIABLES = {
  '--ink': 'text', '--muted': 'text', '--line': 'line', '--bg': 'page', '--aqua-light': 'background',
  '--color-canvas': 'page', '--color-card': 'background', '--color-line': 'line', '--color-ink': 'text', '--color-soft': 'text',
  '--color-sea-soft': 'background', '--color-coral-soft': 'background', '--color-ok-soft': 'background', '--color-late-soft': 'background',
  '--color-danger-soft': 'background', '--color-leave-soft': 'background',
  '--color-coral': 'text', '--color-ok': 'text', '--color-late': 'text', '--color-danger': 'text', '--color-leave': 'text', '--color-sea-dark': 'text',
};

// ---- Colour maths: sRGB <-> OKLCH (Björn Ottosson's OKLab) ----
const toLinear = (channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
const toGamma = (channel) => (channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055);

const toOklch = ([red, green, blue]) => {
  const [r, g, b] = [red, green, blue].map((channel) => toLinear(channel / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bAxis = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { lightness, chroma: Math.hypot(a, bAxis), hue: Math.atan2(bAxis, a) };
};

const fromOklch = ({ lightness, chroma, hue }) => {
  const a = chroma * Math.cos(hue);
  const bAxis = chroma * Math.sin(hue);
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * bAxis) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * bAxis) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * bAxis) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map(toGamma);
};

// Keeps the hue and lightness, giving up chroma until the colour fits in sRGB.
const toRgb = (colour) => {
  for (let chroma = colour.chroma; chroma >= 0; chroma -= 0.002) {
    const channels = fromOklch({ ...colour, chroma });
    if (channels.every((channel) => channel >= -0.0001 && channel <= 1.0001)) {
      return channels.map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255));
    }
  }
  return fromOklch({ ...colour, chroma: 0 }).map((channel) => Math.round(Math.min(1, Math.max(0, channel)) * 255));
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((channel) => toLinear(channel / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (first, second) => {
  const [light, dark] = [luminance(first), luminance(second)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

// ---- Parsing colours in declaration values ----
const COLOUR = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|(?<![\w-])(?:white|black)(?![\w-])|var\(--[\w-]+\)/g;

const parseColour = (token, variables) => {
  if (token.startsWith('var(')) {
    const value = variables[token.slice(4, -1)];
    return value ? parseColour(value, variables) : undefined;
  }
  if (token === 'white') {
    return { rgb: [255, 255, 255], alpha: 1 };
  }
  if (token === 'black') {
    return { rgb: [0, 0, 0], alpha: 1 };
  }
  if (token.startsWith('#')) {
    const hex = token.length <= 5 ? [...token.slice(1)].map((digit) => digit + digit).join('') : token.slice(1);
    const channels = hex.match(/../g).map((pair) => parseInt(pair, 16));
    return { rgb: channels.slice(0, 3), alpha: channels.length === 4 ? channels[3] / 255 : 1 };
  }
  const parts = token.slice(token.indexOf('(') + 1, -1).split(/[\s,/]+/).filter(Boolean).map(Number);
  return { rgb: parts.slice(0, 3), alpha: parts[3] ?? 1 };
};

const hex = (rgb) => `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;

// The rules. Light surfaces turn into dark ones that keep a hint of their tint, dark text turns light,
// coloured text is lifted until it reads on dark, and anything already dark or see-through is left alone.
const NAVY_HUE = toOklch([0x10, 0x2d, 0x3f]).hue;
const surfaceTint = (colour) =>
  colour.chroma < NEUTRAL_CHROMA ? { hue: NAVY_HUE, chroma: NAVY_TINT } : { hue: colour.hue, chroma: Math.min(Math.max(colour.chroma, NAVY_TINT), TINT_CHROMA) };

const darken = (role, { rgb, alpha }) => {
  const colour = toOklch(rgb);
  if (role === 'page') {
    return toRgb({ ...colour, ...surfaceTint(colour), lightness: PAGE });
  }
  if (alpha < 1) {
    return undefined;
  }
  if (role === 'text') {
    if (colour.lightness >= SURFACE_LIGHTNESS) {
      return undefined;
    }
    return colour.chroma < GREY_CHROMA
      ? toRgb({ ...colour, chroma: Math.min(colour.chroma, NAVY_TINT), lightness: Math.min(0.96, Math.max(0.5, 0.96 - (colour.lightness - 0.25) * 0.62)) })
      : toRgb({ ...colour, lightness: Math.max(colour.lightness, LIFTED_TEXT) });
  }
  if (role === 'background' && colour.lightness >= SURFACE_LIGHTNESS) {
    return toRgb({ ...colour, ...surfaceTint(colour), lightness: SURFACE + (1 - colour.lightness) * 0.9 });
  }
  if (role === 'line' && colour.lightness >= LINE_LIGHTNESS) {
    // A pure white edge is a cut out against the card, so it matches the card.
    const lightness = colour.lightness > 0.999 ? SURFACE : LINE - (1 - colour.lightness) * 0.4;
    return toRgb({ ...colour, ...surfaceTint(colour), lightness });
  }
  return undefined;
};

const roleOf = (property) => (TEXT.test(property) ? 'text' : BACKGROUND.test(property) ? 'background' : EDGE.test(property) ? 'line' : undefined);

// ---- A small CSS parser: rules, nesting with &, @media and @layer. Enough for these two files. ----
const parse = (css) => {
  let index = 0;
  const block = () => {
    const nodes = [];
    let buffer = '';
    while (index < css.length) {
      const char = css[index++];
      if (char === '{') {
        nodes.push({ header: buffer.trim(), children: block() });
        buffer = '';
      } else if (char === '}') {
        break;
      } else if (char === ';') {
        nodes.push({ declaration: buffer.trim() });
        buffer = '';
      } else {
        buffer += char;
      }
    }
    if (buffer.trim()) {
      nodes.push({ declaration: buffer.trim() });
    }
    return nodes;
  };
  return block();
};

const splitSelectors = (header) => {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of header) {
    depth += char === '(' ? 1 : char === ')' ? -1 : 0;
    if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  return [...parts, current.trim()].filter(Boolean);
};

const SKIPPED_AT_RULES = /^@(keyframes|font-face|import|supports|apply|custom-variant|source|plugin)/;

// Flattens everything into { selectors, media, property, value } in source order.
const flatten = (nodes, selectors = [], media = []) =>
  nodes.flatMap((node) => {
    if (node.declaration !== undefined) {
      const split = node.declaration.indexOf(':');
      if (node.declaration.startsWith('@') || split < 0) {
        return [];
      }
      return [{ selectors, media, property: node.declaration.slice(0, split).trim(), value: node.declaration.slice(split + 1).trim() }];
    }
    const { header, children } = node;
    if (header.startsWith('@media')) {
      // Print stays light, like paper.
      return header.includes('print') ? [] : flatten(children, selectors, [...media, header.slice('@media'.length).trim()]);
    }
    if (header.startsWith('@layer')) {
      return flatten(children, selectors, media);
    }
    if (header.startsWith('@theme')) {
      return flatten(children, [':root'], media);
    }
    if (SKIPPED_AT_RULES.test(header)) {
      return [];
    }
    const own = splitSelectors(header);
    const resolved = selectors.length
      ? selectors.flatMap((parent) => own.map((part) => (part.includes('&') ? part.replaceAll('&', parent) : `${parent} ${part}`)))
      : own;
    return flatten(children, resolved, media);
  });

// ---- Build ----
const strip = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const declarations = SOURCES.flatMap((file) => flatten(parse(strip(readFileSync(file, 'utf8')))));
const variables = Object.fromEntries(declarations.filter(({ selectors, property }) => selectors.includes(':root') && property.startsWith('--')).map(({ property, value }) => [property, value]));

const overridden = new Set();
const changes = [];
const report = [];
const card = darken('background', { rgb: [255, 255, 255], alpha: 1 });

for (const { selectors, media, property, value } of declarations) {
  const isVariable = property.startsWith('--');
  const role = isVariable ? (selectors.includes(':root') ? VARIABLES[property] : undefined) : roleOf(property);
  if (!role || selectors.some((selector) => KEEP.test(selector))) {
    continue;
  }
  let changed = false;
  const next = value.replace(COLOUR, (token) => {
    // A variable that gets its own dark value is left as a reference, so it follows that value.
    if (token.startsWith('var(') && overridden.has(token.slice(4, -1))) {
      return token;
    }
    const colour = parseColour(token, variables);
    const dark = colour && darken(role, colour);
    if (!dark) {
      return token;
    }
    changed = true;
    if (role === 'text') {
      report.push({ selector: selectors[0], from: token, to: hex(dark), ratio: contrast(dark, card) });
    }
    return colour.alpha < 1 ? `rgba(${dark.join(', ')}, ${colour.alpha})` : hex(dark);
  });
  if (changed) {
    if (isVariable) {
      overridden.add(property);
    }
    changes.push({ selectors, media, property, value: next });
  }
}

// One theme, written for both ways in: an explicit choice, or the system setting when nothing is chosen.
const scope = (prefix, selectors) =>
  selectors.map((selector) => (/^(:root|html)\b/.test(selector) ? selector.replace(/^(:root|html)/, prefix) : `${prefix} ${selector}`)).join(',\n');

const render = (prefix) => {
  const byMedia = Map.groupBy(changes, ({ media }) => media.join(' and '));
  return [...byMedia]
    .map(([media, entries]) => {
      const rules = entries.map(({ selectors, property, value }) => `${scope(prefix, selectors)} {\n  ${property}: ${value};\n}`).join('\n');
      return media ? `@media ${media} {\n${rules}\n}` : rules;
    })
    .join('\n');
};

const css = `/* Generated by scripts/build-dark-theme.mjs from ${SOURCES.join(' and ')}. Don't edit by hand: change the script and run npm run theme:dark. */

@media screen {
:root[data-theme='dark'] {
  color-scheme: dark;
}
${render(":root[data-theme='dark']")}
}

@media screen and (prefers-color-scheme: dark) {
:root:not([data-theme='light']) {
  color-scheme: dark;
}
${render(":root:not([data-theme='light'])")}
}
`;

if (process.argv.includes('--check')) {
  const current = readFileSync(OUTPUT, 'utf8');
  if (current !== css) {
    console.error(`${OUTPUT} is out of date. Run npm run theme:dark.`);
    process.exit(1);
  }
  console.log(`${OUTPUT} is up to date.`);
} else {
  writeFileSync(OUTPUT, css);
  const weak = report.filter(({ ratio }) => ratio < 4.5);
  console.log(`Wrote ${OUTPUT}: ${changes.length} colour changes, ${report.length} text colours checked against the dark card.`);
  weak.forEach(({ selector, from, to, ratio }) => console.log(`  under 4.5:1  ${ratio.toFixed(2)}  ${selector}  ${from} -> ${to}`));
}
