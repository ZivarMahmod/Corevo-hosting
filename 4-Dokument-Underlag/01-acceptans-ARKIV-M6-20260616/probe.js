/* Corevo acceptans-probe — mät-motorn som dömer "exakt".
 *
 * KÖR I DEVTOLS:   klistra hela filen i konsolen på den live sidan, anropa
 *                  corevoProbe(ASSERTIONS) (ASSERTIONS kommer från en sid-spec).
 * KÖR I PLAYWRIGHT: page.evaluate(corevoProbeSrc + `;return corevoProbe(${JSON.stringify(A)})`)
 *                  — eller använd den färdiga <sida>.accept.spec.ts som importerar detta.
 *
 * En assertion:
 *   { id, sel, prop, expect, kind?, all? }
 *     sel    CSS-selector (helst [data-accept="ID"] — lägg den hooken i bygget)
 *     prop   computed-style-prop ("padding-left") | "text" | "attr:NAMN" | "count"
 *     expect förväntat värde (px-tal/hex/sträng/regex via /…/ i "match")
 *     kind   "px" | "color" | "eq" | "includes" | "match" | "font" | "ge" | "count"
 *     all    true → varje träff på sel måste passera (t.ex. alla swatchar)
 *
 * Returnerar { pass, fail, total, fails:[{id, sel, prop, got, want}] } och
 * skriver en läsbar tabell i konsolen. fail>0 ⇒ sidan är INTE klar.
 */
function corevoProbe(assertions) {
  const norm = s => (s || "").trim().toLowerCase().replace(/\s+/g, " ");
  // any css color → "r,g,b" (drops alpha for stable compare)
  const rgb = v => {
    if (!v) return v;
    const c = document.createElement("canvas").getContext("2d");
    c.fillStyle = "#000"; try { c.fillStyle = v; } catch (e) { return norm(v); }
    const m = c.fillStyle;                       // browser normalises to #hex or rgb()
    const probe = document.createElement("span"); probe.style.color = m;
    document.body.appendChild(probe);
    const out = getComputedStyle(probe).color; probe.remove();
    const n = out.match(/\d+/g); return n ? n.slice(0, 3).join(",") : norm(out);
  };
  const px = v => Math.round(parseFloat(v));
  const family = v => norm(v).split(",")[0].replace(/['"]/g, "");

  const results = [], fails = [];
  for (const a of assertions) {
    const els = [...document.querySelectorAll(a.sel)];
    let got, want = a.expect, ok = false;
    const kind = a.kind || (a.prop && a.prop.includes("color") ? "color"
      : /padding|margin|width|height|radius|size|gap|left|top/.test(a.prop || "") ? "px" : "eq");

    if (a.prop === "count") { got = els.length; want = a.expect; ok = String(got) === String(want); }
    else if (!els.length) { got = "‹selector matchade 0 element›"; ok = false; }
    else {
      const read = el => {
        if (a.prop === "text") return norm(el.textContent);
        if (a.prop.startsWith("attr:")) return el.getAttribute(a.prop.slice(5));
        return getComputedStyle(el).getPropertyValue(a.prop);
      };
      const cmp = raw => {
        if (kind === "color") { got = rgb(raw); return got === rgb(want); }
        if (kind === "px") { got = px(raw); return got === px(want); }
        if (kind === "ge") { got = px(raw); return got >= px(want); }
        if (kind === "font") { got = family(raw); return got === family(want); }
        if (kind === "includes") { got = norm(raw); return got.includes(norm(want)); }
        if (kind === "match") { got = norm(raw); return new RegExp(want, "i").test(raw); }
        got = norm(raw); return got === norm(want);
      };
      ok = a.all ? els.every(e => cmp(read(e))) : cmp(read(els[0]));
    }
    const row = { id: a.id, sel: a.sel, prop: a.prop, got, want };
    results.push({ ...row, status: ok ? "PASS" : "FAIL" });
    if (!ok) fails.push(row);
  }
  console.table(results);
  const out = { total: results.length, pass: results.length - fails.length, fail: fails.length, fails };
  console.log(`%cACCEPTANS: ${out.pass}/${out.total} PASS · ${out.fail} FAIL`,
    `font-weight:700;color:${out.fail ? "#9E5A57" : "#4E7A5E"}`);
  if (out.fail) console.log("FIX dessa:", fails);
  return out;
}

// Exporteras för Playwright (page.evaluate får källan som sträng).
if (typeof module !== "undefined") module.exports = { corevoProbe, corevoProbeSrc: corevoProbe.toString() };
