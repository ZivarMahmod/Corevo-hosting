// The 'carserv' vendor template, imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/87 carserv-1.0.0 — "CarServ"
// (Car Repair HTML Template) by HTML Codex (kräver-kredit: keep the footer
// attribution). A FAITHFUL, FULL copy of the vendor index.html — all content
// sections (Topbar, Navbar, Carousel/hero, Service, About, Fact, Service [a
// SECOND service block — BOTH kept verbatim], Booking, Team, Testimonial,
// Footer). The vendor Spinner loader is dropped (JS-only).
// Transformations applied at import time (the "onboarding job" the harness
// measures) — verbatim copy of the vendor markup PLUS these edits ONLY:
//   1. asset paths img/… → /sajtbyggare/carserv/img/… (served from public/)
//   2. vendor JS stripped (jQuery/bootstrap.bundle/wow/easing/waypoints/counterup/
//      owlcarousel/tempusdominus) — static-first. All <script> removed; JS-only
//      attrs removed (data-bs-toggle, data-bs-target, data-target, data-toggle,
//      data-target-input, data-wow-delay). The `wow`/`fadeIn`/`fadeInUp`/
//      `slideInDown`/`zoomIn`/`animated` animation classes are stripped (animate.css
//      is intentionally NOT loaded — see CARSERV_CSS_HREFS). The #spinner loader
//      block and the back-to-top <a> are removed.
//      The Bootstrap hero carousel MARKUP is kept verbatim (both slides + the
//      prev/next controls); its data-bs-ride / data-bs-slide attrs are NOT in the
//      enumerated JS-only set so they are left inert — it renders the first slide
//      statically with no JS. The second Service block's nav-pills tabs are kept
//      verbatim too (data-bs-toggle/data-bs-target stripped) — same documented
//      static-mode tradeoff: the first tab-pane shows, the others are inert.
//   3. carserv has exactly ONE <form> — the Booking <form>…</form> in the
//      bg-primary column (under <h1>Book For A Service</h1>). It is REPLACED by the
//      module marker <corevo-module type="booking" pos="booking"> — woven at render.
//      The surrounding heading + bg-secondary/bg-primary columns are kept verbatim.
//      The footer "Newsletter" is an input+button <div> (no <form> tag), like klinik,
//      so AFTER the weave NO <form> remains in the page. Exactly ONE booking marker.
//   4. dropdown/toggler removed (needed vendor JS); nav links that pointed to other
//      vendor pages (about.html etc.) → in-page anchors (#service,#about,#booking,
//      #team,#testimonial). Section wrappers carry matching ids so the anchors
//      resolve. The "Pages" dropdown is flattened into the nav (its 404 entry — a
//      dead page with no section — is dropped, mirroring klinik/drivin). Home/Contact
//      (no section) + every empty href="" → href="#".
//   5. JS-driven chrome dropped: Spinner, back-to-top <a>. The vendor's REAL Footer
//      (incl. the htmlcodex/themewagon credit + the credit-removal comment) is
//      reproduced faithfully; the Corevo attribution strip is kept last.
//
// NOTE on sanitization: this string is author-controlled (we imported it), so it
// is trusted. TENANT-edited HTML MUST be sanitized at SAVE time.
export const CARSERV_PAGE_HTML = `
<!-- Topbar Start -->
<div class="container-fluid bg-light p-0">
  <div class="row gx-0 d-none d-lg-flex">
    <div class="col-lg-7 px-5 text-start">
      <div class="h-100 d-inline-flex align-items-center py-3 me-4">
        <small class="fa fa-map-marker-alt text-primary me-2"></small>
        <small>123 Street, New York, USA</small>
      </div>
      <div class="h-100 d-inline-flex align-items-center py-3">
        <small class="far fa-clock text-primary me-2"></small>
        <small>Mon - Fri : 09.00 AM - 09.00 PM</small>
      </div>
    </div>
    <div class="col-lg-5 px-5 text-end">
      <div class="h-100 d-inline-flex align-items-center py-3 me-4">
        <small class="fa fa-phone-alt text-primary me-2"></small>
        <small>+012 345 6789</small>
      </div>
      <div class="h-100 d-inline-flex align-items-center">
        <a class="btn btn-sm-square bg-white text-primary me-1" href="#"><i class="fab fa-facebook-f"></i></a>
        <a class="btn btn-sm-square bg-white text-primary me-1" href="#"><i class="fab fa-twitter"></i></a>
        <a class="btn btn-sm-square bg-white text-primary me-1" href="#"><i class="fab fa-linkedin-in"></i></a>
        <a class="btn btn-sm-square bg-white text-primary me-0" href="#"><i class="fab fa-instagram"></i></a>
      </div>
    </div>
  </div>
</div>
<!-- Topbar End -->


<!-- Navbar Start -->
<nav class="navbar navbar-expand-lg bg-white navbar-light shadow sticky-top p-0">
  <a href="#" class="navbar-brand d-flex align-items-center px-4 px-lg-5">
    <h2 class="m-0 text-primary"><i class="fa fa-car me-3"></i>CarServ</h2>
  </a>
  <div class="collapse navbar-collapse" id="navbarCollapse">
    <div class="navbar-nav ms-auto p-4 p-lg-0">
      <a href="#" class="nav-item nav-link active">Home</a>
      <a href="#about" class="nav-item nav-link">About</a>
      <a href="#service" class="nav-item nav-link">Services</a>
      <a href="#booking" class="nav-item nav-link">Booking</a>
      <a href="#team" class="nav-item nav-link">Technicians</a>
      <a href="#testimonial" class="nav-item nav-link">Testimonial</a>
      <a href="#" class="nav-item nav-link">Contact</a>
    </div>
    <a href="#" class="btn btn-primary py-4 px-lg-5 d-none d-lg-block">Get A Quote<i class="fa fa-arrow-right ms-3"></i></a>
  </div>
</nav>
<!-- Navbar End -->


<!-- Carousel Start -->
<div class="container-fluid p-0 mb-5">
  <div id="header-carousel" class="carousel slide" data-bs-ride="carousel">
    <div class="carousel-inner">
      <div class="carousel-item active">
        <img class="w-100" src="/sajtbyggare/carserv/img/carousel-bg-1.jpg" alt="Image">
        <div class="carousel-caption d-flex align-items-center">
          <div class="container">
            <div class="row align-items-center justify-content-center justify-content-lg-start">
              <div class="col-10 col-lg-7 text-center text-lg-start">
                <h6 class="text-white text-uppercase mb-3">// Car Servicing //</h6>
                <h1 class="display-3 text-white mb-4 pb-3">Qualified Car Repair Service Center</h1>
                <a href="#" class="btn btn-primary py-3 px-5">Learn More<i class="fa fa-arrow-right ms-3"></i></a>
              </div>
              <div class="col-lg-5 d-none d-lg-flex">
                <img class="img-fluid" src="/sajtbyggare/carserv/img/carousel-1.png" alt="">
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="carousel-item">
        <img class="w-100" src="/sajtbyggare/carserv/img/carousel-bg-2.jpg" alt="Image">
        <div class="carousel-caption d-flex align-items-center">
          <div class="container">
            <div class="row align-items-center justify-content-center justify-content-lg-start">
              <div class="col-10 col-lg-7 text-center text-lg-start">
                <h6 class="text-white text-uppercase mb-3">// Car Servicing //</h6>
                <h1 class="display-3 text-white mb-4 pb-3">Qualified Car Wash Service Center</h1>
                <a href="#" class="btn btn-primary py-3 px-5">Learn More<i class="fa fa-arrow-right ms-3"></i></a>
              </div>
              <div class="col-lg-5 d-none d-lg-flex">
                <img class="img-fluid" src="/sajtbyggare/carserv/img/carousel-2.png" alt="">
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <button class="carousel-control-prev" type="button" data-bs-slide="prev">
      <span class="carousel-control-prev-icon" aria-hidden="true"></span>
      <span class="visually-hidden">Previous</span>
    </button>
    <button class="carousel-control-next" type="button" data-bs-slide="next">
      <span class="carousel-control-next-icon" aria-hidden="true"></span>
      <span class="visually-hidden">Next</span>
    </button>
  </div>
</div>
<!-- Carousel End -->


<!-- Service Start -->
<div class="container-xxl py-5">
  <div class="container">
    <div class="row g-4">
      <div class="col-lg-4 col-md-6">
        <div class="d-flex py-5 px-4">
          <i class="fa fa-certificate fa-3x text-primary flex-shrink-0"></i>
          <div class="ps-4">
            <h5 class="mb-3">Quality Servicing</h5>
            <p>Diam dolor diam ipsum sit amet diam et eos erat ipsum</p>
            <a class="text-secondary border-bottom" href="#">Read More</a>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="d-flex bg-light py-5 px-4">
          <i class="fa fa-users-cog fa-3x text-primary flex-shrink-0"></i>
          <div class="ps-4">
            <h5 class="mb-3">Expert Workers</h5>
            <p>Diam dolor diam ipsum sit amet diam et eos erat ipsum</p>
            <a class="text-secondary border-bottom" href="#">Read More</a>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="d-flex py-5 px-4">
          <i class="fa fa-tools fa-3x text-primary flex-shrink-0"></i>
          <div class="ps-4">
            <h5 class="mb-3">Modern Equipment</h5>
            <p>Diam dolor diam ipsum sit amet diam et eos erat ipsum</p>
            <a class="text-secondary border-bottom" href="#">Read More</a>
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
    <div class="row g-5">
      <div class="col-lg-6 pt-4" style="min-height: 400px;">
        <div class="position-relative h-100">
          <img class="position-absolute img-fluid w-100 h-100" src="/sajtbyggare/carserv/img/about.jpg" style="object-fit: cover;" alt="">
          <div class="position-absolute top-0 end-0 mt-n4 me-n4 py-4 px-5" style="background: rgba(0, 0, 0, .08);">
            <h1 class="display-4 text-white mb-0">15 <span class="fs-4">Years</span></h1>
            <h4 class="text-white">Experience</h4>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <h6 class="text-primary text-uppercase">// About Us //</h6>
        <h1 class="mb-4"><span class="text-primary">CarServ</span> Is The Best Place For Your Auto Care</h1>
        <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
        <div class="row g-4 mb-3 pb-3">
          <div class="col-12">
            <div class="d-flex">
              <div class="bg-light d-flex flex-shrink-0 align-items-center justify-content-center mt-1" style="width: 45px; height: 45px;">
                <span class="fw-bold text-secondary">01</span>
              </div>
              <div class="ps-3">
                <h6>Professional & Expert</h6>
                <span>Diam dolor diam ipsum sit amet diam et eos</span>
              </div>
            </div>
          </div>
          <div class="col-12">
            <div class="d-flex">
              <div class="bg-light d-flex flex-shrink-0 align-items-center justify-content-center mt-1" style="width: 45px; height: 45px;">
                <span class="fw-bold text-secondary">02</span>
              </div>
              <div class="ps-3">
                <h6>Quality Servicing Center</h6>
                <span>Diam dolor diam ipsum sit amet diam et eos</span>
              </div>
            </div>
          </div>
          <div class="col-12">
            <div class="d-flex">
              <div class="bg-light d-flex flex-shrink-0 align-items-center justify-content-center mt-1" style="width: 45px; height: 45px;">
                <span class="fw-bold text-secondary">03</span>
              </div>
              <div class="ps-3">
                <h6>Awards Winning Workers</h6>
                <span>Diam dolor diam ipsum sit amet diam et eos</span>
              </div>
            </div>
          </div>
        </div>
        <a href="#" class="btn btn-primary py-3 px-5">Read More<i class="fa fa-arrow-right ms-3"></i></a>
      </div>
    </div>
  </div>
</div>
<!-- About End -->


<!-- Fact Start -->
<div class="container-fluid fact bg-dark my-5 py-5">
  <div class="container">
    <div class="row g-4">
      <div class="col-md-6 col-lg-3 text-center">
        <i class="fa fa-check fa-2x text-white mb-3"></i>
        <h2 class="text-white mb-2">1234</h2>
        <p class="text-white mb-0">Years Experience</p>
      </div>
      <div class="col-md-6 col-lg-3 text-center">
        <i class="fa fa-users-cog fa-2x text-white mb-3"></i>
        <h2 class="text-white mb-2">1234</h2>
        <p class="text-white mb-0">Expert Technicians</p>
      </div>
      <div class="col-md-6 col-lg-3 text-center">
        <i class="fa fa-users fa-2x text-white mb-3"></i>
        <h2 class="text-white mb-2">1234</h2>
        <p class="text-white mb-0">Satisfied Clients</p>
      </div>
      <div class="col-md-6 col-lg-3 text-center">
        <i class="fa fa-car fa-2x text-white mb-3"></i>
        <h2 class="text-white mb-2">1234</h2>
        <p class="text-white mb-0">Compleate Projects</p>
      </div>
    </div>
  </div>
</div>
<!-- Fact End -->


<!-- Service Start -->
<div class="container-xxl service py-5" id="service">
  <div class="container">
    <div class="text-center">
      <h6 class="text-primary text-uppercase">// Our Services //</h6>
      <h1 class="mb-5">Explore Our Services</h1>
    </div>
    <div class="row g-4">
      <div class="col-lg-4">
        <div class="nav w-100 nav-pills me-4">
          <button class="nav-link w-100 d-flex align-items-center text-start p-4 mb-4 active" type="button">
            <i class="fa fa-car-side fa-2x me-3"></i>
            <h4 class="m-0">Diagnostic Test</h4>
          </button>
          <button class="nav-link w-100 d-flex align-items-center text-start p-4 mb-4" type="button">
            <i class="fa fa-car fa-2x me-3"></i>
            <h4 class="m-0">Engine Servicing</h4>
          </button>
          <button class="nav-link w-100 d-flex align-items-center text-start p-4 mb-4" type="button">
            <i class="fa fa-cog fa-2x me-3"></i>
            <h4 class="m-0">Tires Replacement</h4>
          </button>
          <button class="nav-link w-100 d-flex align-items-center text-start p-4 mb-0" type="button">
            <i class="fa fa-oil-can fa-2x me-3"></i>
            <h4 class="m-0">Oil Changing</h4>
          </button>
        </div>
      </div>
      <div class="col-lg-8">
        <div class="tab-content w-100">
          <div class="tab-pane fade show active" id="tab-pane-1">
            <div class="row g-4">
              <div class="col-md-6" style="min-height: 350px;">
                <div class="position-relative h-100">
                  <img class="position-absolute img-fluid w-100 h-100" src="/sajtbyggare/carserv/img/service-1.jpg"
                    style="object-fit: cover;" alt="">
                </div>
              </div>
              <div class="col-md-6">
                <h3 class="mb-3">15 Years Of Experience In Auto Servicing</h3>
                <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
                <p><i class="fa fa-check text-success me-3"></i>Quality Servicing</p>
                <p><i class="fa fa-check text-success me-3"></i>Expert Workers</p>
                <p><i class="fa fa-check text-success me-3"></i>Modern Equipment</p>
                <a href="#" class="btn btn-primary py-3 px-5 mt-3">Read More<i class="fa fa-arrow-right ms-3"></i></a>
              </div>
            </div>
          </div>
          <div class="tab-pane fade" id="tab-pane-2">
            <div class="row g-4">
              <div class="col-md-6" style="min-height: 350px;">
                <div class="position-relative h-100">
                  <img class="position-absolute img-fluid w-100 h-100" src="/sajtbyggare/carserv/img/service-2.jpg"
                    style="object-fit: cover;" alt="">
                </div>
              </div>
              <div class="col-md-6">
                <h3 class="mb-3">15 Years Of Experience In Auto Servicing</h3>
                <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
                <p><i class="fa fa-check text-success me-3"></i>Quality Servicing</p>
                <p><i class="fa fa-check text-success me-3"></i>Expert Workers</p>
                <p><i class="fa fa-check text-success me-3"></i>Modern Equipment</p>
                <a href="#" class="btn btn-primary py-3 px-5 mt-3">Read More<i class="fa fa-arrow-right ms-3"></i></a>
              </div>
            </div>
          </div>
          <div class="tab-pane fade" id="tab-pane-3">
            <div class="row g-4">
              <div class="col-md-6" style="min-height: 350px;">
                <div class="position-relative h-100">
                  <img class="position-absolute img-fluid w-100 h-100" src="/sajtbyggare/carserv/img/service-3.jpg"
                    style="object-fit: cover;" alt="">
                </div>
              </div>
              <div class="col-md-6">
                <h3 class="mb-3">15 Years Of Experience In Auto Servicing</h3>
                <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
                <p><i class="fa fa-check text-success me-3"></i>Quality Servicing</p>
                <p><i class="fa fa-check text-success me-3"></i>Expert Workers</p>
                <p><i class="fa fa-check text-success me-3"></i>Modern Equipment</p>
                <a href="#" class="btn btn-primary py-3 px-5 mt-3">Read More<i class="fa fa-arrow-right ms-3"></i></a>
              </div>
            </div>
          </div>
          <div class="tab-pane fade" id="tab-pane-4">
            <div class="row g-4">
              <div class="col-md-6" style="min-height: 350px;">
                <div class="position-relative h-100">
                  <img class="position-absolute img-fluid w-100 h-100" src="/sajtbyggare/carserv/img/service-4.jpg"
                    style="object-fit: cover;" alt="">
                </div>
              </div>
              <div class="col-md-6">
                <h3 class="mb-3">15 Years Of Experience In Auto Servicing</h3>
                <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
                <p><i class="fa fa-check text-success me-3"></i>Quality Servicing</p>
                <p><i class="fa fa-check text-success me-3"></i>Expert Workers</p>
                <p><i class="fa fa-check text-success me-3"></i>Modern Equipment</p>
                <a href="#" class="btn btn-primary py-3 px-5 mt-3">Read More<i class="fa fa-arrow-right ms-3"></i></a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Service End -->


<!-- Booking Start -->
<div class="container-fluid bg-secondary booking my-5" id="booking">
  <div class="container">
    <div class="row gx-5">
      <div class="col-lg-6 py-5">
        <div class="py-5">
          <h1 class="text-white mb-4">Certified and Award Winning Car Repair Service Provider</h1>
          <p class="text-white mb-0">Eirmod sed tempor lorem ut dolores. Aliquyam sit sadipscing kasd ipsum. Dolor ea et dolore et at sea ea at dolor, justo ipsum duo rebum sea invidunt voluptua. Eos vero eos vero ea et dolore eirmod et. Dolores diam duo invidunt lorem. Elitr ut dolores magna sit. Sea dolore sanctus sed et. Takimata takimata sanctus sed.</p>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="bg-primary h-100 d-flex flex-column justify-content-center text-center p-5">
          <h1 class="text-white mb-4">Book For A Service</h1>
          <corevo-module type="booking" pos="booking"></corevo-module>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Booking End -->


<!-- Team Start -->
<div class="container-xxl py-5" id="team">
  <div class="container">
    <div class="text-center">
      <h6 class="text-primary text-uppercase">// Our Technicians //</h6>
      <h1 class="mb-5">Our Expert Technicians</h1>
    </div>
    <div class="row g-4">
      <div class="col-lg-3 col-md-6">
        <div class="team-item">
          <div class="position-relative overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/carserv/img/team-1.jpg" alt="">
            <div class="team-overlay position-absolute start-0 top-0 w-100 h-100">
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-light text-center p-4">
            <h5 class="fw-bold mb-0">Full Name</h5>
            <small>Designation</small>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item">
          <div class="position-relative overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/carserv/img/team-2.jpg" alt="">
            <div class="team-overlay position-absolute start-0 top-0 w-100 h-100">
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-light text-center p-4">
            <h5 class="fw-bold mb-0">Full Name</h5>
            <small>Designation</small>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item">
          <div class="position-relative overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/carserv/img/team-3.jpg" alt="">
            <div class="team-overlay position-absolute start-0 top-0 w-100 h-100">
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-light text-center p-4">
            <h5 class="fw-bold mb-0">Full Name</h5>
            <small>Designation</small>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item">
          <div class="position-relative overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/carserv/img/team-4.jpg" alt="">
            <div class="team-overlay position-absolute start-0 top-0 w-100 h-100">
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square mx-1" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-light text-center p-4">
            <h5 class="fw-bold mb-0">Full Name</h5>
            <small>Designation</small>
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
      <h6 class="text-primary text-uppercase">// Testimonial //</h6>
      <h1 class="mb-5">Our Clients Say!</h1>
    </div>
    <div class="owl-carousel testimonial-carousel position-relative">
      <div class="testimonial-item text-center">
        <img class="bg-light rounded-circle p-2 mx-auto mb-3" src="/sajtbyggare/carserv/img/testimonial-1.jpg" style="width: 80px; height: 80px;">
        <h5 class="mb-0">Client Name</h5>
        <p>Profession</p>
        <div class="testimonial-text bg-light text-center p-4">
        <p class="mb-0">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit diam amet diam et eos. Clita erat ipsum et lorem et sit.</p>
        </div>
      </div>
      <div class="testimonial-item text-center">
        <img class="bg-light rounded-circle p-2 mx-auto mb-3" src="/sajtbyggare/carserv/img/testimonial-2.jpg" style="width: 80px; height: 80px;">
        <h5 class="mb-0">Client Name</h5>
        <p>Profession</p>
        <div class="testimonial-text bg-light text-center p-4">
        <p class="mb-0">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit diam amet diam et eos. Clita erat ipsum et lorem et sit.</p>
        </div>
      </div>
      <div class="testimonial-item text-center">
        <img class="bg-light rounded-circle p-2 mx-auto mb-3" src="/sajtbyggare/carserv/img/testimonial-3.jpg" style="width: 80px; height: 80px;">
        <h5 class="mb-0">Client Name</h5>
        <p>Profession</p>
        <div class="testimonial-text bg-light text-center p-4">
        <p class="mb-0">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit diam amet diam et eos. Clita erat ipsum et lorem et sit.</p>
        </div>
      </div>
      <div class="testimonial-item text-center">
        <img class="bg-light rounded-circle p-2 mx-auto mb-3" src="/sajtbyggare/carserv/img/testimonial-4.jpg" style="width: 80px; height: 80px;">
        <h5 class="mb-0">Client Name</h5>
        <p>Profession</p>
        <div class="testimonial-text bg-light text-center p-4">
        <p class="mb-0">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit diam amet diam et eos. Clita erat ipsum et lorem et sit.</p>
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
        <h4 class="text-light mb-4">Address</h4>
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
        <h4 class="text-light mb-4">Opening Hours</h4>
        <h6 class="text-light">Monday - Friday:</h6>
        <p class="mb-4">09.00 AM - 09.00 PM</p>
        <h6 class="text-light">Saturday - Sunday:</h6>
        <p class="mb-0">09.00 AM - 12.00 PM</p>
      </div>
      <div class="col-lg-3 col-md-6">
        <h4 class="text-light mb-4">Services</h4>
        <a class="btn btn-link" href="#">Diagnostic Test</a>
        <a class="btn btn-link" href="#">Engine Servicing</a>
        <a class="btn btn-link" href="#">Tires Replacement</a>
        <a class="btn btn-link" href="#">Oil Changing</a>
        <a class="btn btn-link" href="#">Vacuam Cleaning</a>
      </div>
      <div class="col-lg-3 col-md-6">
        <h4 class="text-light mb-4">Newsletter</h4>
        <p>Dolor amet sit justo amet elitr clita ipsum elitr est.</p>
        <div class="position-relative mx-auto" style="max-width: 400px;">
          <input class="form-control border-0 w-100 py-3 ps-4 pe-5" type="text" placeholder="Your email">
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

          <!--/*** This template is free as long as you keep the footer author’s credit link/attribution link/backlink. If you'd like to use the template without the footer author’s credit link/attribution link/backlink, you can purchase the Credit Removal License from "https://htmlcodex.com/credit-removal". Thank you for your support. ***/-->
          Designed By <a class="border-bottom" href="https://htmlcodex.com">HTML Codex</a>
          <br>Distributed By: <a class="border-bottom" href="https://themewagon.com" target="_blank">ThemeWagon</a>
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
    <small class="text-light">Mall: <a class="text-primary" href="https://htmlcodex.com" rel="nofollow">CarServ by HTML Codex</a> (kräver-kredit) — Corevo sajtbyggare.</small>
  </div>
</div>
`.trim()

/** The template's own stylesheets (served from public/). Loaded on the spike route
 *  so the imported page renders with the vendor's real CSS. External CDN deps
 *  (Google Fonts, Font Awesome, bootstrap-icons, animate.css, owl.carousel.css,
 *  tempusdominus.css) are intentionally NOT loaded — blocked by the app CSP — so
 *  fonts fall back, the <i class="fa"> icons are blank, the Bootstrap hero carousel
 *  shows its first slide statically, the nav-pills service tabs show the first pane,
 *  and the owl testimonial carousel renders stacked. */
export const CARSERV_CSS_HREFS = [
  '/sajtbyggare/carserv/css/bootstrap.min.css',
  '/sajtbyggare/carserv/css/style.css',
] as const
