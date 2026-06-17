// The 'restoran' vendor template, imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/23 restoran-1.0.0 — "Restoran"
// by HTML Codex (CC BY 4.0). A FAITHFUL, FULL copy of the vendor index.html —
// all 8 content sections (Navbar&Hero, Service, About, Menu, Reservation, Team,
// Testimonial, Footer). The vendor Spinner loader is dropped (it is JS-only).
// Transformations applied at import time (this is the "onboarding job" the
// harness measures) — verbatim copy of the vendor markup PLUS these edits ONLY:
//   1. asset paths img/… → /sajtbyggare/restoran/img/… (served from public/)
//   2. vendor JS stripped (jQuery/owlcarousel/tempusdominus/wow/counterup) —
//      static-first (F4). All <script> removed; JS-only attrs removed
//      (data-bs-toggle, data-bs-target, data-target, data-toggle, data-wow-delay,
//      data-src, data-target-input, owl/carousel/tempusdominus hooks).
//   3. the vendor Reservation <form>…</form> REPLACED by the module marker
//      <corevo-module type="booking" pos="reservation"> — woven at render (F1).
//      Exactly ONE booking marker in the whole page.
//   4. dropdown/toggler/modal removed (needed vendor JS); nav links → in-page
//      anchors (#service,#about,#menu,#reservation,#team). Section wrappers carry
//      matching ids so the anchors resolve. The "Pages" dropdown is flattened.
//   5. JS-driven chrome dropped: Spinner, #videoModal, back-to-top <a>. The
//      `wow`/`animated`/`fadeInUp`/`slideInLeft`/`zoomIn` animation classes are
//      stripped (their CSS — animate.css — is intentionally NOT loaded, see
//      RESTORAN_CSS_HREFS). The vendor's REAL Footer is reproduced faithfully;
//      the Corevo attribution-credit strip is kept last.
//
// NOTE on sanitization (F5): this string is author-controlled (we imported it),
// so it is trusted. TENANT-edited HTML MUST be sanitized at SAVE time — see
// lib/sajtbyggare/sanitize.ts.
export const RESTORAN_PAGE_HTML = `
<!-- Navbar & Hero Start -->
<div class="container-xxl position-relative p-0">
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark px-4 px-lg-5 py-3 py-lg-0">
    <a href="#" class="navbar-brand p-0">
      <h1 class="text-primary m-0"><i class="fa fa-utensils me-3"></i>Restoran</h1>
    </a>
    <div class="collapse navbar-collapse" id="navbarCollapse">
      <div class="navbar-nav ms-auto py-0 pe-4">
        <a href="#" class="nav-item nav-link active">Home</a>
        <a href="#about" class="nav-item nav-link">About</a>
        <a href="#service" class="nav-item nav-link">Service</a>
        <a href="#menu" class="nav-item nav-link">Menu</a>
        <a href="#reservation" class="nav-item nav-link">Booking</a>
        <a href="#team" class="nav-item nav-link">Our Team</a>
        <a href="#testimonial" class="nav-item nav-link">Testimonial</a>
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
          <img class="img-fluid" src="/sajtbyggare/restoran/img/hero.png" alt="">
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Navbar & Hero End -->


<!-- Service Start -->
<div class="container-xxl py-5" id="service">
  <div class="container">
    <div class="row g-4">
      <div class="col-lg-3 col-sm-6">
        <div class="service-item rounded pt-3">
          <div class="p-4">
            <i class="fa fa-3x fa-user-tie text-primary mb-4"></i>
            <h5>Master Chefs</h5>
            <p>Diam elitr kasd sed at elitr sed ipsum justo dolor sed clita amet diam</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-sm-6">
        <div class="service-item rounded pt-3">
          <div class="p-4">
            <i class="fa fa-3x fa-utensils text-primary mb-4"></i>
            <h5>Quality Food</h5>
            <p>Diam elitr kasd sed at elitr sed ipsum justo dolor sed clita amet diam</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-sm-6">
        <div class="service-item rounded pt-3">
          <div class="p-4">
            <i class="fa fa-3x fa-cart-plus text-primary mb-4"></i>
            <h5>Online Order</h5>
            <p>Diam elitr kasd sed at elitr sed ipsum justo dolor sed clita amet diam</p>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-sm-6">
        <div class="service-item rounded pt-3">
          <div class="p-4">
            <i class="fa fa-3x fa-headset text-primary mb-4"></i>
            <h5>24/7 Service</h5>
            <p>Diam elitr kasd sed at elitr sed ipsum justo dolor sed clita amet diam</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Service End -->


<!-- About Start -->
<div class="container-xxl py-5" id="about">
  <div class="container">
    <div class="row g-5 align-items-center">
      <div class="col-lg-6">
        <div class="row g-3">
          <div class="col-6 text-start">
            <img class="img-fluid rounded w-100" src="/sajtbyggare/restoran/img/about-1.jpg">
          </div>
          <div class="col-6 text-start">
            <img class="img-fluid rounded w-75" src="/sajtbyggare/restoran/img/about-2.jpg" style="margin-top: 25%;">
          </div>
          <div class="col-6 text-end">
            <img class="img-fluid rounded w-75" src="/sajtbyggare/restoran/img/about-3.jpg">
          </div>
          <div class="col-6 text-end">
            <img class="img-fluid rounded w-100" src="/sajtbyggare/restoran/img/about-4.jpg">
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <h5 class="section-title ff-secondary text-start text-primary fw-normal">About Us</h5>
        <h1 class="mb-4">Welcome to <i class="fa fa-utensils text-primary me-2"></i>Restoran</h1>
        <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos erat ipsum et lorem et sit, sed stet lorem sit.</p>
        <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
        <div class="row g-4 mb-4">
          <div class="col-sm-6">
            <div class="d-flex align-items-center border-start border-5 border-primary px-3">
              <h1 class="flex-shrink-0 display-5 text-primary mb-0">15</h1>
              <div class="ps-4">
                <p class="mb-0">Years of</p>
                <h6 class="text-uppercase mb-0">Experience</h6>
              </div>
            </div>
          </div>
          <div class="col-sm-6">
            <div class="d-flex align-items-center border-start border-5 border-primary px-3">
              <h1 class="flex-shrink-0 display-5 text-primary mb-0">50</h1>
              <div class="ps-4">
                <p class="mb-0">Popular</p>
                <h6 class="text-uppercase mb-0">Master Chefs</h6>
              </div>
            </div>
          </div>
        </div>
        <a class="btn btn-primary py-3 px-5 mt-2" href="#">Read More</a>
      </div>
    </div>
  </div>
</div>
<!-- About End -->


<!-- Menu Start -->
<div class="container-xxl py-5" id="menu">
  <div class="container">
    <div class="text-center">
      <h5 class="section-title ff-secondary text-center text-primary fw-normal">Food Menu</h5>
      <h1 class="mb-5">Most Popular Items</h1>
    </div>
    <div class="tab-class text-center">
      <ul class="nav nav-pills d-inline-flex justify-content-center border-bottom mb-5">
        <li class="nav-item">
          <a class="d-flex align-items-center text-start mx-3 ms-0 pb-3 active" href="#tab-1">
            <i class="fa fa-coffee fa-2x text-primary"></i>
            <div class="ps-3">
              <small class="text-body">Popular</small>
              <h6 class="mt-n1 mb-0">Breakfast</h6>
            </div>
          </a>
        </li>
        <li class="nav-item">
          <a class="d-flex align-items-center text-start mx-3 pb-3" href="#tab-2">
            <i class="fa fa-hamburger fa-2x text-primary"></i>
            <div class="ps-3">
              <small class="text-body">Special</small>
              <h6 class="mt-n1 mb-0">Launch</h6>
            </div>
          </a>
        </li>
        <li class="nav-item">
          <a class="d-flex align-items-center text-start mx-3 me-0 pb-3" href="#tab-3">
            <i class="fa fa-utensils fa-2x text-primary"></i>
            <div class="ps-3">
              <small class="text-body">Lovely</small>
              <h6 class="mt-n1 mb-0">Dinner</h6>
            </div>
          </a>
        </li>
      </ul>
      <div class="tab-content">
        <div id="tab-1" class="tab-pane fade show p-0 active">
          <div class="row g-4">
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-1.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-2.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-3.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-4.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-5.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-6.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-7.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-8.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="tab-2" class="tab-pane fade show p-0">
          <div class="row g-4">
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-1.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-2.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-3.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-4.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-5.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-6.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-7.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-8.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div id="tab-3" class="tab-pane fade show p-0">
          <div class="row g-4">
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-1.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-2.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-3.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-4.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-5.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-6.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-7.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
            <div class="col-lg-6">
              <div class="d-flex align-items-center">
                <img class="flex-shrink-0 img-fluid rounded" src="/sajtbyggare/restoran/img/menu-8.jpg" alt="" style="width: 80px;">
                <div class="w-100 d-flex flex-column text-start ps-4">
                  <h5 class="d-flex justify-content-between border-bottom pb-2">
                    <span>Chicken Burger</span>
                    <span class="text-primary">$115</span>
                  </h5>
                  <small class="fst-italic">Ipsum ipsum clita erat amet dolor justo diam</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Menu End -->


<!-- Reservation Start -->
<div class="container-xxl py-5 px-0" id="reservation">
  <div class="row g-0">
    <div class="col-md-6">
      <div class="video">
        <button type="button" class="btn-play">
          <span></span>
        </button>
      </div>
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
<!-- Reservation End -->


<!-- Team Start -->
<div class="container-xxl pt-5 pb-3" id="team">
  <div class="container">
    <div class="text-center">
      <h5 class="section-title ff-secondary text-center text-primary fw-normal">Team Members</h5>
      <h1 class="mb-5">Our Master Chefs</h1>
    </div>
    <div class="row g-4">
      <div class="col-lg-3 col-md-6">
        <div class="team-item text-center rounded overflow-hidden">
          <div class="rounded-circle overflow-hidden m-4">
            <img class="img-fluid" src="/sajtbyggare/restoran/img/team-1.jpg" alt="">
          </div>
          <h5 class="mb-0">Full Name</h5>
          <small>Designation</small>
          <div class="d-flex justify-content-center mt-3">
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-facebook-f"></i></a>
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-twitter"></i></a>
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-instagram"></i></a>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item text-center rounded overflow-hidden">
          <div class="rounded-circle overflow-hidden m-4">
            <img class="img-fluid" src="/sajtbyggare/restoran/img/team-2.jpg" alt="">
          </div>
          <h5 class="mb-0">Full Name</h5>
          <small>Designation</small>
          <div class="d-flex justify-content-center mt-3">
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-facebook-f"></i></a>
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-twitter"></i></a>
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-instagram"></i></a>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item text-center rounded overflow-hidden">
          <div class="rounded-circle overflow-hidden m-4">
            <img class="img-fluid" src="/sajtbyggare/restoran/img/team-3.jpg" alt="">
          </div>
          <h5 class="mb-0">Full Name</h5>
          <small>Designation</small>
          <div class="d-flex justify-content-center mt-3">
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-facebook-f"></i></a>
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-twitter"></i></a>
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-instagram"></i></a>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item text-center rounded overflow-hidden">
          <div class="rounded-circle overflow-hidden m-4">
            <img class="img-fluid" src="/sajtbyggare/restoran/img/team-4.jpg" alt="">
          </div>
          <h5 class="mb-0">Full Name</h5>
          <small>Designation</small>
          <div class="d-flex justify-content-center mt-3">
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-facebook-f"></i></a>
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-twitter"></i></a>
            <a class="btn btn-square btn-primary mx-1" href="#"><i class="fab fa-instagram"></i></a>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Team End -->


<!-- Testimonial Start -->
<div class="container-xxl py-5" id="testimonial">
  <div class="container">
    <div class="text-center">
      <h5 class="section-title ff-secondary text-center text-primary fw-normal">Testimonial</h5>
      <h1 class="mb-5">Our Clients Say!!!</h1>
    </div>
    <div class="row g-4">
      <div class="col-lg-3 col-md-6">
        <div class="testimonial-item bg-transparent border rounded p-4">
          <i class="fa fa-quote-left fa-2x text-primary mb-3"></i>
          <p>Dolor et eos labore, stet justo sed est sed. Diam sed sed dolor stet amet eirmod eos labore diam</p>
          <div class="d-flex align-items-center">
            <img class="img-fluid flex-shrink-0 rounded-circle" src="/sajtbyggare/restoran/img/testimonial-1.jpg" style="width: 50px; height: 50px;">
            <div class="ps-3">
              <h5 class="mb-1">Client Name</h5>
              <small>Profession</small>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="testimonial-item bg-transparent border rounded p-4">
          <i class="fa fa-quote-left fa-2x text-primary mb-3"></i>
          <p>Dolor et eos labore, stet justo sed est sed. Diam sed sed dolor stet amet eirmod eos labore diam</p>
          <div class="d-flex align-items-center">
            <img class="img-fluid flex-shrink-0 rounded-circle" src="/sajtbyggare/restoran/img/testimonial-2.jpg" style="width: 50px; height: 50px;">
            <div class="ps-3">
              <h5 class="mb-1">Client Name</h5>
              <small>Profession</small>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="testimonial-item bg-transparent border rounded p-4">
          <i class="fa fa-quote-left fa-2x text-primary mb-3"></i>
          <p>Dolor et eos labore, stet justo sed est sed. Diam sed sed dolor stet amet eirmod eos labore diam</p>
          <div class="d-flex align-items-center">
            <img class="img-fluid flex-shrink-0 rounded-circle" src="/sajtbyggare/restoran/img/testimonial-3.jpg" style="width: 50px; height: 50px;">
            <div class="ps-3">
              <h5 class="mb-1">Client Name</h5>
              <small>Profession</small>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="testimonial-item bg-transparent border rounded p-4">
          <i class="fa fa-quote-left fa-2x text-primary mb-3"></i>
          <p>Dolor et eos labore, stet justo sed est sed. Diam sed sed dolor stet amet eirmod eos labore diam</p>
          <div class="d-flex align-items-center">
            <img class="img-fluid flex-shrink-0 rounded-circle" src="/sajtbyggare/restoran/img/testimonial-4.jpg" style="width: 50px; height: 50px;">
            <div class="ps-3">
              <h5 class="mb-1">Client Name</h5>
              <small>Profession</small>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Testimonial End -->


<!-- Footer Start -->
<div class="container-fluid bg-dark text-light footer pt-5 mt-5">
  <div class="container py-5">
    <div class="row g-5">
      <div class="col-lg-3 col-md-6">
        <h4 class="section-title ff-secondary text-start text-primary fw-normal mb-4">Company</h4>
        <a class="btn btn-link" href="#">About Us</a>
        <a class="btn btn-link" href="#">Contact Us</a>
        <a class="btn btn-link" href="#">Reservation</a>
        <a class="btn btn-link" href="#">Privacy Policy</a>
        <a class="btn btn-link" href="#">Terms & Condition</a>
      </div>
      <div class="col-lg-3 col-md-6">
        <h4 class="section-title ff-secondary text-start text-primary fw-normal mb-4">Contact</h4>
        <p class="mb-2"><i class="fa fa-map-marker-alt me-3"></i>123 Street, New York, USA</p>
        <p class="mb-2"><i class="fa fa-phone-alt me-3"></i>+012 345 67890</p>
        <p class="mb-2"><i class="fa fa-envelope me-3"></i>info@example.com</p>
        <div class="d-flex pt-2">
          <a class="btn btn-outline-light btn-social" href="#"><i class="fab fa-twitter"></i></a>
          <a class="btn btn-outline-light btn-social" href="#"><i class="fab fa-facebook-f"></i></a>
          <a class="btn btn-outline-light btn-social" href="#"><i class="fab fa-youtube"></i></a>
          <a class="btn btn-outline-light btn-social" href="#"><i class="fab fa-linkedin-in"></i></a>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <h4 class="section-title ff-secondary text-start text-primary fw-normal mb-4">Opening</h4>
        <h5 class="text-light fw-normal">Monday - Saturday</h5>
        <p>09AM - 09PM</p>
        <h5 class="text-light fw-normal">Sunday</h5>
        <p>10AM - 08PM</p>
      </div>
      <div class="col-lg-3 col-md-6">
        <h4 class="section-title ff-secondary text-start text-primary fw-normal mb-4">Newsletter</h4>
        <p>Dolor amet sit justo amet elitr clita ipsum elitr est.</p>
        <div class="position-relative mx-auto" style="max-width: 400px;">
          <input class="form-control border-primary w-100 py-3 ps-4 pe-5" type="text" placeholder="Your email">
          <button type="button" class="btn btn-primary py-2 position-absolute top-0 end-0 mt-2 me-2">SignUp</button>
        </div>
      </div>
    </div>
  </div>
  <div class="container">
    <div class="copyright">
      <div class="row">
        <div class="col-md-6 text-center text-md-start mb-3 mb-md-0">
          &copy; <a class="border-bottom" href="#">Your Site Name</a>, All Right Reserved.
          Designed By <a class="border-bottom" href="https://htmlcodex.com">HTML Codex</a><br><br>
          Distributed By <a class="border-bottom" href="https://themewagon.com" target="_blank">ThemeWagon</a>
        </div>
        <div class="col-md-6 text-center text-md-end">
          <div class="footer-menu">
            <a href="#">Home</a>
            <a href="#">Cookies</a>
            <a href="#">Help</a>
            <a href="#">FQAs</a>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Footer End -->

<div class="container-fluid bg-dark text-light py-4 mt-5">
  <div class="container text-center">
    <small class="text-light">Mall: <a class="text-primary" href="https://htmlcodex.com/restaurant-website-template" rel="nofollow">Restoran by HTML Codex</a> (CC BY 4.0) — Corevo sajtbyggare.</small>
  </div>
</div>
`.trim()

/** The template's own stylesheets (served from public/). Loaded on the spike route
 *  so the imported page renders with the vendor's real CSS. External CDN deps
 *  (Google Fonts, Font Awesome icons, animate.css) are intentionally NOT loaded —
 *  blocked by the app CSP — so fonts fall back and the <i class="fa"> icons are
 *  blank (an F4 finding). */
export const RESTORAN_CSS_HREFS = [
  '/sajtbyggare/restoran/css/bootstrap.min.css',
  '/sajtbyggare/restoran/css/style.css',
] as const
