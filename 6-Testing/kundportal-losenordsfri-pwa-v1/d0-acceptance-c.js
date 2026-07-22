#!/usr/bin/env node
"use strict";

/*
 * D0, Del C: statisk, oberoende verifiering av kanonpaketet.
 *
 * Inga tredjepaket och ingen webbläsarsimulering. En rad får därför PASS
 * endast när hela dess Expected + Method kan avgöras från filer/DOM-källa.
 * Runtime-, viewport-, fokus- och produktionsgrindar blir uttryckliga SKIP.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const CANON = path.join(
  ROOT,
  "4-Dokument-Underlag",
  "01-acceptans",
  "kundportal-losenordsfri-pwa-v1",
);

const NAMES = {
  acceptance: "ACCEPTANCE-MATRIX.md",
  components: "COMPONENTS.md",
  copy: "COPY.md",
  features: "FEATURE-MATRIX.md",
  desktop: "Kundportal Passwordless Desktop.dc.html",
  mobile: "Kundportal Passwordless Mobil.dc.html",
  states: "Kundportal Passwordless States.dc.html",
  readme: "README.md",
  spec: "SPEC.md",
  tokens: "TOKENS.md",
};

const EXPECTED_FILES = Object.values(NAMES).sort();
const text = Object.fromEntries(
  Object.entries(NAMES).map(([key, name]) => [
    key,
    fs.readFileSync(path.join(CANON, name), "utf8"),
  ]),
);
const html = [text.mobile, text.desktop, text.states];

const results = [];

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  invariant(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${message}; expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

function containsAll(source, values, label) {
  for (const value of values) {
    invariant(source.includes(value), `${label}: missing ${JSON.stringify(value)}`);
  }
}

function pass(id, check) {
  try {
    check();
    results.push({ id, status: "PASS" });
  } catch (error) {
    results.push({ id, status: "FAIL", reason: error.message });
  }
}

function skip(id, reason) {
  results.push({ id, status: "SKIP", reason });
}

function unique(matches) {
  return [...new Set(matches)];
}

function section(source, startPattern, endPattern) {
  const start = source.search(startPattern);
  invariant(start >= 0, `section start not found: ${startPattern}`);
  const tail = source.slice(start);
  const relativeEnd = tail.slice(1).search(endPattern);
  return relativeEnd < 0 ? tail : tail.slice(0, relativeEnd + 1);
}

function stripExecutable(source) {
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function decodeEntities(value) {
  return String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&nbsp;/gi, "\u00a0")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&hellip;/gi, "…")
    .replace(/&times;/gi, "×");
}

function parseAttributes(rawTag) {
  const attributes = Object.create(null);
  const head = rawTag.match(/^<\/?\s*[^\s/>]+/);
  const body = rawTag
    .slice(head ? head[0].length : 0)
    .replace(/\/?\s*>$/, "");
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of body.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = decodeEntities(
      match[2] ?? match[3] ?? match[4] ?? "",
    );
  }
  return attributes;
}

function parseHtml(source) {
  const sanitized = stripExecutable(source);
  const root = { tag: "#document", attrs: {}, children: [] };
  const stack = [root];
  const voidTags = new Set([
    "area", "base", "br", "col", "embed", "hr", "img", "input", "link",
    "meta", "param", "source", "track", "wbr",
  ]);
  for (const match of sanitized.matchAll(/<\/?[A-Za-z][^>]*>|[^<]+/g)) {
    const token = match[0];
    const parent = stack[stack.length - 1];
    if (!token.startsWith("<")) {
      parent.children.push({ tag: "#text", text: decodeEntities(token) });
      continue;
    }
    if (/^<\//.test(token)) {
      const closing = token.match(/^<\/\s*([^\s>]+)/)?.[1]?.toLowerCase();
      for (let index = stack.length - 1; index > 0; index -= 1) {
        if (stack[index].tag === closing) {
          stack.length = index;
          break;
        }
      }
      continue;
    }
    const tag = token.match(/^<\s*([^\s/>]+)/)?.[1]?.toLowerCase();
    if (!tag) continue;
    const node = { tag, attrs: parseAttributes(token), children: [] };
    parent.children.push(node);
    if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
  }
  return root;
}

function elements(node) {
  const found = [];
  function walk(current) {
    if (!["#text", "#document"].includes(current.tag)) found.push(current);
    for (const child of current.children || []) walk(child);
  }
  walk(node);
  return found;
}

function query(node, predicate) {
  return elements(node).filter(predicate);
}

function attr(node, name) {
  return node?.attrs?.[name.toLowerCase()];
}

function nodeText(node) {
  if (!node) return "";
  if (node.tag === "#text") return node.text;
  return (node.children || [])
    .map(nodeText)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function byId(tree, id) {
  return query(tree, (node) => attr(node, "id") === id)[0] || null;
}

function stateArticle(stateId) {
  return (
    query(
      trees.states,
      (node) => node.tag === "article" && attr(node, "data-state-id") === stateId,
    )[0] || null
  );
}

function statePairs(tree) {
  return query(
    tree,
    (node) => attr(node, "data-screen") && attr(node, "data-state"),
  ).map((node) => `${attr(node, "data-screen")}/${attr(node, "data-state")}`);
}

function scripts(source) {
  return [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(
    (match) => ({ attrs: parseAttributes(`<script ${match[1]}>`), code: match[2] }),
  );
}

function css(source) {
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join("\n");
}

function rootTokens(source) {
  const body = source.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
  invariant(body, "missing :root token block");
  const map = new Map();
  for (const match of body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    map.set(match[1], match[2].replace(/\s+/g, ""));
  }
  return map;
}

function assertSameTokenMap(actual, expected, label) {
  invariant(actual.size === expected.size, `${label}: token count differs`);
  for (const [name, value] of expected) {
    invariant(actual.get(name) === value, `${label}: ${name} differs`);
  }
}

function manifest(source, label) {
  const inline = scripts(source).find(
    (item) => item.attrs.type === "application/manifest+json",
  );
  if (inline) return JSON.parse(inline.code.trim());
  const href = source.match(/<link\b[^>]*rel="manifest"[^>]*href="([^"]+)"/i)?.[1];
  invariant(href, `${label}: manifest missing`);
  const prefix = "data:application/manifest+json,";
  invariant(href.startsWith(prefix), `${label}: manifest is not inline data URL`);
  return JSON.parse(decodeURIComponent(href.slice(prefix.length)));
}

function copyRows() {
  const rows = new Map();
  for (const line of text.copy.split(/\r?\n/)) {
    const match = line.match(
      /^\|\s*(CP-[A-Z0-9-]+)\s*\|([^|]*)\|([^|]*)\|([^|]*)\|/,
    );
    if (match) {
      rows.set(match[1], {
        surface: match[2].trim(),
        kind: match[3].trim(),
        exact: match[4].trim(),
      });
    }
  }
  return rows;
}

function copyExact(id) {
  const row = copies.get(id);
  invariant(row, `COPY missing ${id}`);
  return row.exact.replace(/`/g, "");
}

function expectCopy(id, expected) {
  invariant(copyExact(id) === expected, `${id}: exact copy differs`);
}

function manifestChecks(callback) {
  for (const [label, source] of [
    ["mobile", text.mobile],
    ["desktop", text.desktop],
    ["states", text.states],
  ]) callback(manifest(source, label), label);
}

function hexLuminance(hex) {
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const a = hexLuminance(first);
  const b = hexLuminance(second);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function actionInventory(tree) {
  const controls = query(tree, (node) => ["a", "button"].includes(node.tag));
  return controls
    .filter((node) => !attr(node, "data-prototype"))
    .map((node) => {
      const href = attr(node, "href") || "";
      const route = attr(node, "data-route") || "";
      const action = attr(node, "data-security") || attr(node, "data-rebook-context") || "";
      return [node.tag, nodeText(node), href, route, action].join("|");
    })
    .sort();
}

function range(prefix, first, last, omissions = []) {
  const omitted = new Set(omissions);
  const ids = [];
  for (let value = first; value <= last; value += 1) {
    if (!omitted.has(value)) ids.push(`${prefix}${String(value).padStart(3, "0")}`);
  }
  return ids;
}

const trees = {
  mobile: parseHtml(text.mobile),
  desktop: parseHtml(text.desktop),
  states: parseHtml(text.states),
};
const copies = copyRows();
const canonicalTokens = rootTokens(text.tokens);

pass("ACC-C-001", () => {
  manifestChecks((value, label) => {
    invariant(value.name === "Mina bokningar · Corevo", `${label}: name differs`);
    invariant(value.short_name === "Mina bokningar", `${label}: short_name differs`);
  });
  containsAll(text.spec, ["Mina bokningar · Corevo", "Mina bokningar"], "SPEC §16");
  containsAll(text.components, ["Mina bokningar · Corevo", "Mina bokningar"], "COMPONENTS §23");
});

pass("ACC-C-002", () => {
  manifestChecks((value, label) => {
    for (const key of ["id", "start_url", "scope"]) {
      invariant(value[key] === "/mina/", `${label}: ${key} differs`);
    }
    invariant(value.display === "standalone", `${label}: display differs`);
    invariant(value.icons?.length === 1, `${label}: requires one neutral icon`);
    const icon = value.icons[0];
    invariant(icon.src?.startsWith("data:image/svg+xml"), `${label}: icon is not inline SVG`);
    invariant(icon.type === "image/svg+xml", `${label}: icon type differs`);
    invariant((icon.purpose || "").split(/\s+/).includes("maskable"), `${label}: maskable missing`);
  });
});

pass("ACC-C-003", () => {
  manifestChecks((value, label) => {
    const serialized = JSON.stringify(value);
    invariant(!/(freshcut|nordverk|tenant|alex|sara|@|\+?46\s*7\d)/i.test(serialized), `${label}: PII/tenant data in manifest`);
    invariant(!/[?#]/.test(value.id + value.start_url + value.scope), `${label}: query/fragment in manifest routes`);
  });
});

skip(
  "ACC-C-004",
  "produktgrind: service-worker-scope, network-only och verkligt cachebeteende kräver implementations- och runtimebevis utanför designpaketet",
);

pass("ACC-C-005", () => {
  const spec16 = section(text.spec, /^## 16\./m, /^## 17\./m);
  const spec20 = section(text.spec, /^## 20\./m, /^## 21\./m);
  const route = "app/api/customer-portal/manifest/route.ts";
  containsAll(spec16, ["Serveras via manifest-routen i filkartan (§20)"], "SPEC §16");
  containsAll(spec20, [route], "SPEC §20 file map");
});

pass("ACC-C-006", () => {
  const expectedStates = [
    "ST-PWA-01", "ST-PWA-02", "ST-PWA-03", "ST-PWA-04", "ST-PWA-05",
    "ST-PWA-06", "ST-PWA-07", "ST-PWA-10",
  ];
  for (const id of expectedStates) invariant(stateArticle(id), `missing ${id}`);
  for (const [label, source] of [["mobile", text.mobile], ["desktop", text.desktop]]) {
    containsAll(source, [
      'localStorage.getItem("corevo-pwa-offers-v1")',
      'localStorage.setItem("corevo-pwa-offers-v1",String(n))',
      "if(count>=2)",
      'setState("mina","pwa_dismissed_twice")',
      'setState("mina","pwa_accepted")',
    ], label);
    invariant(!/removeItem\(["']corevo-pwa-offers-v1/.test(source), `${label}: logout/reset clears offer counter`);
    invariant(!/savePwaCount\(0\)/.test(source), `${label}: offer counter can reset to zero`);
  }
});

pass("ACC-C-007", () => {
  expectCopy("CP-PWA-06", "Kräver internetanslutning.");
  const prompted = stateArticle("ST-PWA-03");
  invariant(prompted, "missing ST-PWA-03");
  invariant(query(prompted, (node) => attr(node, "aria-disabled") === "true").length === 1, "ST-PWA-03: offline CTA must be aria-disabled");
  invariant(nodeText(prompted).includes("Kräver internetanslutning."), "ST-PWA-03: CP-PWA-06 is absent");
  for (const [label, source] of [["mobile", text.mobile], ["desktop", text.desktop]]) {
    const requestBody = source.match(/function requestInstall\(\)\{([\s\S]*?)\n\}/)?.[1] || "";
    invariant(requestBody.includes("deferredInstallPrompt.prompt()"), `${label}: native prompt call missing from click target`);
    invariant(source.includes('$("#autoInstallBtn").addEventListener("click",requestInstall)'), `${label}: prompt is not bound to CTA click`);
    invariant(!/addEventListener\(["'](?:load|DOMContentLoaded)["'][\s\S]{0,500}\.prompt\(/.test(source), `${label}: prompt may run on load`);
  }
});

pass("ACC-C-008", () => {
  expectCopy("CP-PWA-05", "Så installerar du");
  for (const [label, tree, source] of [
    ["mobile", trees.mobile, text.mobile],
    ["desktop", trees.desktop, text.desktop],
  ]) {
    const help = byId(tree, "manualInstallHelp");
    invariant(help?.tag === "a", `${label}: CP-PWA-05 must be a link`);
    invariant(nodeText(help) === "Så installerar du", `${label}: CP-PWA-05 differs`);
    containsAll(source, [
      '$("#manualInstallBtn").hidden=platform==="android_no_event"',
      '$("#manualInstallHelp").hidden=platform!=="android_no_event"',
    ], label);
  }
});

pass("ACC-C-009", () => {
  const exact = [
    "Så lägger du till på hemskärmen",
    "Tryck på Dela",
    "Välj Lägg till på hemskärmen",
    "Tryck på Lägg till",
    "Klart — Mina bokningar finns på hemskärmen.",
  ];
  ["CP-IOS-02", "CP-IOS-03", "CP-IOS-04", "CP-IOS-05", "CP-IOS-06"]
    .forEach((id, index) => expectCopy(id, exact[index]));
  const inline = stateArticle("ST-PWA-08");
  containsAll(nodeText(inline), exact, "ST-PWA-08");
  invariant(query(inline, (node) => node.tag === "button").length === 0, "ST-PWA-08 inline guide has a close/button control");
  for (const tree of [trees.mobile, trees.desktop]) {
    invariant(nodeText(byId(tree, "showIosGuide")) === "Visa hur", "iOS CTA differs");
  }
});

pass("ACC-C-010", () => {
  const expected = [
    "Öppna sidan i Safari för att lägga till den på hemskärmen",
    "Kopiera länken",
    "Länken är kopierad",
    "1. Kopiera länken.",
    "2. Öppna Safari.",
    "3. Klistra in länken i adressfältet.",
    "Länken kunde inte kopieras. Markera och kopiera adressen manuellt.",
  ];
  ["CP-APP-01", "CP-APP-02", "CP-APP-03", "CP-APP-04", "CP-APP-05", "CP-APP-06", "CP-APP-08"]
    .forEach((id, index) => expectCopy(id, expected[index]));
  const state = stateArticle("ST-PWA-09");
  containsAll(nodeText(state), [expected[0], expected[1], expected[2], expected[6]], "ST-PWA-09");
  const orderedSteps = query(state, (node) => node.tag === "ol");
  invariant(orderedSteps.length === 1, "ST-PWA-09: requires exactly one ordered list");
  equal(
    query(orderedSteps[0], (node) => node.tag === "li").map(nodeText),
    ["Kopiera länken.", "Öppna Safari.", "Klistra in länken i adressfältet."],
    "ST-PWA-09 ordered steps differ",
  );
  invariant(!query(state, (node) => nodeText(node) === "Öppna i Safari" && ["a", "button"].includes(node.tag)).length, "unverified Open in Safari action rendered");
  for (const source of [text.mobile, text.desktop]) {
    containsAll(source, ["navigator.clipboard.writeText", expected[2], expected[6]], "in-app copy flow");
    invariant(!/(?:href|location)\s*=\s*["'][^"']*safari/i.test(source), "guessed Safari URL scheme found");
  }
});

pass("ACC-C-011", () => {
  expectCopy("CP-INST-03", "Appen är installerad.");
  containsAll(nodeText(stateArticle("ST-PWA-10")), ["Appen är installerad."], "ST-PWA-10");
  for (const source of [text.mobile, text.desktop]) {
    containsAll(source, [
      '$("#autoInstall").hidden=standalone||platform==="unsupported"',
      '$("#installStandalone").hidden=!standalone',
    ], "standalone source");
  }
});

pass("ACC-C-012", () => {
  expectCopy("CP-INST-02", "Din webbläsare stöder inte installation.");
  containsAll(nodeText(stateArticle("ST-PWA-01")), ["Din webbläsare stöder inte installation."], "ST-PWA-01");
  for (const [label, tree, source] of [
    ["mobile", trees.mobile, text.mobile],
    ["desktop", trees.desktop, text.desktop],
  ]) {
    invariant(query(tree, (node) => attr(node, "data-route") === "installera").length >= 2, `${label}: install page is gated/unreachable`);
    containsAll(source, ['platform==="unsupported"', 'count>=2', 'data-route="installera"'], label);
  }
});

pass("ACC-C-013", () => {
  expectCopy("CP-INST-01", "Installera – [Företag]");
  expectCopy("CP-INST-04", "Installera på hemskärmen");
  expectCopy("CP-REC-11", "Din session har gått ut. Verifiera dig igen.");
  for (const [label, tree, source] of [
    ["mobile", trees.mobile, text.mobile],
    ["desktop", trees.desktop, text.desktop],
  ]) {
    const page = byId(tree, "installera");
    const h1 = query(page, (node) => node.tag === "h1");
    invariant(h1.length === 1 && nodeText(h1[0]) === "Installera på hemskärmen", `${label}: install h1 differs`);
    const h2 = query(page, (node) => node.tag === "h2");
    invariant(h2.length >= 1 && nodeText(h2[0]) === "Ha dina bokningar nära till hands", `${label}: CP-PWA-01 h2 differs`);
    invariant(!nodeText(page).includes("Inte nu"), `${label}: install page contains Inte nu`);
    containsAll(source, ['installera:"Installera på hemskärmen"', 'document.title=pageTitles[id]+" – "+data().name'], label);
  }
  const expired = stateArticle("ST-PORT-03");
  containsAll(nodeText(expired), ["Din session har gått ut. Verifiera dig igen.", "Kom åt dina bokningar"], "ST-PORT-03");
  invariant(query(expired, (node) => attr(node, "role") === "status").length === 1, "ST-PORT-03: recovery toast missing");
  invariant(!/\b(?:Logga in|login|lösenord)\b/i.test(nodeText(expired)), "ST-PORT-03: login/password path found");
});

pass("ACC-C-014", () => {
  const state = stateArticle("ST-PORT-01");
  const skeletons = query(state, (node) => (attr(node, "class") || "").split(/\s+/).includes("skel"));
  invariant(skeletons.length >= 1, "ST-PORT-01: no skeletons");
  invariant(query(state, (node) => attr(node, "aria-hidden") === "true").length >= 1, "ST-PORT-01: skeleton wrapper not aria-hidden");
  invariant((nodeText(state).match(/Laddar innehåll/g) || []).length === 1, "ST-PORT-01: fallback must occur exactly once");
  invariant(!query(state, (node) => attr(node, "aria-live") || attr(node, "role") === "status").length, "ST-PORT-01: live-region spam found");
});

pass("ACC-C-015", () => {
  const state = stateArticle("ST-PORT-02");
  containsAll(nodeText(state), ["Bokningar", "Historik", "Profil", "Nästa bokning", "Visa bokningen", "Lägg i kalender", "Avboka"], "ST-PORT-02");
  invariant(query(state, (node) => node.tag === "nav" && attr(node, "aria-label") === "Huvudmeny").length === 1, "ST-PORT-02: shell navigation missing");
  for (const tree of [trees.mobile, trees.desktop]) {
    const normal = query(tree, (node) => attr(node, "data-screen") === "mina" && attr(node, "data-state") === "normal")[0];
    invariant(normal, "normal /mina screen missing");
    containsAll(nodeText(normal), ["NÄSTA BOKNING", "Fler kommande", "Boka ny tid"], "normal /mina");
  }
});

pass("ACC-C-016", () => {
  const state = stateArticle("ST-PORT-04");
  containsAll(nodeText(state), ["Något gick fel hos oss.", "Försök igen om en stund.", "Försök igen", "Felkod: CP-7F3K", "Hämtar…"], "ST-PORT-04");
  invariant(!/\b(database|SQL|500|stack(?:trace)?)\b/i.test(nodeText(state)), "ST-PORT-04 leaks database/stack terms");
});

pass("ACC-C-017", () => {
  const state = stateArticle("ST-PORT-05");
  containsAll(nodeText(state), ["Du är offline. Anslut till internet för att se aktuella bokningar.", "Försök igen", "Hämtar…"], "ST-PORT-05");
  invariant(!/(FreshCut|Nordverk|Alex|Sara|kr\b|\+46|@)/i.test(nodeText(state)), "ST-PORT-05 contains personal/tenant booking data");
  for (const source of [text.mobile, text.desktop]) {
    containsAll(source, ["Array.prototype.slice.call(screen.children).forEach", "child.hidden=true", 'box.id="offlineState"'], "offline replacement source");
  }
});

pass("ACC-C-018", () => {
  const specIds = text.spec
    .split(/\r?\n/)
    .filter((line) => /^\|\s*ST-[A-Z0-9]+-\d+\s*\|/.test(line))
    .map((line) => line.match(/^\|\s*(ST-[A-Z0-9]+-\d+)/)[1]);
  const stateIds = query(trees.states, (node) => node.tag === "article" && attr(node, "data-state-id"))
    .map((node) => attr(node, "data-state-id"));
  invariant(specIds.length === 100 && new Set(specIds).size === 100, `SPEC state registry is ${specIds.length}/100 or duplicated`);
  invariant(stateIds.length === 100 && new Set(stateIds).size === 100, `STATES registry is ${stateIds.length}/100 or duplicated`);
  equal(stateIds, specIds, "SPEC/STATES state registry differs");
  const galleryPairs = query(trees.states, (node) => node.tag === "article" && attr(node, "data-state-id"))
    .map((node) => `${attr(node, "data-screen")}/${attr(node, "data-state")}`);
  invariant(new Set(galleryPairs).size === 100, "STATES has duplicate screen/state pairs");
  invariant(galleryPairs.every((pair) => !pair.includes("undefined")), "STATES has an article without screen/state selector");
});

skip(
  "ACC-C-019",
  "browser/manual: synlig h1 per dynamisk vy, fungerande skip-länk och rubrikhierarki kräver renderad DOM/stateväxling",
);
skip(
  "ACC-C-020",
  "browser/manual: full tangentbordsnavigation, faktisk fokusordning och tillgängliga namn kräver webbläsare",
);
skip(
  "ACC-C-021",
  "browser/manual: fokusfälla, Esc-låsning och fokusåtergång kräver interaktiv dialogkörning",
);
skip(
  "ACC-C-022",
  "browser/manual: full live-region- och aria-describedby-inventering kräver renderade fel/successövergångar",
);
skip(
  "ACC-C-023",
  "browser/manual: 44×44 px för varje kontroll kräver computed layout i renderad DOM",
);

pass("ACC-C-024", () => {
  invariant(canonicalTokens.size === 82, `TOKENS contains ${canonicalTokens.size}/82 root tokens`);
  for (const [label, source] of [["mobile", text.mobile], ["desktop", text.desktop], ["states", text.states]]) {
    assertSameTokenMap(rootTokens(css(source)), canonicalTokens, label);
  }
  const pairs = [
    ["--ink-1", "--bg"], ["--ink-1", "--surface-1"], ["--ink-1", "--surface-2"],
    ["--ink-1", "--surface-3"], ["--ink-2", "--bg"], ["--ink-2", "--surface-1"],
    ["--ink-2", "--surface-2"], ["--ink-2", "--surface-3"], ["--ink-3", "--bg"],
    ["--ink-3", "--surface-1"], ["--positive", "--bg"], ["--positive", "--surface-1"],
    ["--warning", "--bg"], ["--negative", "--bg"], ["--action-text", "--action"],
  ];
  invariant(pairs.length === 15, "contrast sample must contain exactly 15 pairs");
  for (const [foreground, background] of pairs) {
    const ratio = contrast(canonicalTokens.get(foreground), canonicalTokens.get(background));
    invariant(ratio >= 4.5, `${foreground}/${background} contrast ${ratio.toFixed(2)} < 4.5`);
  }
});

skip(
  "ACC-C-025",
  "browser/manual: gråskaleprov av statuschips, navmarkering och felindikering kräver visuell rendering",
);
skip(
  "ACC-C-026",
  "browser/manual: 200 % zoom och textförstoring kräver viewportkörning med computed layout",
);
skip(
  "ACC-C-027",
  "browser/manual: 568×320 landscape med öppet tangentbord kräver verklig viewport- och keyboardemulering",
);
skip(
  "ACC-C-028",
  "browser/manual: reduced motion, prefers-contrast och forced-colors måste emuleras och visuellt verifieras",
);

pass("ACC-C-029", () => {
  const visible = [trees.mobile, trees.desktop, trees.states].map(nodeText).join("\n");
  invariant(!/\b20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2})?\b/.test(visible), "raw ISO date is visible in prototype markup");
  for (const tree of [trees.mobile, trees.desktop, trees.states]) {
    for (const node of elements(tree)) {
      const accessibleOverride = `${attr(node, "aria-label") || ""} ${attr(node, "title") || ""}`;
      invariant(!/\b20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2})?\b/.test(accessibleOverride), "raw ISO date is used as an accessible name");
    }
  }
  const samples = [
    "tors 24 juli · 14:30",
    "onsdag 22 juli · 11:00",
    "10 juni 2026",
    "Skapad 3 juli 2026",
    "Skapad 12 juni 2026",
  ];
  containsAll(visible, samples, "five readable Swedish date samples");
});

pass("ACC-C-030", () => {
  equal(statePairs(trees.mobile), statePairs(trees.desktop), "mobile/desktop screen-state contract differs");
  equal(actionInventory(trees.mobile), actionInventory(trees.desktop), "mobile/desktop link/action inventory differs");
  const spec25 = section(text.spec, /^## 25\./m, /^## 26\./m);
  containsAll(spec25, ["desktop introducerar inga egna funktioner", "Mobil", "Desktop", "samma kortordning, etiketter och actions"], "SPEC §25 parity law");
});

skip(
  "ACC-C-031",
  "browser/manual: above-fold-placering och onödigt tomrum måste mätas i samtliga sex riktiga viewports",
);
skip(
  "ACC-C-032",
  "browser/manual: scrollbotten och dialog/sheet med simulerat tangentbord kräver computed viewport-layout",
);

pass("ACC-C-033", () => {
  for (const [label, tree, source] of [
    ["mobile", trees.mobile, text.mobile],
    ["desktop", trees.desktop, text.desktop],
    ["states", trees.states, text.states],
  ]) {
    invariant(query(tree, (node) => node.tag === "img").length === 0, `${label}: image can break when logo/hero is absent`);
    invariant(!/logoUrl\s*:/.test(source), `${label}: fixture requires logoUrl`);
  }
  containsAll(text.mobile, ['freshcut:{name:"FreshCut",initials:"FC"', 'nordverk:{name:"Nordverk Bilservice",initials:"NB"'], "logo-free fixtures");
});

skip(
  "ACC-C-034",
  "browser/manual: datum- och prissträngars klippning måste mätas i samtliga sex viewports",
);

pass("ACC-C-035", () => {
  expectCopy("CP-DET-18", "Bokningen kunde inte visas");
  expectCopy("CP-CAL-04", "Kalenderfilen kunde inte skapas. Försök igen.");
  expectCopy("CP-CCF-29", "Numret används redan. Kontakta [Företag] så hjälper de dig.");
  expectCopy("CP-CCF-38", "Uppgiften kan inte användas. Kontakta [Företag].");
  containsAll(copies.get("CP-DET-18").surface, ["felaktigt id", "annan kund", "fel tenant", "EXAKT samma"], "CP-DET-18 ownership neutrality");
  containsAll(copies.get("CP-CAL-04").surface, ["Fel"], "CP-CAL-04 neutral calendar error");
  containsAll(text.copy, ["Ägarskapsfel ger exakt samma text som CP-CAL-04"], "COPY calendar ownership neutrality");
  const spec14 = section(text.spec, /^## 14\./m, /^## 15\./m);
  invariant(!/(merge|slå ihop)[\s\S]{0,80}(?:knapp|CTA)/i.test(spec14), "CCF conflict offers merge");
});

pass("ACC-C-036", () => {
  const recovery = section(text.spec, /^### 4\.2/m, /^### 4\.3/m);
  containsAll(recovery, ["träff", "icke-träff", "samma"], "SPEC recovery enumeration contract");
  for (const [label, source] of [["mobile", text.mobile], ["desktop", text.desktop]]) {
    const start = source.indexOf('$("#recoveryForm").addEventListener');
    const end = source.indexOf('$("#verifyForm").addEventListener', start);
    const handler = source.slice(start, end);
    invariant(start >= 0 && end > start, `${label}: recovery handler bounds missing`);
    containsAll(handler, ['show("verifiera")', 'd.channel==="sms"?"Koden skickades via SMS'], `${label} recovery handler`);
    invariant(!/(exists|found|not_found|unknown_customer|kunde inte hitta)/i.test(handler), `${label}: existence branch in recovery response`);
  }
});

pass("ACC-C-037", () => {
  const visible = html.map(stripExecutable).join("\n");
  invariant(!/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(visible), "UUID rendered in visible prototype markup");
  invariant(!/>[^<]*(?:tenantId|customerId|sessionId)[^<]*</i.test(visible), "internal ID name rendered in visible text");
  containsAll(text.spec, ["`tenantId` (aldrig renderat)", "`customerId` (aldrig renderat)", "route-param + sessionens datakontext"], "SPEC ID contract");
  containsAll(text.features, ["`id` är route-param, aldrig säkerhet"], "FEATURE ID contract");
});

pass("ACC-C-038", () => {
  for (const [label, tree] of [["mobile", trees.mobile], ["desktop", trees.desktop]]) {
    for (const id of ["contactValue", "bookingPinChannel", "verifyChannel"]) {
      const node = byId(tree, id);
      invariant(node, `${label}: missing destination node #${id}`);
      const value = nodeText(node);
      invariant(value.includes("•") || /Koden skickades/.test(value), `${label}: #${id} is not masked/neutral`);
      invariant(!/\b\d{6}\b/.test(value), `${label}: six-digit PIN rendered in #${id}`);
    }
    invariant(!query(tree, (node) => node.tag === "input" && /^\d{6}$/.test(attr(node, "value") || "")).length, `${label}: PIN value in input markup`);
  }
  const rendered = html.map(stripExecutable).join("\n");
  invariant(!/#<[A-Za-z-]*token>/i.test(rendered), "portal token rendered in visible markup");
});

pass("ACC-C-039", () => {
  for (const [label, source] of [["mobile", text.mobile], ["desktop", text.desktop]]) {
    containsAll(source, [
      'price:""',
      '$("#detailPriceCard").hidden=!d.price',
      'link.hidden=!url;if(url)link.href=url',
    ], `${label} optional rendering`);
    invariant(!/(?:price|pris)\s*:\s*["'](?:0|saknas|okänt|ej angivet)/i.test(source), `${label}: fabricated price fallback`);
  }
  containsAll(text.spec, ["publicRebookUrl", "renderas inte", "Pris aldrig fabricerat"], "SPEC optional contract");
});

pass("ACC-C-040", () => {
  for (const [label, source] of [["mobile", text.mobile], ["desktop", text.desktop]]) {
    const fixture = source.match(/nordverk:\{([\s\S]*?)\}\n\s*\};/)?.[1] || "";
    containsAll(fixture, [
      'channel:"email"', 'masked:"a•••@e•••.se"', 'price:""',
      'bookingPlace:{name:"Hälla"', 'upcomingPlace:"Erikslund',
      'historyPlaces:{completed:"Erikslund",cancelled:"Hälla",other:"Erikslund"',
    ], `${label} Nordverk fixture`);
    containsAll(source, ['$("#contactChannel").textContent=d.channel==="sms"?"SMS":"E-post"', '$("#contactValue").textContent=d.masked'], `${label} verified-contact union`);
  }
});

skip(
  "ACC-C-041",
  "browser/manual: overflow, radbrytning/trunkering och tillgänglig fulltext kräver computed layout i 320/390 px",
);

pass("ACC-C-042", () => {
  for (const [label, source] of [["mobile", text.mobile], ["desktop", text.desktop]]) {
    const fixture = source.match(/freshcut:\{([\s\S]*?)\},\n\s*nordverk:/)?.[1] || "";
    containsAll(fixture, [
      'channel:"sms"', 'masked:"•••• •• 00 00"', 'price:"329 kr"',
      'bookingPlace:{name:"FreshCut Linköping"', 'canBookAgain:true',
    ], `${label} FreshCut fixture`);
    containsAll(source, ['$("#detailPriceCard").hidden=!d.price', '$("#contactValue").textContent=d.masked'], `${label} conditional renderer`);
  }
});

pass("ACC-C-043", () => {
  const definitions = new Set(copies.keys());
  const referenced = new Set();
  for (const source of [text.spec, text.components, ...html]) {
    for (const match of source.matchAll(/CP-[A-Z0-9]+-\d+/g)) referenced.add(match[0]);
  }
  const missingCopy = [...referenced].filter((id) => !definitions.has(id));
  equal(missingCopy, [], "dead COPY references");

  const spec18 = section(text.spec, /^## 18\./m, /^## 19\./m);
  const components = [...spec18.matchAll(/^\|\s*\d+\s*\|\s*([A-Za-z][A-Za-z0-9]+)\s*\|/gm)]
    .map((match) => match[1]);
  invariant(components.length === 28 && new Set(components).size === 28, `SPEC §18 has ${components.length}/28 components`);
  const missingComponents = components.filter((name) => !text.components.includes(name));
  equal(missingComponents, [], "components absent from COMPONENTS.md");

  const tokenDefinitions = new Set(canonicalTokens.keys());
  const tokenReferences = new Set();
  for (const source of [text.spec, text.components, text.copy, ...html]) {
    for (const match of source.matchAll(/var\((--[a-z0-9-]+)\)|`(--[a-z0-9-]+)`/gi)) {
      tokenReferences.add(match[1] || match[2]);
    }
  }
  const missingTokens = [...tokenReferences].filter((name) => !tokenDefinitions.has(name));
  equal(missingTokens, [], "dead token references");
});

pass("ACC-C-044", () => {
  const actual = fs.readdirSync(CANON, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();
  equal(actual, EXPECTED_FILES, "canon directory must contain exactly ten files");
});

pass("ACC-C-045", () => {
  const featureIds = unique([...text.features.matchAll(/^\|\s*(FEAT-(?:NU|DOLD|MODE|LEG|GATE)-\d+)\s*\|/gm)].map((match) => match[1]));
  invariant(featureIds.filter((id) => id.startsWith("FEAT-NU-")).length === 22, "FEATURE-MATRIX must contain 22 NU rows");
  invariant(featureIds.filter((id) => id.startsWith("FEAT-DOLD-")).length === 12, "FEATURE-MATRIX must contain 12 DOLD rows");
  invariant(featureIds.filter((id) => id.startsWith("FEAT-MODE-")).length === 4, "FEATURE-MATRIX must contain 4 MODE rows");
  invariant(featureIds.filter((id) => id.startsWith("FEAT-LEG-")).length === 4, "FEATURE-MATRIX must contain 4 LEGACY rows");
  invariant(featureIds.filter((id) => id.startsWith("FEAT-GATE-")).length === 5, "FEATURE-MATRIX must contain 5 GATE rows");

  const nuTrace = {
    "FEAT-NU-01": ["ACC-A-019", ...range("ACC-B-", 1, 4)],
    "FEAT-NU-02": ["ACC-A-017", "ACC-A-018", "ACC-A-020", ...range("ACC-A-", 23, 26), "ACC-B-006", "ACC-C-015"],
    "FEAT-NU-03": [...range("ACC-B-", 6, 9), "ACC-B-013", "ACC-B-014"],
    "FEAT-NU-04": range("ACC-B-", 10, 12),
    "FEAT-NU-05": ["ACC-A-022", ...range("ACC-B-", 16, 19)],
    "FEAT-NU-06": ["ACC-B-017", ...range("ACC-B-", 20, 23)],
    "FEAT-NU-07": ["ACC-B-024"],
    "FEAT-NU-08": ["ACC-B-015"],
    "FEAT-NU-09": range("ACC-B-", 40, 42),
    "FEAT-NU-10": range("ACC-B-", 44, 45),
    "FEAT-NU-11": range("ACC-B-", 46, 53),
    "FEAT-NU-12": ["ACC-B-054", ...range("ACC-B-", 56, 58)],
    "FEAT-NU-13": range("ACC-B-", 55, 58),
    "FEAT-NU-14": [...range("ACC-B-", 59, 63), "ACC-C-035", "ACC-C-036"],
    "FEAT-NU-15": [...range("ACC-C-", 1, 8), ...range("ACC-C-", 11, 13)],
    "FEAT-NU-16": ["ACC-C-009"],
    "FEAT-NU-17": ["ACC-C-010"],
    "FEAT-NU-18": ["ACC-A-017"],
    "FEAT-NU-19": ["ACC-A-017"],
    "FEAT-NU-20": [...range("ACC-C-", 14, 18), "ACC-C-022", ...range("ACC-C-", 35, 38)],
    "FEAT-NU-21": range("ACC-B-", 26, 35),
    "FEAT-NU-22": range("ACC-B-", 36, 39),
  };
  equal(Object.keys(nuTrace).sort(), featureIds.filter((id) => id.startsWith("FEAT-NU-")).sort(), "NU semantic trace keys differ");

  const actualAcc = unique([...text.acceptance.matchAll(/ACC-[ABC]-\d{3}/g)].map((match) => match[0])).sort();
  const nonFunctionalTrace = {
    "META-CANON": [
      ...range("ACC-A-", 1, 10),
      ...range("ACC-C-", 43, 45),
      ...range("ACC-C-", 48, 50),
    ],
    "FEAT-DOLD-LEGACY": range("ACC-A-", 11, 16),
    "FEAT-GATE-01": ["ACC-A-017", "ACC-A-020"],
    "FEAT-GATE-02": [
      ...range("ACC-C-", 1, 5),
      "ACC-C-017", "ACC-C-037", "ACC-C-038", "ACC-C-046", "ACC-C-047",
    ],
    "FEAT-GATE-04": [
      "ACC-A-021", "ACC-A-022", ...range("ACC-A-", 27, 32), ...range("ACC-A-", 36, 40),
      ...range("ACC-C-", 19, 34),
    ],
    "FEAT-GATE-05": [
      ...range("ACC-A-", 33, 35),
      "ACC-C-033", ...range("ACC-C-", 39, 42),
    ],
  };
  const classified = new Set([
    ...Object.values(nuTrace).flat(),
    ...Object.values(nonFunctionalTrace).flat(),
  ]);
  const unclassified = actualAcc.filter((id) => !classified.has(id));
  const stale = [...classified].filter((id) => !actualAcc.includes(id));
  equal(unclassified, [], "acceptance rows outside feature/gate/meta trace");
  equal(stale, [], "trace references missing acceptance rows");
});

skip(
  "ACC-C-046",
  "extern produktgrind: gatewaykryptering, backuper, live Giada-revision och transporttester kan inte verifieras statiskt från detta designpaket",
);

pass("ACC-C-047", () => {
  const spec21 = section(text.spec, /^## 21\./m, /^## 22\./m);
  containsAll(spec21, ["INGA riktiga PIN-koder", "portal-tokens", "Designfasen får mocka", "får ALDRIG markera PIN-/portalflödena som driftklara"], "SPEC §21 deployment stop");
  const gate = text.features.split(/\r?\n/).find((line) => line.includes("FEAT-GATE-03")) || "";
  containsAll(gate, ["SMS-klartextblockeraren", "inga riktiga PIN-koder", "portal-tokens"], "FEAT-GATE-03");
  const row = text.acceptance.split(/\r?\n/).find((line) => line.includes("ACC-C-047")) || "";
  containsAll(row, ["INTE driftsättas", "prototypgodkännande ≠ driftklart", "EV-PROD-002"], "ACC-C-047 gate row");
});

skip(
  "ACC-C-048",
  "terminal kontroll: full slutsammanräkning kräver att samtliga 150 ACC-rader fått slutstatus och oberoende evidens",
);

pass("ACC-C-049", () => {
  const passRows = text.acceptance
    .split(/\r?\n/)
    .filter((line) => /^\|\s*ACC-[ABC]-\d{3}\s*\|/.test(line) && /\|\s*PASS\s+—/.test(line));
  invariant(passRows.length > 0, "matrix has no PASS rows to audit");
  for (const row of passRows) {
    const id = row.match(/ACC-[ABC]-\d{3}/)[0];
    invariant(/\[[^\]]+\]\([^\)]+\)/.test(row), `${id}: PASS lacks evidence link`);
  }
});

pass("ACC-C-050", () => {
  const spec28 = section(text.spec, /^## 28\./m, /^## 29\./m);
  containsAll(spec28, ["0 blockerare", "FÖRST efter 0 blockerare", "implementation får påbörjas", "0 FAIL"], "SPEC §28 implementation gate");
  const row = text.acceptance.split(/\r?\n/).find((line) => line.includes("ACC-C-050")) || "";
  containsAll(row, ["en (1) FAIL eller öppen BLOCKER", "PASS —", "ACC-C-046", "11 skriftliga undantag"], "ACC-C-050 documented gate decision");
});

const expectedIds = range("ACC-C-", 1, 50);
equal(results.map((result) => result.id), expectedIds, "result ledger must cover ACC-C-001–050 in order");

for (const result of results) {
  const suffix = result.reason ? ` — ${result.reason}` : "";
  process.stdout.write(`${result.status} ${result.id}${suffix}\n`);
}

const counts = Object.fromEntries(
  ["PASS", "SKIP", "FAIL"].map((status) => [
    status,
    results.filter((result) => result.status === status).length,
  ]),
);
process.stdout.write(
  `SUMMARY Del C · PASS ${counts.PASS} · SKIP ${counts.SKIP} · FAIL ${counts.FAIL}\n`,
);

if (counts.FAIL > 0) process.exitCode = 1;
