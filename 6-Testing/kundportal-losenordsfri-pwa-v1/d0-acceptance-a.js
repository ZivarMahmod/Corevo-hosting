#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const repoRoot = path.resolve(__dirname, "../..");
const canonDir = path.join(
  repoRoot,
  "4-Dokument-Underlag/01-acceptans/kundportal-losenordsfri-pwa-v1",
);
const briefPath = path.join(
  repoRoot,
  "4-Dokument-Underlag/02-design-brief/kundportal-losenordsfri-pwa-v1-designspec.md",
);

const canonNames = [
  "README.md",
  "SPEC.md",
  "Kundportal Passwordless Mobil.dc.html",
  "Kundportal Passwordless Desktop.dc.html",
  "Kundportal Passwordless States.dc.html",
  "TOKENS.md",
  "COMPONENTS.md",
  "COPY.md",
  "FEATURE-MATRIX.md",
  "ACCEPTANCE-MATRIX.md",
];
const htmlNames = canonNames.filter((name) => name.endsWith(".html"));
const canon = Object.fromEntries(
  canonNames.map((name) => [name, fs.readFileSync(path.join(canonDir, name), "utf8")]),
);
const brief = fs.readFileSync(briefPath, "utf8");

const results = { pass: [], skip: [], fail: [] };

function must(condition, message) {
  if (!condition) throw new Error(message);
}

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

function visibleText(source) {
  return source
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, " ")
    .replace(/<!--[^]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&aring;/gi, "å")
    .replace(/&auml;/gi, "ä")
    .replace(/&ouml;/gi, "ö")
    .replace(/&Aring;/g, "Å")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/\s+/g, " ")
    .trim();
}

function scripts(source) {
  return [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(
    ([, attributes, code]) => ({ attributes, code }),
  );
}

function styles(source) {
  return [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((match) => match[1]);
}

function rootTokens(css) {
  const block = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1];
  must(block, "saknar :root-tokenblock");
  const tokens = new Map();
  for (const match of block.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    tokens.set(match[1], match[2].trim().replace(/\s+/g, " "));
  }
  return { block, tokens };
}

function screenSlice(source, screen) {
  const marker = `data-screen="${screen}"`;
  const start = source.indexOf(marker);
  must(start >= 0, `saknar data-screen="${screen}"`);
  const next = source.indexOf('<section class="screen"', start + marker.length);
  return source.slice(start, next < 0 ? source.length : next);
}

function copyRows() {
  return canon["COPY.md"]
    .split(/\r?\n/)
    .map((line) => line.match(/^\| (CP-[A-Z0-9-]+) \|[^|]*\|[^|]*\| (.*?) \|/))
    .filter(Boolean)
    .map((match) => ({ id: match[1], text: match[2].replace(/`/g, "") }));
}

function assertSelfContained(name) {
  const source = canon[name];
  const forbidden = [
    [/<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=)[^>]*>/i, "extern stylesheet"],
    [/<script\b[^>]*\bsrc\s*=/i, "script src"],
    [/@import\b/i, "CSS @import"],
    [/url\(\s*["']?https?:/i, "extern CSS-url"],
    [/\bfetch\s*\(/i, "fetch"],
    [/\bXMLHttpRequest\b/i, "XMLHttpRequest"],
    [/\bnavigator\.sendBeacon\b/i, "sendBeacon"],
    [/\bWebSocket\s*\(/i, "WebSocket"],
    [/(?:google-analytics|googletagmanager|plausible|segment\.com|mixpanel)/i, "analytics"],
  ];
  for (const [pattern, label] of forbidden) {
    must(!pattern.test(source), `${name}: hittade ${label}`);
  }
  for (const match of source.matchAll(/\b(?:src|poster)\s*=\s*["']([^"']+)["']/gi)) {
    must(/^(?:data:|#|$)/.test(match[1]), `${name}: extern resurs ${match[1]}`);
  }
  for (const script of scripts(source)) {
    if (/type\s*=\s*["']application\/(?:manifest\+)?json["']/i.test(script.attributes)) {
      JSON.parse(script.code);
    } else {
      new vm.Script(script.code, { filename: name });
    }
  }
}

function assertNoSecretsOrRealCustomerData() {
  const joined = canonNames.map((name) => canon[name]).join("\n");
  const secretPatterns = [
    [/\bsk_(?:live|test|prod)_[A-Za-z0-9_-]{16,}\b/g, "API-nyckel"],
    [/\bsk-[A-Za-z0-9_-]{20,}\b/g, "API-nyckel"],
    [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, "JWT"],
    [/\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}\b/g, "Supabase-nyckel"],
    [/\bAKIA[0-9A-Z]{16}\b/g, "AWS-nyckel"],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "privat nyckel"],
    [/(?:postgres(?:ql)?|mysql):\/\/[^\s:@/]+:[^\s@/]+@/gi, "credential-URI"],
  ];
  for (const [pattern, label] of secretPatterns) {
    const match = pattern.exec(joined);
    must(!match, `${label} hittad: ${match?.[0]}`);
  }

  const personCandidates = joined.match(/\b(?:\d{8}|\d{6})[-+ ]?\d{4}\b/g) || [];
  for (const candidate of personCandidates) {
    const digits = candidate.replace(/\D/g, "");
    const birth = digits.length === 12 ? digits.slice(2, 8) : digits.slice(0, 6);
    const month = Number(birth.slice(2, 4));
    const day = Number(birth.slice(4, 6));
    must(!(month >= 1 && month <= 12 && day >= 1 && day <= 31), `personnummer hittad: ${candidate}`);
  }

  const allowedPhones = new Set(["4613123456", "46700000000", "46700000001", "0812345678"]);
  for (const name of canonNames) {
    const candidates = canon[name].match(/(?:\+46[0-9][0-9 ()-]{6,14}[0-9]|0[1-9][0-9 ()-]{5,13}[0-9])/g) || [];
    for (const candidate of candidates) {
      const normalized = candidate.replace(/\D/g, "");
      if (normalized.length < 9) continue;
      must(allowedPhones.has(normalized), `${name}: ej godkänt syntetiskt nummer ${candidate}`);
    }
    must(!/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(canon[name]), `${name}: omaskerad e-postadress`);
  }
  must(/helt \*\*syntetiska\*\*/.test(canon["README.md"]), "README saknar bindande syntetisk data-deklaration");
}

function assertCanonOrderAndSpotChecks() {
  const readme = canon["README.md"];
  const spec = canon["SPEC.md"];
  const tokens = canon["TOKENS.md"];
  const components = canon["COMPONENTS.md"];
  const copy = canon["COPY.md"];
  must(/designspec\.md[^\n]+\*\*\u00f6verordnad lag\*\*/i.test(readme), "README saknar brief som överordnad lag");
  const hierarchy = ["**Briefen**", "**TOKENS.md**", "**COMPONENTS.md**", "**COPY.md**", "**SPEC.md**"];
  let cursor = -1;
  for (const item of hierarchy) {
    const next = spec.indexOf(item, cursor + 1);
    must(next > cursor, `SPEC konfliktordning saknar/felplacerar ${item}`);
    cursor = next;
  }

  must(/\| `--bg` \| `#121210` \|/.test(brief), "brief: --bg är inte #121210");
  must(/--bg:\s*#121210;/.test(tokens), "TOKENS: --bg är inte #121210");
  for (const name of htmlNames) {
    must(rootTokens(styles(canon[name]).join("\n")).tokens.get("--bg") === "#121210", `${name}: --bg-konflikt`);
  }

  must(/Kort: 14–16 px hörnradie/.test(brief), "brief: kort-radie saknas");
  must(/--radius-card:\s*16px;/.test(tokens), "TOKENS: --radius-card är inte 16px");
  must(/`--radius-card`/.test(components), "COMPONENTS spårar inte --radius-card");

  must(/\| CP-TOP-01 \|[^\n]*\| COREVO \|/.test(copy), "COPY: CP-TOP-01 är inte COREVO");
  must(/COREVO \(CP-TOP-01\)/.test(spec), "SPEC spårar inte CP-TOP-01 COREVO");
  must(/textlogotyp `COREVO`/.test(brief), "brief: COREVO-logotyp saknas");

  must(/Desktop \| ≥1024px/.test(tokens), "TOKENS: desktop-breakpoint är inte 1024px");
  must(/Desktop, minst 1024 px/.test(brief), "brief: desktop-breakpoint är inte 1024px");
  must(/Desktop \| ≥1024px/.test(spec), "SPEC: desktop-breakpoint är inte 1024px");

  for (const source of [brief, spec, components, copy]) {
    must(source.includes("/mina/sakerhet"), "route-stickprov /mina/sakerhet saknas på en kanonnivå");
  }
}

function assertFeatureMatrix() {
  const rows = canon["FEATURE-MATRIX.md"]
    .split(/\r?\n/)
    .filter((line) => /^\| FEAT-(?:NU|DOLD|LEG)-\d+ \|/.test(line));
  must(rows.length === 38, `FEATURE-MATRIX har ${rows.length}/38 funktionsrader`);
  const counts = { NU: 0, "FÖRBEREDD/DOLD": 0, "LEGACY/BEVARAD": 0 };
  const ids = new Set();
  for (const row of rows) {
    const id = row.match(/^\| (FEAT-(?:NU|DOLD|LEG)-\d+) \|/)?.[1];
    const status = row.match(/\| (NU|FÖRBEREDD\/DOLD|LEGACY\/BEVARAD) \|/)?.[1];
    must(id && !ids.has(id), `saknat eller duplicerat FEAT-ID: ${id || row}`);
    must(status, `${id}: status utanför sluten lista`);
    must(/\| (?:brief|SPEC) §/.test(row), `${id}: brief-/SPEC-referens saknas`);
    ids.add(id);
    counts[status] += 1;
  }
  must(counts.NU === 22, `NU=${counts.NU}/22`);
  must(counts["FÖRBEREDD/DOLD"] === 12, `FÖRBEREDD/DOLD=${counts["FÖRBEREDD/DOLD"]}/12`);
  must(counts["LEGACY/BEVARAD"] === 4, `LEGACY/BEVARAD=${counts["LEGACY/BEVARAD"]}/4`);
}

function assertNoSocialLogin() {
  for (const name of htmlNames) {
    const text = visibleText(canon[name]);
    must(!/(?:fortsätt med|logga in med)\s+(?:google|apple|facebook|bankid)/i.test(text), `${name}: social login-copy`);
    const interactive = [...canon[name].matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)]
      .map((match) => visibleText(match[1]))
      .join(" ");
    must(!/\b(?:Google|Apple|Facebook|BankID)\b/i.test(interactive), `${name}: social login-kontroll`);
  }
}

function assertNoDeferredProductUi() {
  const copyText = copyRows()
    .filter(({ id }) => !id.startsWith("CP-NEG-"))
    .map(({ text }) => text)
    .join(" ");
  const uiText = htmlNames.map((name) => visibleText(canon[name])).join(" ") + " " + copyText;
  const forbidden = [
    /\bpush(?:notis(?:er)?)?\b/i,
    /aktivera notiser/i,
    /\berbjudande(?:n)?\b/i,
    /\bpoäng\b/i,
    /\blojalitet\b/i,
    /\bvarukorg\b/i,
    /\bwebshop\b/i,
  ];
  for (const pattern of forbidden) must(!pattern.test(uiText), `förbjuden UI-copy ${pattern}`);
}

function assertLegacyHidden() {
  const matrix = canon["FEATURE-MATRIX.md"];
  for (const id of ["FEAT-LEG-01", "FEAT-LEG-02"]) {
    const row = matrix.split(/\r?\n/).find((line) => line.startsWith(`| ${id} |`));
    must(row?.includes("| LEGACY/BEVARAD |"), `${id} är inte LEGACY/BEVARAD`);
  }
  for (const name of htmlNames) must(!/\/konto(?:\b|\/)/.test(canon[name]), `${name}: /konto exponeras`);
}

function assertTokenConsumption() {
  for (const name of htmlNames) {
    const css = styles(canon[name]).join("\n");
    const { block, tokens } = rootTokens(css);
    must(tokens.size >= 70, `${name}: bara ${tokens.size} tokens i :root`);
    const withoutRoot = css.replace(block, "");
    must(!/#[0-9a-f]{3,8}\b/i.test(withoutRoot), `${name}: hårdkodad hex utanför :root`);
    const references = [...withoutRoot.matchAll(/var\((--[\w-]+)\)/g)].map((match) => match[1]);
    must(references.length >= 20, `${name}: bara ${references.length}/20 var()-referenser`);
    for (const token of references) must(tokens.has(token), `${name}: odefinierad token ${token}`);
    const rawScaleDeclarations = [...withoutRoot.matchAll(
      /(?:padding(?:-[\w-]+)?|margin(?:-[\w-]+)?|(?:row-|column-)?gap|border-radius|font-size|line-height)\s*:\s*[^;}]*?\b(?:\d*\.)?\d+px\b/gi,
    )].map((match) => match[0].replace(/\s+/g, ""));
    for (const declaration of rawScaleDeclarations) {
      const documentedSkeletonRadius = name === htmlNames[2]
        && declaration === "border-radius:6px"
        && /text: 6px/.test(canon["TOKENS.md"]);
      must(documentedSkeletonRadius, `${name}: hårdkodat tokenområde ${declaration}`);
    }
    for (const token of [
      "--bg",
      "--radius-card",
      "--radius-field",
      "--focus-ring",
      "--focus-ring-width",
      "--focus-ring-offset",
      "--tap-min",
      "--button-primary-h",
    ]) {
      must(references.includes(token), `${name}: ${token} konsumeras inte`);
    }
  }
}

function pass(id, assertion) {
  try {
    assertion();
    results.pass.push(id);
    process.stdout.write(`PASS ${id}\n`);
  } catch (error) {
    results.fail.push(id);
    process.stderr.write(`FAIL ${id} — ${error.message}\n`);
    process.stderr.write(`SUMMARY PASS=${results.pass.length} SKIP=${results.skip.length} FAIL=1 TOTAL=${results.pass.length + results.skip.length + 1}\n`);
    process.exit(1);
  }
}

function skip(id, reason, staticPrecheck = () => {}) {
  try {
    staticPrecheck();
    results.skip.push(id);
    process.stdout.write(`SKIP ${id} — ${reason}\n`);
  } catch (error) {
    results.fail.push(id);
    process.stderr.write(`FAIL ${id} — statisk delkontroll: ${error.message}\n`);
    process.stderr.write(`SUMMARY PASS=${results.pass.length} SKIP=${results.skip.length} FAIL=1 TOTAL=${results.pass.length + results.skip.length + 1}\n`);
    process.exit(1);
  }
}

pass("ACC-A-001", () => {
  const actual = fs.readdirSync(canonDir).filter((name) => fs.statSync(path.join(canonDir, name)).isFile());
  must(actual.length === 10, `paketet har ${actual.length}/10 filer`);
  must(actual.slice().sort().join("\n") === canonNames.slice().sort().join("\n"), "filnamnen avviker från kanonlistan");
  const packageSection = canon["README.md"].split("## Paketets tio kanoniska filer (i ordning)")[1].split("## Öppna prototyperna")[0];
  const listed = [...packageSection.matchAll(/^\d+\. `([^`]+)`/gm)].map((match) => match[1]);
  must(listed.join("\n") === canonNames.join("\n"), "README:s filordning avviker");
});

skip("ACC-A-002", "NÄTVERK kräver webbläsare; GREP och inline-JS är godkända", () => assertSelfContained(htmlNames[0]));
skip("ACC-A-003", "NÄTVERK kräver webbläsare; GREP och inline-JS är godkända", () => assertSelfContained(htmlNames[1]));
skip("ACC-A-004", "NÄTVERK kräver webbläsare; GREP och inline-JS är godkända", () => assertSelfContained(htmlNames[2]));
skip("ACC-A-005", "DOM via verklig file://-webbläsare och konsol saknas", () => htmlNames.forEach(assertSelfContained));
pass("ACC-A-006", assertNoSecretsOrRealCustomerData);
pass("ACC-A-007", () => {
  const section = canon["README.md"].split("## Rekommenderad granskningsordning")[1].split("## Fixtures")[0];
  const expected = ["README.md", "SPEC.md", "TOKENS.md", "COMPONENTS.md", "COPY.md", ...htmlNames, "FEATURE-MATRIX.md", "ACCEPTANCE-MATRIX.md"];
  let cursor = -1;
  for (const name of expected) {
    const next = section.indexOf(name, cursor + 1);
    must(next > cursor, `granskningsordningen saknar/felplacerar ${name}`);
    cursor = next;
  }
});
pass("ACC-A-008", assertCanonOrderAndSpotChecks);
skip("ACC-A-009", "semantisk DOK-spårning av varje route/state/COPY-ID kan inte fullbevisas av statisk probe", () => {
  const specIds = new Set(canon["SPEC.md"].match(/\bCP-[A-Z0-9]+-\d{2}\b/g) || []);
  const copyIds = new Set(copyRows().map(({ id }) => id));
  for (const id of specIds) must(copyIds.has(id), `SPEC-ID ${id} saknas i COPY`);
  const stateIds = new Set(canon["SPEC.md"].match(/\bST-[A-Z0-9]+-\d{2}\b/g) || []);
  const galleryIds = new Set(canon[htmlNames[2]].match(/\bST-[A-Z0-9]+-\d{2}\b/g) || []);
  must(stateIds.size === 100, `SPEC har ${stateIds.size}/100 state-ID`);
  must(galleryIds.size === 100, `States har ${galleryIds.size}/100 state-ID`);
  for (const id of stateIds) must(galleryIds.has(id), `SPEC-state ${id} saknas i States`);
});
pass("ACC-A-010", assertFeatureMatrix);
skip("ACC-A-011", "DOM-formulärkontroll krävs utöver GREP", () => {
  for (const name of htmlNames) {
    must(!/type\s*=\s*["']password["']/i.test(canon[name]), `${name}: password-input`);
    const text = visibleText(canon[name]).replace(/Du använder inget lösenord\.?/gi, "");
    must(!/(?:skapa konto|registrera dig|logga in)/i.test(text), `${name}: login/signup-copy`);
  }
});
pass("ACC-A-012", assertNoSocialLogin);
skip("ACC-A-013", "DOM-session och fixturebeteende krävs utöver GREP", () => {
  for (const name of htmlNames) must(!/Mina företag/i.test(visibleText(canon[name])), `${name}: Mina företag i UI`);
});
pass("ACC-A-014", assertNoDeferredProductUi);
skip("ACC-A-015", "DOM-navens fullständighet krävs utöver GREP", () => {
  for (const name of htmlNames) must(!/(?:kommer snart|snart här)/i.test(visibleText(canon[name])), `${name}: kommer-snart-copy`);
});
pass("ACC-A-016", assertLegacyHidden);
skip("ACC-A-017", "DOM-routeetiketter krävs utöver DOK-tabellen", () => {
  const routeTable = canon["SPEC.md"].split("## 3. IA — full routetabell")[1].split("## 4. Route-för-route-kontrakt")[0];
  const expected = [
    "/oppna/[tenantSlug]#<token>", "/aterhamta/[tenantSlug]", "/verifiera/[tenantSlug]", "/hjalp", "/mina",
    "/mina/historik", "/mina/bokningar/[id]", "/mina/profil", "/mina/sakerhet", "/mina/installera", "/mina/integritet",
  ];
  for (const route of expected) must(routeTable.includes(`\`${route}\``), `SPEC saknar route ${route}`);
  must(count(routeTable, /^\| \d+ \|/gm) === expected.length, "SPEC-routetabellen har extra/saknade rader");
});
skip("ACC-A-018", "DOM-rendering och faktisk utlänk kräver webbläsare", () => {
  for (const name of htmlNames.slice(0, 2)) {
    const stepFive = screenSlice(canon[name], "steg5");
    must(/publicRebookUrl|Boka en tid till|Boka igen/.test(stepFive), `${name}: steg 5 saknar boka-igen-spår`);
  }
});
skip("ACC-A-019", "DOM-bootstrap, POST och tokenfri synlig URL kräver webbläsare", () => {
  must(/history\.replaceState/.test(canon[htmlNames[0]]), "Mobil saknar replaceState-simulering");
  must(/fragmentet bort/.test(canon["SPEC.md"]), "SPEC saknar fragmentborttagning");
});
skip("ACC-A-020", "DOM-separationen mellan de två hostlåsta listorna kräver webbläsare", () => {
  must(/Inloggade enheter/.test(canon["SPEC.md"]), "SPEC saknar portalsessionslista");
  must(/PIN-fria bokningsenheter/.test(canon["SPEC.md"]), "SPEC saknar booking-trust-lista");
});
skip("ACC-A-021", "DOM-steget måste renderas och inspekteras", () => {
  const exact = "Öppna länken i meddelandet";
  for (const name of htmlNames.slice(0, 2)) {
    const stepFive = screenSlice(canon[name], "steg5");
    must(stepFive.includes(exact), `${name}: CP-S5-03 saknas`);
    must(!/<a\b[^>]*href=["'][^"']*\/mina/i.test(stepFive), `${name}: steg 5 direktlänkar /mina`);
  }
});
skip("ACC-A-022", "DOM-deeplink, tillbaka och fokusflytt kräver webbläsare");
skip("ACC-A-023", "DOM-header i båda fixtures/viewports kräver webbläsare");
skip("ACC-A-024", "DOM-fixturebyte och oförändrat shell kräver webbläsare");
skip("ACC-A-025", "VIEW-jämförelse mobil/desktop kräver webbläsare");
skip("ACC-A-026", "DOM-navordning och aria-label kräver webbläsare", () => {
  for (const name of htmlNames.slice(0, 2)) {
    must(/<nav\b[^>]*aria-label="Huvudmeny"/i.test(canon[name]), `${name}: Huvudmeny-nav saknas`);
    must(/Bokningar[\s\S]*Historik[\s\S]*Profil/.test(canon[name]), `${name}: navordning saknas i källan`);
  }
});
skip("ACC-A-027", "VIEW-mätning vid 320/390 kräver webbläsare");
skip("ACC-A-028", "VIEW-mätning vid 768 kräver webbläsare");
skip("ACC-A-029", "VIEW-mätning och exakt en synlig navvariant kräver webbläsare");
skip("ACC-A-030", "DOM/computed style för aktiv navpost kräver webbläsare");
skip("ACC-A-031", "VIEW-mätning av fyra layoutbredder kräver webbläsare");
skip("ACC-A-032", "manuell VIEW-kontroll av alla sex viewports får inte automatiseras bort");
skip("ACC-A-033", "DOM-fixturebyte och atomär session kräver webbläsare");
skip("ACC-A-034", "DOM-bokningsplats/kontaktkort/flöde kräver webbläsare");
skip("ACC-A-035", "DOM i aktiv Nordverk-fixture krävs utöver GREP");
pass("ACC-A-036", assertTokenConsumption);
skip("ACC-A-037", "DOM computed styles krävs för typografiskalan");
skip("ACC-A-038", "DOM-stickprov på renderad spacing/radier krävs");
skip("ACC-A-039", "manuell tab-genomgång av varje kontroll + DOM-mätning krävs", () => {
  for (const name of htmlNames) {
    const css = styles(canon[name]).join("\n");
    const { tokens } = rootTokens(css);
    must(tokens.get("--focus-ring-width") === "2px", `${name}: focus-ring-width`);
    must(tokens.get("--focus-ring-offset") === "3px", `${name}: focus-ring-offset`);
    must(tokens.get("--tap-min") === "44px", `${name}: tap-min`);
    must(tokens.get("--button-primary-h") === "48px", `${name}: button-primary-h`);
  }
});
skip("ACC-A-040", "VIEW-scrollWidth vid 320/430 kräver webbläsare", () => {
  for (const name of htmlNames.slice(0, 2)) {
    const css = styles(canon[name]).join("\n");
    must(/env\(safe-area-inset-top\)/.test(css), `${name}: safe-area top saknas`);
    must(/env\(safe-area-inset-bottom\)/.test(css), `${name}: safe-area bottom saknas`);
  }
});

must(results.pass.length + results.skip.length === 40, "proben emitterade inte exakt 40 ACC-rader");
process.stdout.write(`SUMMARY PASS=${results.pass.length} SKIP=${results.skip.length} FAIL=0 TOTAL=40\n`);
