#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");
const CANON_DIR = path.join(
  ROOT,
  "4-Dokument-Underlag",
  "01-acceptans",
  "kundportal-losenordsfri-pwa-v1",
);

const CANON_FILES = [
  "ACCEPTANCE-MATRIX.md",
  "COMPONENTS.md",
  "COPY.md",
  "FEATURE-MATRIX.md",
  "Kundportal Passwordless Desktop.dc.html",
  "Kundportal Passwordless Mobil.dc.html",
  "Kundportal Passwordless States.dc.html",
  "README.md",
  "SPEC.md",
  "TOKENS.md",
].sort();

const HTML_FILES = {
  desktop: "Kundportal Passwordless Desktop.dc.html",
  mobile: "Kundportal Passwordless Mobil.dc.html",
  states: "Kundportal Passwordless States.dc.html",
};

let passCount = 0;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function audit(name, callback) {
  callback();
  passCount += 1;
  process.stdout.write(`PASS ${name}\n`);
}

function readCanon(name) {
  return fs.readFileSync(path.join(CANON_DIR, name), "utf8");
}

function sameArray(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
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
    .replace(/&bull;/gi, "•")
    .replace(/&times;/gi, "×");
}

function parseAttributes(rawTag) {
  const attributes = Object.create(null);
  const tagHead = rawTag.match(/^<\/?\s*[^\s/>]+/);
  const body = rawTag
    .slice(tagHead ? tagHead[0].length : 0)
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
  const sanitized = source
    .replace(/(<script\b[^>]*>)[\s\S]*?(<\/script>)/gi, "$1$2")
    .replace(/(<style\b[^>]*>)[\s\S]*?(<\/style>)/gi, "$1$2")
    .replace(/<!--[\s\S]*?-->/g, "");
  const root = { tag: "#document", attrs: Object.create(null), children: [] };
  const stack = [root];
  const voidTags = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
  ]);
  const tokenPattern = /<\/?[A-Za-z][^>]*>|[^<]+/g;

  for (const match of sanitized.matchAll(tokenPattern)) {
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
    const node = {
      tag,
      attrs: parseAttributes(token),
      children: [],
      rawTag: token,
    };
    parent.children.push(node);
    if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
  }
  return root;
}

function elements(node) {
  const output = [];
  function visit(current) {
    if (current.tag !== "#text" && current.tag !== "#document") output.push(current);
    for (const child of current.children || []) visit(child);
  }
  visit(node);
  return output;
}

function descendants(node, predicate) {
  return elements(node).filter(predicate);
}

function direct(node, tag) {
  return (node.children || []).filter((child) => child.tag === tag);
}

function attr(node, name) {
  return node?.attrs?.[name.toLowerCase()];
}

function hasClass(node, className) {
  return (attr(node, "class") || "").split(/\s+/).includes(className);
}

function textContent(node) {
  if (!node) return "";
  if (node.tag === "#text") return node.text;
  return (node.children || []).map(textContent).join("").replace(/\s+/g, " ").trim();
}

function byId(tree, id) {
  return descendants(tree, (node) => attr(node, "id") === id)[0] || null;
}

function articleByStateId(tree, stateId) {
  return (
    descendants(
      tree,
      (node) => node.tag === "article" && attr(node, "data-state-id") === stateId,
    )[0] || null
  );
}

function extractScripts(source) {
  return [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(
    (match) => ({ attrs: parseAttributes(`<script ${match[1]}>`), code: match[2] }),
  );
}

function extractStyles(source) {
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
    .map((match) => match[1])
    .join("\n");
}

function rootTokenMap(source) {
  const body = source.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
  assert(body, "Saknar :root-tokenblock");
  const clean = body.replace(/\/\*[\s\S]*?\*\//g, "");
  const tokens = new Map();
  for (const match of clean.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].replace(/\s+/g, ""));
  }
  return tokens;
}

function assertTokenMapsEqual(actual, expected, label) {
  assert(actual.size === expected.size, `${label}: ${actual.size}/${expected.size} tokens`);
  for (const [name, value] of expected) {
    assert(actual.get(name) === value, `${label}: token skiljer ${name}`);
  }
}

function assertListContract(container, label, expectedRows = null) {
  const lists = direct(container, "ul");
  assert(lists.length === 1, `${label}: kräver exakt ett direkt <ul>`);
  const rows = direct(lists[0], "li");
  assert(rows.length > 0, `${label}: listan saknar <li>`);
  for (const row of rows) {
    const links = direct(row, "a");
    assert(links.length === 1, `${label}: varje <li> ska ha exakt en direkt <a>`);
    assert(attr(links[0], "href"), `${label}: länkrad saknar href`);
  }
  if (expectedRows !== null) {
    assert(rows.length === expectedRows, `${label}: ${rows.length}/${expectedRows} rader`);
  }
}

function parseManifestFromTree(tree, source, label) {
  const inline = extractScripts(source).find(
    (script) => script.attrs.type === "application/manifest+json",
  );
  if (inline) return JSON.parse(inline.code.trim());

  const link = descendants(
    tree,
    (node) =>
      node.tag === "link" &&
      (attr(node, "rel") || "").split(/\s+/).includes("manifest"),
  )[0];
  assert(link, `${label}: manifest saknas`);
  const href = attr(link, "href");
  const prefix = "data:application/manifest+json,";
  assert(href?.startsWith(prefix), `${label}: manifestet ska vara inline data-URL`);
  return JSON.parse(decodeURIComponent(href.slice(prefix.length)));
}

function validSyntheticBookingUrl(href) {
  try {
    const url = new URL(href);
    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(".example") &&
      url.pathname === "/boka" &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function validSyntheticMapUrl(href) {
  try {
    const url = new URL(href);
    return (
      url.protocol === "https:" &&
      url.hostname === "maps.example" &&
      !url.hash
    );
  } catch {
    return false;
  }
}

try {
  const actualFiles = fs
    .readdirSync(CANON_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort();

  audit("exakt 10 kanonfiler", () => {
    assert(
      sameArray(actualFiles, CANON_FILES),
      `Kanonfiler avviker:\nväntat ${CANON_FILES.join(", ")}\nfick ${actualFiles.join(", ")}`,
    );
  });

  const sources = Object.fromEntries(
    Object.entries(HTML_FILES).map(([key, name]) => [key, readCanon(name)]),
  );
  const trees = Object.fromEntries(
    Object.entries(sources).map(([key, source]) => [key, parseHtml(source)]),
  );

  audit("SPEC ↔ States: exakt 100 State-ID", () => {
    const specIds = readCanon("SPEC.md")
      .split(/\r?\n/)
      .filter((line) => /^\|\s*ST-[A-Z0-9]+-\d+\s*\|/.test(line))
      .map((line) => line.match(/^\|\s*(ST-[A-Z0-9]+-\d+)/)[1]);
    const stateIds = descendants(
      trees.states,
      (node) => node.tag === "article" && attr(node, "data-state-id"),
    ).map((node) => attr(node, "data-state-id"));
    assert(specIds.length === 100, `SPEC har ${specIds.length}/100 State-ID`);
    assert(stateIds.length === 100, `States har ${stateIds.length}/100 State-ID`);
    assert(new Set(specIds).size === 100, "SPEC har duplicerade State-ID");
    assert(new Set(stateIds).size === 100, "States har duplicerade State-ID");
    assert(sameArray(stateIds, specIds), "SPEC och States skiljer i State-ID eller ordning");
  });

  audit("unika HTML-ID i Mobil/Desktop/States", () => {
    for (const [label, tree] of Object.entries(trees)) {
      const ids = descendants(tree, (node) => attr(node, "id") !== undefined).map(
        (node) => attr(node, "id"),
      );
      assert(ids.length === new Set(ids).size, `${label}: duplicerade HTML-ID`);
    }
  });

  audit("alla inline-script kompilerar", () => {
    for (const [label, source] of Object.entries(sources)) {
      for (const script of extractScripts(source)) {
        if (script.attrs.type === "application/manifest+json") continue;
        try {
          new Function(script.code);
        } catch (error) {
          fail(`${label}: inline-script kompilerar inte: ${error.message}`);
        }
      }
    }
  });

  audit("inga externa assets, nätverksanrop eller credentials", () => {
    const assetAttributes = {
      script: "src",
      img: "src",
      iframe: "src",
      audio: "src",
      video: "src",
      source: "src",
      embed: "src",
      object: "data",
    };
    for (const [label, tree] of Object.entries(trees)) {
      for (const node of elements(tree)) {
        let value = assetAttributes[node.tag] ? attr(node, assetAttributes[node.tag]) : null;
        if (
          node.tag === "link" &&
          ["stylesheet", "icon", "manifest", "preload", "modulepreload"].some((rel) =>
            (attr(node, "rel") || "").split(/\s+/).includes(rel),
          )
        ) {
          value = attr(node, "href");
        }
        assert(
          !value || !/^(?:https?:)?\/\//i.test(value),
          `${label}: extern asset ${value}`,
        );
      }
      const executable = extractScripts(sources[label])
        .filter((script) => script.attrs.type !== "application/manifest+json")
        .map((script) => script.code)
        .join("\n");
      assert(
        !/\bfetch\s*\(|\bXMLHttpRequest\b|\bsendBeacon\s*\(|\bWebSocket\s*\(|\bEventSource\s*\(/.test(
          executable,
        ),
        `${label}: nätverksprimitive hittad`,
      );
      assert(
        !/\b(?:authorization|bearer|api[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|password)\s*[:=]/i.test(
          executable,
        ),
        `${label}: möjlig credential hittad`,
      );
      assert(
        !descendants(tree, (node) => node.tag === "input").some(
          (node) => attr(node, "type") === "password",
        ),
        `${label}: password-input är förbjuden`,
      );
    }
  });

  audit("Mobil/Desktop screen+state-paritet", () => {
    const pairs = (tree) =>
      descendants(
        tree,
        (node) => attr(node, "data-screen") && attr(node, "data-state"),
      ).map((node) => `${attr(node, "data-screen")}/${attr(node, "data-state")}`);
    const mobilePairs = pairs(trees.mobile);
    const desktopPairs = pairs(trees.desktop);
    assert(mobilePairs.length > 0, "Mobil saknar screen/state-par");
    assert(new Set(mobilePairs).size === mobilePairs.length, "Mobil har duplicerade par");
    assert(new Set(desktopPairs).size === desktopPairs.length, "Desktop har duplicerade par");
    assert(sameArray(mobilePairs, desktopPairs), "Mobil/Desktop screen+state skiljer");
  });

  audit("huvudnav följer nav > ul > li > a", () => {
    for (const [label, tree] of Object.entries(trees)) {
      const navs = descendants(
        tree,
        (node) => node.tag === "nav" && attr(node, "aria-label") === "Huvudmeny",
      );
      assert(navs.length > 0, `${label}: saknar Huvudmeny`);
      for (const [index, nav] of navs.entries()) {
        assertListContract(nav, `${label} Huvudmeny ${index + 1}`, 3);
      }
    }
  });

  audit("bokningslistor följer section > ul > li > a", () => {
    for (const label of ["mobile", "desktop"]) {
      const sections = descendants(
        trees[label],
        (node) => node.tag === "section" && hasClass(node, "booking-list"),
      );
      assert(sections.length >= 4, `${label}: för få bokningslistor`);
      for (const [index, section] of sections.entries()) {
        assertListContract(section, `${label} bokningslista ${index + 1}`);
      }
    }

    const expectedSections = new Map([
      ["ST-HOME-02", 1],
      ["ST-HIST-01", 3],
      ["ST-HIST-03", 1],
      ["ST-HIST-04", 1],
    ]);
    for (const [stateId, expectedCount] of expectedSections) {
      const article = articleByStateId(trees.states, stateId);
      assert(article, `States saknar ${stateId}`);
      const panels = descendants(article, (node) => hasClass(node, "panel"));
      assert(panels.length === 1, `${stateId}: kräver exakt en panel`);
      const sections = direct(panels[0], "section");
      assert(sections.length === expectedCount, `${stateId}: fel antal sektioner`);
      for (const [index, section] of sections.entries()) {
        assertListContract(section, `${stateId} sektion ${index + 1}`);
      }
    }
  });

  audit("BookAgain- och kartåtgärder är riktiga länkar", () => {
    const bookAgainLabels = new Set(["Boka en tid till", "Boka ny tid", "Boka igen"]);
    let bookAgainCount = 0;
    let mapCount = 0;
    for (const [label, tree] of Object.entries(trees)) {
      const actions = elements(tree).filter(
        (node) =>
          attr(node, "data-tenant-booking") !== undefined ||
          (["a", "button", "span"].includes(node.tag) &&
            bookAgainLabels.has(textContent(node))),
      );
      assert(actions.length > 0, `${label}: saknar BookAgain-exempel`);
      for (const action of actions) {
        assert(action.tag === "a", `${label}: BookAgain måste vara <a>`);
        assert(
          validSyntheticBookingUrl(attr(action, "href")),
          `${label}: ogiltig BookAgain-URL ${attr(action, "href")}`,
        );
        bookAgainCount += 1;
      }

      const maps = elements(tree).filter(
        (node) =>
          ["tenantMap", "detailMap"].includes(attr(node, "id")) ||
          textContent(node) === "Öppna i karta",
      );
      assert(maps.length > 0, `${label}: saknar kartlänk`);
      for (const map of maps) {
        assert(map.tag === "a", `${label}: kartåtgärd måste vara <a>`);
        assert(
          validSyntheticMapUrl(attr(map, "href")),
          `${label}: ogiltig/självhashad kartlänk ${attr(map, "href")}`,
        );
        mapCount += 1;
      }
    }
    assert(bookAgainCount >= 12, `För få BookAgain-exempel: ${bookAgainCount}`);
    assert(mapCount >= 3, `För få kartlänkar: ${mapCount}`);
  });

  audit("BookAgain bevarar base/current/historic-kontext", () => {
    for (const label of ["mobile", "desktop"]) {
      const links = descendants(
        trees[label],
        (node) => node.tag === "a" && attr(node, "data-rebook-context") !== undefined,
      );
      const contexts = links.map((node) => attr(node, "data-rebook-context"));
      assert(contexts.filter((value) => value === "base").length === 2, `${label}: base-context`);
      assert(contexts.filter((value) => value === "current").length === 5, `${label}: current-context`);
      assert(contexts.filter((value) => value === "historic").length === 1, `${label}: historic-context`);
      for (const link of links) {
        const context = attr(link, "data-rebook-context");
        const url = new URL(attr(link, "href"));
        if (context === "current" || context === "historic") {
          assert(url.searchParams.has("service"), `${label}: ${context} tappar service`);
          assert(url.searchParams.has("location"), `${label}: ${context} tappar plats`);
        }
      }
      const script = extractScripts(sources[label]).map((item) => item.code).join("\n");
      assert(!script.includes("data-tenant-booking"), `${label}: legacy global base-overwrite finns kvar`);
      assert(
        /currentRebookUrl:["']https:\/\/[^"']+\.example\/boka\?[^"']*service=[^"']*&location=/.test(script) &&
          /historicRebookUrl:["']https:\/\/[^"']+\.example\/boka\?[^"']*service=[^"']*&location=/.test(script),
        `${label}: fixture saknar kontext-URL:er`,
      );
      assert(
        /\$\$\('\[data-rebook-context\]'\)[\s\S]{0,450}currentRebookUrl[\s\S]{0,250}historicRebookUrl/.test(
          script,
        ),
        `${label}: kontext-renderer saknas`,
      );
    }
  });

  audit("no-JS och fallback-länkar har riktiga produktmål", () => {
    assert(
      !sources.states.includes("inga riktiga länkar fungerar"),
      "States får inte påstå att produktlänkarna är döda",
    );

    const noJs = articleByStateId(trees.states, "ST-BOOT-03");
    const noJsLinks = descendants(noJs, (node) => node.tag === "a");
    assert(noJsLinks.length === 3, "ST-BOOT-03 ska ha exakt tre länkar");
    assert(
      attr(noJsLinks[0], "href") === "/aterhamta/freshcut",
      "ST-BOOT-03: ny kod ska gå till tenantens recovery",
    );
    assert(
      validSyntheticBookingUrl(attr(noJsLinks[1], "href")),
      "ST-BOOT-03: bokningssidan ska vara en syntetisk produkt-URL",
    );
    assert(
      attr(noJsLinks[2], "href") === "/hjalp",
      "ST-BOOT-03: hjälplänken ska gå till /hjalp",
    );

    for (const stateId of ["ST-LINK-01", "ST-LINK-02", "ST-LINK-05"]) {
      const article = articleByStateId(trees.states, stateId);
      const booking = descendants(
        article,
        (node) => node.tag === "a" && textContent(node) === "Till företagets bokningssida",
      );
      assert(booking.length === 1, `${stateId}: bokningslänk saknas`);
      assert(
        validSyntheticBookingUrl(attr(booking[0], "href")),
        `${stateId}: bokningslänken är självankrad eller ogiltig`,
      );
    }

    const blocked = articleByStateId(trees.states, "ST-DET-02");
    const publicContact = descendants(
      blocked,
      (node) => node.tag === "a" && textContent(node) === "deras webbplats",
    );
    assert(publicContact.length === 1, "ST-DET-02: publik kontaktlänk saknas");
    const contactUrl = new URL(attr(publicContact[0], "href"));
    assert(
      contactUrl.protocol === "https:" &&
        contactUrl.hostname.endsWith(".example") &&
        !contactUrl.hash,
      "ST-DET-02: publik kontaktlänk ska vara en syntetisk produkt-URL",
    );
  });

  audit("CP-CAN-06: riktig stängknapp", () => {
    for (const label of ["mobile", "desktop"]) {
      const overlay = byId(trees[label], "cancelOverlay");
      assert(overlay, `${label}: cancelOverlay saknas`);
      const close = descendants(
        overlay,
        (node) => node.tag === "button" && attr(node, "aria-label") === "Stäng",
      );
      assert(close.length === 1, `${label}: CP-CAN-06 ska vara exakt en button`);
    }
    for (const stateId of ["ST-CAN-01", "ST-CAN-02", "ST-CAN-04", "ST-CAN-05"]) {
      const article = articleByStateId(trees.states, stateId);
      const dialogs = descendants(article, (node) => attr(node, "role") === "dialog");
      assert(dialogs.length === 1, `${stateId}: dialog saknas`);
      const close = descendants(
        dialogs[0],
        (node) => node.tag === "button" && attr(node, "aria-label") === "Stäng",
      );
      assert(close.length === 1, `${stateId}: CP-CAN-06 ska vara button`);
    }
  });

  audit("cancelRetry är separat från destructive submit", () => {
    for (const label of ["mobile", "desktop"]) {
      const retry = byId(trees[label], "cancelRetry");
      const submit = byId(trees[label], "confirmCancel");
      assert(retry?.tag === "button", `${label}: cancelRetry ska vara button`);
      assert(submit?.tag === "button", `${label}: confirmCancel ska vara button`);
      assert(retry !== submit, `${label}: retry och submit får inte vara samma nod`);
      assert(textContent(retry) === "Försök igen", `${label}: fel retry-copy`);
      assert(textContent(submit) === "Ja, avboka", `${label}: fel submit-copy`);
      const script = extractScripts(sources[label]).map((item) => item.code).join("\n");
      assert(
        count(script, /\$\("#cancelRetry"\)\.addEventListener\("click",submitCancellation\)/g) === 1,
        `${label}: cancelRetry ska ha exakt en click-handler`,
      );
      assert(
        !/confirmCancel[^\n;]{0,160}(?:textContent|innerText|innerHTML)\s*=\s*["']Försök igen["']/.test(
          script,
        ),
        `${label}: destructive submit får aldrig retry-copy`,
      );
      assert(
        /outcome==="network"[\s\S]{0,500}confirmCancel"\)\.hidden=true[\s\S]{0,250}cancelRetry"\)\.hidden=false/.test(
          script,
        ),
        `${label}: network-error ska dölja submit och visa cancelRetry`,
      );
    }

    const state = articleByStateId(trees.states, "ST-CAN-04");
    const retry = descendants(
      state,
      (node) => node.tag === "button" && textContent(node) === "Försök igen",
    );
    assert(retry.length === 1, "ST-CAN-04 ska ha separat retry-button");
    assert(
      !descendants(state, (node) => textContent(node) === "Ja, avboka").length,
      "ST-CAN-04 får inte återanvända destructive submit",
    );
  });

  audit("PWA iOS/in-app kräver ett klick och Inte nu återför fokus", () => {
    for (const label of ["mobile", "desktop"]) {
      const tree = trees[label];
      const script = extractScripts(sources[label]).map((item) => item.code).join("\n");
      for (const [id, copy] of [
        ["showIosGuide", "Visa hur"],
        ["copyPortalLink", "Kopiera länken"],
        ["autoInstallDismiss", "Inte nu"],
      ]) {
        const control = byId(tree, id);
        assert(control?.tag === "button", `${label}: #${id} ska vara button`);
        assert(textContent(control) === copy, `${label}: #${id} har fel copy`);
      }
      assert(
        count(script, /\$\("#showIosGuide"\)\.addEventListener\("click",revealIosGuide\)/g) === 1,
        `${label}: iOS-guiden ska ha exakt en click-handler`,
      );
      assert(
        count(script, /\$\("#copyPortalLink"\)\.addEventListener\("click",copyPortalLink\)/g) === 1,
        `${label}: in-app copy ska ha exakt en click-handler`,
      );
      assert(
        count(script, /\$\("#autoInstallBtn"\)\.addEventListener\("click",requestInstall\)/g) === 1,
        `${label}: auto-PWA ska ha exakt en click-handler`,
      );
      assert(
        /if\(platform==="ios"\)\{show\("installera"\);revealIosGuide\(\);return\}/.test(script),
        `${label}: iOS-klick ska öppna guiden direkt`,
      );
      assert(
        /if\(platform==="in_app"\)\{show\("installera"\);copyPortalLink\(\);return\}/.test(
          script,
        ),
        `${label}: in-app-klick ska kopiera direkt`,
      );
      assert(
        byId(tree, "autoInstallText") &&
          /autoInstallText"\)\.textContent=platform==="in_app"\?"\u00d6ppna sidan i Safari för att lägga till den på hemskärmen"/.test(
            script,
          ),
        `${label}: autoerbjudandet saknar CP-APP-01 i in-app-läget`,
      );
      assert(
        count(
          script,
          /\$\("#autoInstallDismiss"\)\.addEventListener\("click",function\(\)\{dismissPwa\(true\)\}\)/g,
        ) === 1,
        `${label}: Inte nu ska ha exakt en handler med focus-flagga`,
      );
      assert(
        /function dismissPwa\(moveFocus\)[\s\S]{0,350}if\(moveFocus\)focusAfterAutoInstall\(\)/.test(
          script,
        ) &&
          /function focusAfterAutoInstall\(\)\{var target=\$\("#afterAutoInstall"\)\|\|\$\("#huvudinnehall"\);target\.focus\(\)\}/.test(
            script,
          ),
        `${label}: fokus återförs inte efter Inte nu`,
      );
      const autoCard = byId(tree, "autoInstall");
      const focusTarget = byId(tree, "afterAutoInstall");
      const ordered = elements(tree);
      assert(
        focusTarget &&
          attr(focusTarget, "tabindex") === "-1" &&
          ordered.indexOf(focusTarget) > ordered.indexOf(autoCard),
        `${label}: fokusmålet ska ligga efter autoerbjudandet`,
      );
    }

    const iosState = articleByStateId(trees.states, "ST-PWA-08");
    const inAppState = articleByStateId(trees.states, "ST-PWA-09");
    const androidOffline = articleByStateId(trees.states, "ST-PWA-03");
    assert(
      descendants(
        androidOffline,
        (node) => attr(node, "aria-disabled") === "true" && textContent(node) === "Lägg på hemskärmen",
      ).length === 1 &&
        textContent(androidOffline).includes("Kräver internetanslutning."),
      "ST-PWA-03 ska visa disabled Android-CTA och CP-PWA-06 offline-copy",
    );
    assert(
      !descendants(iosState, (node) => node.tag === "button").length,
      "ST-PWA-08 inline ska inte ha stäng-/installationsknapp",
    );
    assert(
      descendants(
        inAppState,
        (node) => node.tag === "button" && textContent(node) === "Kopiera länken",
      ).length === 1,
      "ST-PWA-09 ska visa exakt en riktig Kopiera länken-button",
    );
  });

  audit("PIN-styling använder kanoniska tokens", () => {
    const expected = rootTokenMap(readCanon("TOKENS.md"));
    assert(expected.size === 82, `TOKENS.md har ${expected.size}/82 tokens`);
    for (const [label, source] of Object.entries(sources)) {
      const css = extractStyles(source);
      assertTokenMapsEqual(rootTokenMap(css), expected, label);
      const selector = label === "states" ? "pinfield" : "pin-entry";
      const rule = css.match(new RegExp(`\\.${selector}\\s*\\{([\\s\\S]*?)\\}`))?.[1];
      assert(rule, `${label}: .${selector}-regel saknas`);
      for (const token of [
        "--tap-min",
        "--space-3",
        "--space-4",
        "--line-2",
        "--radius-field",
        "--surface-2",
        "--font-mono",
      ]) {
        assert(rule.includes(`var(${token})`), `${label}: PIN-regeln saknar ${token}`);
      }
      assert(
        /:focus-visible\s*\{[^}]*var\(--focus-ring-width\)[^}]*var\(--focus-ring\)[^}]*var\(--focus-ring-offset\)/.test(
          css,
        ),
        `${label}: tokeniserad focus-visible-ring saknas`,
      );
    }
  });

  audit("slutna status- och kanalvarianter finns i STATES", () => {
    const statusCard = articleByStateId(trees.states, "ST-HOME-04");
    const expectedStatuses = [
      "Förfrågan mottagen",
      "Bekräftad",
      "Genomförd",
      "Avbokad",
      "Uteblev",
      "Väntar på avslut",
      "Status uppdateras",
    ];
    for (const label of expectedStatuses) {
      assert(
        descendants(
          statusCard,
          (node) => node.tag === "span" && attr(node, "data-booking-status") && textContent(node) === label,
        ).length === 1,
        `ST-HOME-04 saknar statuschip ${label}`,
      );
    }
    const unknownStatus = descendants(
      statusCard,
      (node) => attr(node, "data-booking-status") === "unknown",
    )[0];
    assert(
      (attr(unknownStatus, "style") || "").includes("var(--warning)") &&
        descendants(unknownStatus, (node) => node.tag === "svg").length === 1,
      "ST-HOME-04 unknown ska bära --warning med ikon",
    );

    const deliveryFailed = articleByStateId(trees.states, "ST-PIN-09");
    for (const [channel, copy] of [
      ["sms", "SMS:et med koden kunde inte skickas. Försök igen eller ändra mobilnummer."],
      ["email", "Mejlet med koden kunde inte skickas. Försök igen eller ändra e-post."],
    ]) {
      assert(
        descendants(
          deliveryFailed,
          (node) =>
            attr(node, "data-channel") === channel &&
            attr(node, "role") === "alert" &&
            textContent(node).includes(copy),
        ).length === 1,
        `ST-PIN-09 saknar kanalriktig ${channel}-variant`,
      );
    }
    const channelVariants = descendants(
      deliveryFailed,
      (node) => attr(node, "data-channel") === "sms" || attr(node, "data-channel") === "email",
    );
    assert(
      channelVariants.filter((node) => !("hidden" in node.attrs)).length === 1,
      "ST-PIN-09 får bara visa en kanalvariant per rendering",
    );

    const gateway = articleByStateId(trees.states, "ST-S5-02");
    for (const [state, copy] of [
      ["gateway_persisted", "Bokningen är klar. Bekräftelsen är på väg till"],
      ["submitted", "Bekräftelsen är skickad till"],
      ["unknown", "Bokningen är klar. Vi kontrollerar leveransen av bekräftelsen."],
    ]) {
      assert(
        descendants(
          gateway,
          (node) =>
            attr(node, "data-delivery-status") === state &&
            attr(node, "role") === "status" &&
            textContent(node).includes(copy),
        ).length === 1,
        `ST-S5-02 saknar ${state}`,
      );
    }
    const deliveryVariants = descendants(gateway, (node) => attr(node, "data-delivery-status"));
    assert(
      deliveryVariants.filter((node) => !("hidden" in node.attrs)).length === 1,
      "ST-S5-02 får bara visa en leveransstatus per rendering",
    );
    assert(
      deliveryVariants.every((node) => descendants(node, (child) => child.tag === "svg").length === 1),
      "ST-S5-02:s statusvarianter ska bära föreskriven ikon",
    );
    assert(
      !descendants(gateway, (node) => attr(node, "data-delivery-status") === "unknown" && /igen/i.test(textContent(node))).length,
      "ST-S5-02 unknown får inte erbjuda dubblettsändning",
    );
  });

  audit("kontaktbyte visar hela resend-, konflikt- och kvittomatrisen", () => {
    const stepup = articleByStateId(trees.states, "ST-CCF-04");
    assert(
      descendants(stepup, (node) => node.tag === "button" && textContent(node) === "Skicka ny kod").length === 1,
      "ST-CCF-04 saknar resend-ready-knapp",
    );
    assert(
      descendants(
        stepup,
        (node) => attr(node, "role") === "status" && textContent(node) === "En ny kod har skickats.",
      ).length === 1,
      "ST-CCF-04 saknar omskicksbekräftelse",
    );

    const conflict = articleByStateId(trees.states, "ST-CCF-09");
    for (const [action, copy] of [
      ["phone", "Numret används redan. Kontakta Nordverk Bilservice så hjälper de dig."],
      ["email", "Uppgiften kan inte användas. Kontakta Nordverk Bilservice."],
    ]) {
      assert(
        descendants(
          conflict,
          (node) =>
            attr(node, "data-contact-action") === action &&
            attr(node, "role") === "alert" &&
            textContent(node) === copy,
        ).length === 1,
        `ST-CCF-09 saknar ${action}-konflikt`,
      );
    }
    const conflictVariants = descendants(conflict, (node) => attr(node, "data-contact-action"));
    assert(
      conflictVariants.filter((node) => !("hidden" in node.attrs)).length === 1,
      "ST-CCF-09 får bara visa en konfliktvariant per rendering",
    );

    const done = articleByStateId(trees.states, "ST-CCF-11");
    for (const [action, copy] of [
      ["change_phone", "Telefonnumret är ändrat."],
      ["add_phone", "Mobilnumret är tillagt."],
      ["change_email", "Kontaktuppgiften är bytt."],
    ]) {
      assert(
        descendants(
          done,
          (node) =>
            attr(node, "data-contact-action") === action &&
            attr(node, "role") === "status" &&
            textContent(node).includes(copy),
        ).length === 1,
        `ST-CCF-11 saknar ${action}-kvitto`,
      );
    }
    const receiptVariants = descendants(done, (node) => attr(node, "data-contact-action"));
    assert(
      receiptVariants.filter((node) => !("hidden" in node.attrs)).length === 1,
      "ST-CCF-11 får bara visa ett åtgärdskvitto per rendering",
    );
  });

  audit("Nordverk skiljer kundens e-postkontakt från publik företagskontakt", () => {
    for (const label of ["mobile", "desktop"]) {
      const script = extractScripts(sources[label]).map((item) => item.code).join("\n");
      const fixtureLine = script.split("\n").find((line) => line.includes("nordverk:{"));
      assert(fixtureLine && !fixtureLine.includes("phone:"), `${label}: Nordverk har tvetydigt kund-phone-fält`);
      assert(
        fixtureLine.includes('publicPhone:') && fixtureLine.includes('channel:"email"') && fixtureLine.includes('masked:"a•••@e•••.se"'),
        `${label}: Nordverk ska ha separat publik kontakt och e-postverifierad kund`,
      );
      assert(
        /tenantPhone"\)\.href="tel:"\+d\.publicPhone/.test(script) &&
          /contactChannel"\)\.textContent=d\.channel==="sms"\?"SMS":"E-post"/.test(script),
        `${label}: publik företagskontakt och verifierad kundkontakt ska ha separata datakällor`,
      );
      assert(
        /detailTel"\)\.hidden=!d\.bookingPlace\.publicPhone/.test(script) &&
          /detailTel"\)\.href="tel:"\+d\.bookingPlace\.publicPhone/.test(script) &&
          !/detailTel"\)\.href="tel:"\+d\.publicPhone/.test(script),
        `${label}: platsens Ring får aldrig falla tillbaka till central företagskontakt`,
      );
    }
  });

  audit("namnredigering låser hela formuläret under saving", () => {
    for (const label of ["mobile", "desktop"]) {
      const script = extractScripts(sources[label]).map((item) => item.code).join("\n");
      assert(
        /setState\("profil","saving"\)[\s\S]{0,220}nameInput"\)\.disabled=true[\s\S]{0,120}cancelName"\)\.disabled=true[\s\S]{0,120}saveName"\)\.disabled=true/.test(script),
        `${label}: saving ska låsa fält, Avbryt och Spara`,
      );
      assert(
        /delay\(function\(\)\{[\s\S]{0,240}nameInput"\)\.disabled=false[\s\S]{0,120}cancelName"\)\.disabled=false[\s\S]{0,120}saveName"\)\.disabled=false/.test(script),
        `${label}: saving ska låsa upp alla tre kontroller`,
      );
    }
  });

  audit("manifest är Corevo-neutralt och fritt från PII", () => {
    const expected = {
      name: "Mina bokningar · Corevo",
      short_name: "Mina bokningar",
      id: "/mina/",
      start_url: "/mina/",
      scope: "/mina/",
      display: "standalone",
    };
    for (const [label, tree] of Object.entries(trees)) {
      const manifest = parseManifestFromTree(tree, sources[label], label);
      for (const [key, value] of Object.entries(expected)) {
        assert(manifest[key] === value, `${label}: manifest.${key} avviker`);
      }
      assert(Array.isArray(manifest.icons) && manifest.icons.length === 1, `${label}: ikon avviker`);
      const icon = manifest.icons[0];
      assert(icon.src?.startsWith("data:image/svg+xml"), `${label}: ikonen ska vara inline SVG`);
      assert(icon.sizes === "any", `${label}: icons.sizes avviker`);
      assert(icon.type === "image/svg+xml", `${label}: icons.type avviker`);
      assert(
        new Set((icon.purpose || "").split(/\s+/)).has("maskable"),
        `${label}: maskable-ikon saknas`,
      );
      const serialized = JSON.stringify(manifest);
      assert(
        !/(freshcut|nordverk|anna|alex|@|\+?46\s*7\d|bokning-[a-z0-9])/i.test(serialized),
        `${label}: manifestet innehåller möjlig PII/tenantdata`,
      );
      assert(!/[?#]/.test(manifest.id + manifest.start_url + manifest.scope), `${label}: state i URL`);
    }
  });

  process.stdout.write(`PROBE PASS · ${passCount} fail-fast-audits\n`);
} catch (error) {
  process.stderr.write(`PROBE FAIL · ${error.message}\n`);
  process.exitCode = 1;
}
