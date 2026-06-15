#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kategoriserings-script för Corevo template-katalog.
ENDAST LÄSNING av mallarna — ingen mutation.

Itererar varje mall-mapp i 03-template-katalog/ och härleder:
  - licens (fri | kräver-kredit | kräver-köp | förbjuder-resale | okänd)
  - typ (storefront | admin | landing | e-handel)
  - bransch-gissning
  - mått (#sidor, #bilder, css-ramverk, :root-primärfärger)

Skriver:
  - KATALOG-RAPPORT.md   (människoläsbar)
  - templates-staging.json (maskindata för import till templates-tabellen)

Körs i Linux-sandbox där repot är monterat. CATALOG sätts via argv[1] eller env.
"""
import os, re, sys, json, html
from collections import Counter

CATALOG = (
    sys.argv[1] if len(sys.argv) > 1
    else os.environ.get("CATALOG", ".")
)

# Mappar som INTE är mallar (pipeline / meta)
NON_TEMPLATE = {
    "00-inbox", "01-kandidater", "02-valda", "screenshots", "node_modules",
}
NON_TEMPLATE_FILES_PREFIX = ("KATALOG", "_kategorisera", "templates-staging", "KATALOG-RAPPORT")

IMG_EXT = {".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp", ".bmp", ".ico", ".avif"}

# ---------- helpers ----------

def read_text(path, limit=200_000):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read(limit)
    except Exception:
        return ""

def walk_files(root):
    """Alla filer under root, hoppar node_modules."""
    out = []
    for dp, dns, fns in os.walk(root):
        dns[:] = [d for d in dns if d != "node_modules"]
        for fn in fns:
            out.append(os.path.join(dp, fn))
    return out

def find_template_root(top_dir):
    """
    Mallar ligger ofta nästlade en nivå (t.ex. '52 haircut-1.0.0/haircut-1.0.0/').
    Hitta katalogen som faktiskt innehåller index.html (eller html/index.html),
    annars fall tillbaka på top_dir.
    """
    # direkt index.html?
    if os.path.isfile(os.path.join(top_dir, "index.html")):
        return top_dir
    subs = [d for d in os.listdir(top_dir)
            if os.path.isdir(os.path.join(top_dir, d)) and d != "node_modules"]
    # ett ensamt subdir = wrapper -> gå in
    if len(subs) == 1:
        inner = os.path.join(top_dir, subs[0])
        if os.path.isfile(os.path.join(inner, "index.html")) or _has_html(inner):
            return inner
    # annars: top_dir om den har html nånstans
    return top_dir

def _has_html(d):
    for dp, dns, fns in os.walk(d):
        dns[:] = [x for x in dns if x != "node_modules"]
        if any(f.lower().endswith(".html") for f in fns):
            return True
    return False

# ---------- LICENS ----------

def derive_license(troot, all_files, joined_lic_text, footer_text):
    """
    Returnerar (klass, vendor, signaler[]).
    klass: fri | kräver-kredit | kräver-köp | förbjuder-resale | okänd
    """
    blob = (joined_lic_text + "\n" + footer_text).lower()
    signals = []
    vendor = None

    def has(*subs):
        return any(s in blob for s in subs)

    # vendor-detektering
    vendors = {
        "htmlcodex": "htmlcodex",
        "colorlib": "colorlib",
        "bootstrapmade": "bootstrapmade",
        "tooplate": "tooplate",
        "html5up": "html5up",
        "html5 up": "html5up",
        "untree.co": "untree.co",
        "untree": "untree.co",
        "themewagon": "themewagon",
        "themeselection": "themeselection",
        "templatemo": "templatemo",
        "themezy": "themezy",
        "free-css.com": "free-css.com",
        "graygrids": "graygrids",
        "uideck": "uideck",
        "templateflip": "templateflip",
        "pixelarity": "pixelarity",
    }
    for k, v in vendors.items():
        if k in blob:
            vendor = v
            signals.append("vendor:" + v)
            break

    # nulled = röd flagga
    nulled = has("nulled", "gpl nulled", "cracked", "free download premium")
    if nulled:
        signals.append("nulled")

    # explicit licenstexter
    is_mit = bool(re.search(r"\bmit license\b", blob)) or "permission is hereby granted, free of charge" in blob
    is_apache = "apache license" in blob
    is_gpl = bool(re.search(r"\bgnu (general|gpl)\b", blob)) or "gpl" in blob and "license" in blob
    is_cc = ("creative commons" in blob) or bool(re.search(r"\bcc[ \-]?by\b", blob))
    attribution_req = has("attribution", "credit link", "backlink", "author's credit",
                          "author�s credit", "not allowed to remove", "credit-removal",
                          "keep the footer", "leave the footer", "credit removal")
    free_personal = has("free for personal", "personal use only", "personal and commercial")
    no_resale = has("not allowed to resale", "cannot resell", "not resell", "no resale",
                    "do not resell", "redistribute", "sublicense is prohibited",
                    "not allowed to redistribute", "selling our", "reselling")
    purchase = has("purchase a license", "buy a license", "premium version", "commercial license required",
                   "regular license", "extended license", "envato", "themeforest")

    if is_mit:   signals.append("MIT")
    if is_apache:signals.append("Apache")
    if is_gpl:   signals.append("GPL")
    if is_cc:    signals.append("CC")
    if attribution_req: signals.append("attribution")
    if free_personal:   signals.append("free-personal")
    if no_resale:       signals.append("no-resale")
    if purchase:        signals.append("purchase")

    # template-hus vars FRIA licens typiskt kräver attribution / behåll footer-kredit
    CREDIT_VENDORS = ("htmlcodex", "colorlib", "tooplate", "templatemo", "bootstrapmade",
                      "themewagon", "free-css.com", "graygrids", "untree.co", "uideck",
                      "html5up")

    # ---- klassificering (prioriterad) ----
    if nulled:
        return "förbjuder-resale", vendor, signals  # nulled => behandlas som ej säker att sälja
    if purchase and not (is_mit or is_apache):
        return "kräver-köp", vendor, signals
    # EXPLICIT attribution/CC i mallens EGEN licens väger TYNGRE än ett löst MIT-omnämnande
    # (bundlade libs filtreras redan bort innan, men detta är bältet + hängslena).
    if is_cc or attribution_req:
        return "kräver-kredit", vendor, signals
    # känt kredit-krävande hus → behåll footer även om en MIT-rad smiter med
    if vendor in CREDIT_VENDORS:
        return "kräver-kredit", vendor, signals
    # ren MIT/Apache utan attributionssignal → fri
    if is_mit or is_apache:
        return "fri", vendor, signals
    if no_resale:
        return "förbjuder-resale", vendor, signals
    if free_personal:
        return "kräver-kredit", vendor, signals
    return "okänd", vendor, signals

# ---------- TYP ----------

ADMIN_TOKENS = ["admin", "dashboard", "dashmin", "darkpan", "materio", "sneat", "star-admin",
                "celestialadmin", "breeze", "panel", "console", "backend", "crm"]
ADMIN_FILE_HINTS = ["auth-login", "auth-register", "dashboard", "datatables", "form-layouts",
                    "charts-apex", "tables-basic", "ui-cards", "page-account-settings",
                    "icons-boxicons", "layouts-blank"]
ECOM_TOKENS = ["shop", "store", "ecommerce", "e-commerce", "multishop", "cart", "market",
               "woo", "casino"]
ECOM_FILE_HINTS = ["cart.html", "checkout.html", "shop.html", "product.html", "products.html",
                   "wishlist.html", "single-product.html"]
LANDING_TOKENS = ["landing", "startup", "app", "saas", "productly", "fitapp", "podtalk",
                  "landwind", "boldo", "append", "apex", "digital", "gohub", "connect-plus"]

def derive_type(name, troot, all_files, titles_blob):
    base = name.lower()
    rel = [os.path.relpath(p, troot).lower() for p in all_files]
    html_files = [r for r in rel if r.endswith(".html")]
    n_html = len(html_files)
    fileblob = " ".join(rel)
    titles = titles_blob.lower()

    admin_hits = sum(1 for h in ADMIN_FILE_HINTS if h in fileblob)
    ecom_hits  = sum(1 for h in ECOM_FILE_HINTS if any(h in r for r in html_files))
    name_admin = any(t in base for t in ADMIN_TOKENS) or "admin" in titles or "dashboard" in titles
    name_ecom  = any(t in base for t in ECOM_TOKENS)
    name_land  = any(t in base for t in LANDING_TOKENS)

    # admin: starka fil-signaler ELLER namn + många html-sidor
    if admin_hits >= 3 or (name_admin and n_html >= 8):
        return "admin"
    if name_admin and admin_hits >= 1:
        return "admin"
    if ecom_hits >= 2 or (name_ecom and ecom_hits >= 1):
        return "e-handel"
    if name_ecom and n_html >= 5:
        return "e-handel"
    # landing: få sidor (1-3 html) eller landing-namn
    if name_land and n_html <= 4:
        return "landing"
    if n_html <= 2:
        return "landing"
    # default: flersidig publik sida
    return "storefront"

# ---------- BRANSCH ----------

BRANSCH_RULES = [
    ("frisör",        ["barber", "haircut", "hairsal", "haircare", "razor", "brber", "salon",
                        "alotan", "frisor", "frisör"]),
    ("restaurang",    ["restoran", "restaurant", "feane", "foody", "vegefood", "fruitkha",
                        "keto", "cakezone", "baker", "food", "meal", "cuisine", "dine", "bistro"]),
    ("lantbruk/mat",  ["farm", "dairy", "gardener", "greenhouse", "agro", "agri", "harvest",
                        "zoofari", "zoufarm", "farmfresh", "milk", "crop"]),
    ("fastighet",     ["estate", "property", "realestate", "real-estate", "rent", "housing",
                        "apartment", "home-listing"]),
    ("vård",          ["klinik", "klar", "dent", "ortho", "orthoc", "health", "medic", "clinic",
                        "care", "hospital", "doctor", "pharma", "dentcare", "klinik"]),
    ("bygg",          ["construction", "build", "webuild", "upconstruction", "archi", "arkitektur",
                        "architect", "renovat", "carpenter", "painter", "industrio", "indsutrio"]),
    ("industri",      ["industri", "factory", "manufactur", "logistic", "logistica", "montana",
                        "aircon", "solartec", "solar", "engineer"]),
    ("utbildning",    ["edu", "school", "learn", "elearning", "course", "academy", "training",
                        "kinder", "kidkinder", "kider", "kid", "grad-school", "eduwell",
                        "eduprix", "edu-meeting", "study", "tutor"]),
    ("e-handel",      ["shop", "store", "ecommerce", "multishop", "market", "woo", "cart",
                        "fashion", "boutique"]),
    ("event",        ["event", "festava", "festival", "wedding", "conference", "concert",
                        "celestial-event"]),
    ("foto",          ["photo", "photozone", "fotogency", "fotograf", "gallery", "studio",
                        "lens", "camera"]),
    ("finans",        ["finance", "finanza", "bank", "insur", "ensurance", "invest", "crypto",
                        "coin", "cryptocoin", "casino", "casinal", "tax", "accounting", "fintech",
                        "insure"]),
    ("hosting",       ["host", "greenhost", "server", "cloud", "domain", "datacenter", "vps",
                        "hosting"]),
    ("välgörenhet",   ["charity", "chariteam", "donat", "kindheart", "ngo", "nonprofit",
                        "fundrais", "volunteer", "connect-plus"]),
    ("hotell/resa",   ["hotel", "hotelier", "travel", "tour", "trip", "resort", "wooxtravel",
                        "booking", "vacation", "nomad", "nomad-force", "drivin", "cycle",
                        "journey"]),
    ("fitness",       ["fit", "fitapp", "gym", "studio-fitness", "yoga", "workout", "training-studio"]),
    ("teknik/IT",     ["tech", "software", "app", "saas", "digital", "startup", "seo", "seomaster",
                        "secur", "securex", "dgcom", "podtalk", "biznews", "consult", "bizconsult",
                        "agency", "productly", "boldo", "append", "apex"]),
    ("fordon/bil",   ["car", "carserv", "auto", "vehicle", "motor", "drive", "garage"]),
]

def derive_bransch(name, titles_blob):
    base = name.lower()
    titles = titles_blob.lower()
    text = base + " " + titles
    scores = Counter()
    for bransch, kws in BRANSCH_RULES:
        for kw in kws:
            if kw in base:
                scores[bransch] += 3          # mappnamn väger tyngre
            if kw in titles:
                scores[bransch] += 1
    if scores:
        return scores.most_common(1)[0][0]
    return "generell"

# ---------- CSS-ramverk + färger ----------

def derive_framework(troot, all_files, html_blob, css_blob):
    rel = " ".join(os.path.relpath(p, troot).lower() for p in all_files)
    blob = (rel + " " + html_blob).lower()
    if "tailwind" in blob:
        return "tailwind"
    if "bootstrap" in blob:
        return "bootstrap"
    if "bulma" in blob:
        return "bulma"
    if "foundation.min.css" in blob or "/foundation" in blob:
        return "foundation"
    # om det finns css men inget känt ramverk
    if css_blob.strip():
        return "custom"
    return "okänd"

HEX_RE = re.compile(r"#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b")

def derive_root_colors(css_blob):
    colors = []
    # leta i :root { ... } block
    for m in re.finditer(r":root\s*\{([^}]*)\}", css_blob, re.IGNORECASE | re.DOTALL):
        block = m.group(1)
        for line in re.finditer(r"--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);", block):
            var, val = line.group(1).lower(), line.group(2).strip()
            if "primary" in var or "accent" in var or "main" in var or "brand" in var or "theme" in var:
                hexes = HEX_RE.findall(val)
                if hexes:
                    colors.append(hexes[0].upper())
    # dedupe behåll ordning
    seen, out = set(), []
    for c in colors:
        if c not in seen:
            seen.add(c); out.append(c)
    return out[:4]

# ---------- per-mall analys ----------

def analyze(top_dir, name):
    troot = find_template_root(top_dir)
    all_files = walk_files(troot)

    # index.html(s) — räkna sidor = antal .html totalt (utom 404 räknas ändå som sida)
    html_files = [p for p in all_files if p.lower().endswith(".html")]
    n_pages = len(html_files)

    # bilder
    img_files = [p for p in all_files if os.path.splitext(p)[1].lower() in IMG_EXT]
    n_images = len(img_files)

    # primär index.html för title/h1/footer
    index_candidates = [p for p in html_files
                        if os.path.basename(p).lower() == "index.html"]
    index_candidates.sort(key=lambda p: len(os.path.relpath(p, troot)))
    index_html = index_candidates[0] if index_candidates else (html_files[0] if html_files else None)

    titles_blob = ""
    footer_text = ""
    html_blob = ""
    if index_html:
        txt = read_text(index_html, 300_000)
        html_blob = txt
        t = re.search(r"<title[^>]*>(.*?)</title>", txt, re.IGNORECASE | re.DOTALL)
        h1 = re.findall(r"<h1[^>]*>(.*?)</h1>", txt, re.IGNORECASE | re.DOTALL)
        parts = []
        if t: parts.append(html.unescape(re.sub(r"<[^>]+>", " ", t.group(1))).strip())
        for x in h1[:3]:
            parts.append(html.unescape(re.sub(r"<[^>]+>", " ", x)).strip())
        titles_blob = " | ".join(p for p in parts if p)
        # footer: sista ~6000 tecken + ev <footer>
        fm = re.findall(r"<footer[\s\S]*?</footer>", txt, re.IGNORECASE)
        footer_text = (" ".join(fm) if fm else "") + " " + txt[-6000:]

    # CSS-blob: läs upp till några css-filer (style/main/app + ev :root)
    css_files = [p for p in all_files if p.lower().endswith(".css")
                 and "min" not in os.path.basename(p).lower()]
    # prioritera style/main/app/theme
    def css_rank(p):
        b = os.path.basename(p).lower()
        for i, key in enumerate(["style", "main", "app", "theme", "custom", "color", "root", "global"]):
            if key in b: return i
        return 99
    css_files.sort(key=css_rank)
    css_blob = ""
    for p in css_files[:6]:
        css_blob += "\n" + read_text(p, 120_000)
    # om inga icke-min css, ta ev min för ramverks-detektion (men inte färg)
    framework_probe = css_blob
    if not framework_probe.strip():
        for p in all_files:
            if p.lower().endswith(".css"):
                framework_probe += " " + os.path.basename(p)

    # licens-text — VIKTIGT: hoppa över medföljande bibliotekslicenser
    # (lib/, vendor/, plugins/, assets/vendor/, bootstrap/, jquery m.fl. har egna MIT-licenser
    #  som annars maskerar mallens EGNA CC-BY/attribution-licens).
    VENDOR_DIR = re.compile(
        r"(^|/)(lib|libs|vendor|vendors|plugins|plugin|node_modules|bower_components|"
        r"assets/vendor|assets/libs|assets/plugins|fonts|webfonts|bootstrap|jquery|"
        r"owlcarousel|owl-carousel|swiper|slick|fontawesome|font-awesome|aos|wow|"
        r"animate|isotope|magnific|lightbox|tiny-slider|tinymce|datatables|chart|"
        r"apexcharts|perfect-scrollbar|select2|flatpickr|bootstrap-icons|boxicons)(/|$)",
        re.IGNORECASE,
    )
    def is_template_own(p):
        rel = os.path.relpath(p, troot).replace("\\", "/")
        return not VENDOR_DIR.search("/" + rel)

    lic_files = [p for p in all_files
                 if re.search(r"(license|licence|readme|copying|terms)", os.path.basename(p), re.IGNORECASE)
                 and os.path.splitext(p)[1].lower() in (".txt", ".md", "", ".html")
                 and is_template_own(p)]
    # prioritera grundast liggande fil (mallens egen rot) + LICENSE före README
    def lic_rank(p):
        depth = os.path.relpath(p, troot).replace("\\", "/").count("/")
        base = os.path.basename(p).lower()
        kind = 0 if "licen" in base or "copying" in base else (1 if "terms" in base else 2)
        return (depth, kind)
    lic_files.sort(key=lic_rank)
    lic_blob = ""
    for p in lic_files[:5]:
        lic_blob += "\n----\n" + read_text(p, 60_000)

    lic_class, vendor, lic_signals = derive_license(troot, all_files, lic_blob, footer_text)
    typ = derive_type(name, troot, all_files, titles_blob)
    bransch = derive_bransch(name, titles_blob)
    framework = derive_framework(troot, all_files, html_blob, framework_probe)
    colors = derive_root_colors(css_blob)

    return {
        "name": name,
        "folder": os.path.relpath(top_dir, CATALOG),
        "type": typ,
        "industry_guess": bransch,
        "license_class": lic_class,
        "license_vendor": vendor,
        "license_signals": lic_signals,
        "pages": n_pages,
        "images": n_images,
        "css_framework": framework,
        "root_primary_colors": colors,
        "title_sample": titles_blob[:160],
    }

# ---------- main ----------

def main():
    entries = sorted(os.listdir(CATALOG))
    templates = []
    for e in entries:
        full = os.path.join(CATALOG, e)
        if not os.path.isdir(full):
            continue
        if e in NON_TEMPLATE:
            continue
        if e.startswith("."):
            continue
        # måste innehålla minst en html för att räknas som mall
        if not _has_html(full):
            continue
        try:
            templates.append(analyze(full, e))
        except Exception as ex:
            templates.append({
                "name": e, "folder": e, "type": "okänd",
                "industry_guess": "generell", "license_class": "okänd",
                "license_vendor": None, "license_signals": ["ERROR:" + str(ex)[:80]],
                "pages": 0, "images": 0, "css_framework": "okänd",
                "root_primary_colors": [], "title_sample": "",
            })

    # sortera så numrerade kommer i nummerordning, sen alfabetiskt
    def sortkey(t):
        m = re.match(r"^(\d+)\b", t["name"])
        return (0, int(m.group(1))) if m else (1, t["name"].lower())
    templates.sort(key=sortkey)

    # ---- aggregat ----
    by_lic = Counter(t["license_class"] for t in templates)
    by_typ = Counter(t["type"] for t in templates)
    by_bransch = Counter(t["industry_guess"] for t in templates)
    by_fw = Counter(t["css_framework"] for t in templates)
    red_nulled = [t["name"] for t in templates if "nulled" in t["license_signals"]]
    red_resale = [t["name"] for t in templates if t["license_class"] == "förbjuder-resale"]
    red_unknown = [t["name"] for t in templates if t["license_class"] == "okänd"]
    red_purchase = [t["name"] for t in templates if t["license_class"] == "kräver-köp"]

    total = len(templates)

    # ---- JSON ----
    staging = {
        "generated": "kategoriserings-script (_kategorisera.py)",
        "catalog_dir": "4-Dokument-Underlag/03-template-katalog/",
        "total_templates": total,
        "summary": {
            "by_license": dict(by_lic),
            "by_type": dict(by_typ),
            "by_industry": dict(by_bransch),
            "by_framework": dict(by_fw),
            "red_flags": {
                "nulled": red_nulled,
                "förbjuder-resale": red_resale,
                "okänd": red_unknown,
                "kräver-köp": red_purchase,
            },
        },
        "templates": templates,
    }
    with open(os.path.join(CATALOG, "templates-staging.json"), "w", encoding="utf-8") as f:
        json.dump(staging, f, ensure_ascii=False, indent=2)

    # ---- MD ----
    def fmt_counter(c):
        return " · ".join(f"{k}: **{v}**" for k, v in c.most_common())

    lines = []
    lines.append("# Template-katalog — kategoriseringsrapport")
    lines.append("")
    lines.append(f"Auto-genererad av `_kategorisera.py` (endast läsning av mallarna). "
                 f"Maskindata: `templates-staging.json`.")
    lines.append("")
    lines.append(f"**Totalt antal mallar:** {total}")
    lines.append("")
    lines.append("## Topplinjer")
    lines.append("")
    lines.append(f"**Per licens-klass:** {fmt_counter(by_lic)}")
    lines.append("")
    lines.append(f"**Per typ:** {fmt_counter(by_typ)}")
    lines.append("")
    lines.append(f"**Per bransch:** {fmt_counter(by_bransch)}")
    lines.append("")
    lines.append(f"**Per CSS-ramverk:** {fmt_counter(by_fw)}")
    lines.append("")
    lines.append("## Röda flaggor")
    lines.append("")
    lines.append(f"- **nulled / cracked:** {len(red_nulled)}" +
                 (f" → {', '.join(red_nulled)}" if red_nulled else " (inga)"))
    lines.append(f"- **förbjuder-resale:** {len(red_resale)}" +
                 (f" → {', '.join(red_resale)}" if red_resale else " (inga)"))
    lines.append(f"- **kräver-köp:** {len(red_purchase)}" +
                 (f" → {', '.join(red_purchase)}" if red_purchase else " (inga)"))
    lines.append(f"- **okänd licens (måste granskas manuellt):** {len(red_unknown)}" +
                 (f" → {', '.join(red_unknown)}" if red_unknown else " (inga)"))
    lines.append("")
    lines.append("> ⚠️ `kräver-kredit` = footer-/attributionskrav måste behållas (CC BY / "
                 "htmlcodex / colorlib / themewagon m.fl.). `fri` = MIT/Apache. "
                 "Inget får gå till `02-valda/` utan att licensraden här stämmer.")
    lines.append("")
    lines.append("## Tabell per mall")
    lines.append("")
    lines.append("| Mall | Typ | Bransch | Licens | Källa | #sidor | #bilder | Ramverk | Primärfärg |")
    lines.append("|---|---|---|---|---|--:|--:|---|---|")
    for t in templates:
        col = ", ".join(t["root_primary_colors"]) if t["root_primary_colors"] else "—"
        vend = t["license_vendor"] or "—"
        lines.append(
            f"| {t['name']} | {t['type']} | {t['industry_guess']} | {t['license_class']} | "
            f"{vend} | {t['pages']} | {t['images']} | {t['css_framework']} | {col} |"
        )
    lines.append("")

    with open(os.path.join(CATALOG, "KATALOG-RAPPORT.md"), "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    # ---- konsol-summering (det enda som går till context) ----
    print("TOTAL_TEMPLATES=%d" % total)
    print("BY_LICENSE=%s" % dict(by_lic))
    print("BY_TYPE=%s" % dict(by_typ))
    print("BY_INDUSTRY=%s" % dict(by_bransch))
    print("BY_FRAMEWORK=%s" % dict(by_fw))
    print("RED_nulled=%d %s" % (len(red_nulled), red_nulled))
    print("RED_forbjuder_resale=%d %s" % (len(red_resale), red_resale))
    print("RED_krasver_kop=%d %s" % (len(red_purchase), red_purchase))
    print("RED_okand=%d %s" % (len(red_unknown), red_unknown))

if __name__ == "__main__":
    main()
# end of _kategorisera.py
