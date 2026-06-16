// S0 spike — the 'restoran' vendor template, imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/23 restoran-1.0.0 — "Restoran"
// by HTML Codex (CC BY 4.0). A faithful subset (navbar + hero + reservation) of
// index.html, trimmed to the static chrome the spike needs to prove fidelity.
// Transformations applied at import time (this is the "onboarding job" S0 measures):
//   1. asset paths img/… → /sajtbyggare/restoran/img/… (served from public/)
//   2. vendor JS stripped (jQuery/owlcarousel/tempusdominus) — static-first (F4)
//   3. the vendor reservation <form> REPLACED by the module marker
//      <corevo-module type="booking" pos="reservation"> — woven at render (F1)
//   4. dropdown/toggler/modal removed (needed vendor JS); nav links → in-page anchors
// The marker is the contract the render-bridge swaps for the real booking module.
//
// NOTE on sanitization (F5): this string is author-controlled (we imported it), so
// it is trusted. TENANT-edited HTML (GrapesJS output, S2+) MUST be sanitized at
// SAVE time — see lib/sajtbyggare/sanitize.ts.
export const RESTORAN_PAGE_HTML = `
<div class="container-xxl position-relative p-0">
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark px-4 px-lg-5 py-3 py-lg-0">
    <a href="#" class="navbar-brand p-0">
      <h1 class="text-primary m-0"><i class="fa fa-utensils me-3"></i>Restoran</h1>
    </a>
    <div class="collapse navbar-collapse" id="navbarCollapse">
      <div class="navbar-nav ms-auto py-0 pe-4">
        <a href="#" class="nav-item nav-link active">Home</a>
        <a href="#" class="nav-item nav-link">About</a>
        <a href="#" class="nav-item nav-link">Service</a>
        <a href="#" class="nav-item nav-link">Menu</a>
        <a href="#reservation" class="nav-item nav-link">Booking</a>
        <a href="#" class="nav-item nav-link">Contact</a>
      </div>
      <a href="#reservation" class="btn btn-primary py-2 px-4">Book A Table</a>
    </div>
  </nav>
  <div class="container-xxl py-5 bg-dark hero-header mb-5">
    <div class="container my-5 py-5">
      <div class="row align-items-center g-5">
        <div class="col-lg-6 text-center text-lg-start">
          <h1 class="display-3 text-white">Enjoy Our<br>Delicious Meal</h1>
          <p class="text-white mb-4 pb-2">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
          <a href="#reservation" class="btn btn-primary py-sm-3 px-sm-5 me-3">Book A Table</a>
        </div>
        <div class="col-lg-6 text-center text-lg-end overflow-hidden">
          <img class="img-fluid" src="/sajtbyggare/restoran/img/hero.png" alt="Restoran hero">
        </div>
      </div>
    </div>
  </div>
</div>

<div class="container-xxl py-5 px-0" id="reservation">
  <div class="row g-0">
    <div class="col-md-6">
      <img class="img-fluid w-100 h-100" style="object-fit: cover" src="/sajtbyggare/restoran/img/about-1.jpg" alt="Restoran">
    </div>
    <div class="col-md-6 bg-dark d-flex align-items-center">
      <div class="p-5">
        <h5 class="section-title ff-secondary text-start text-primary fw-normal">Reservation</h5>
        <h1 class="text-white mb-4">Book A Table Online</h1>
        <corevo-module type="booking" pos="reservation"></corevo-module>
      </div>
    </div>
  </div>
</div>

<div class="container-fluid bg-dark text-light py-4 mt-5">
  <div class="container text-center">
    <small class="text-light">Mall: <a class="text-primary" href="https://htmlcodex.com/restaurant-website-template" rel="nofollow">Restoran by HTML Codex</a> (CC BY 4.0) — Corevo sajtbyggare-spike S0.</small>
  </div>
</div>
`.trim()

/** The template's own stylesheets (served from public/). Loaded on the spike route
 *  so the imported page renders with the vendor's real CSS. External CDN deps
 *  (Google Fonts, Font Awesome icons) are intentionally NOT loaded — blocked by the
 *  app CSP — so fonts fall back and the <i class="fa"> icon is blank (an F4 finding). */
export const RESTORAN_CSS_HREFS = [
  '/sajtbyggare/restoran/css/bootstrap.min.css',
  '/sajtbyggare/restoran/css/style.css',
] as const
