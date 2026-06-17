// The 'drivin' vendor template, imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/72 drivin-1.0.0 — "Drivin"
// (Driving School Website Template) by HTML Codex (kräver-kredit: keep the footer
// attribution). A FAITHFUL, FULL copy of the vendor index.html — all content
// sections (Topbar, Navbar, Carousel/hero, Facts, About, Courses, Features, Team,
// Testimonial, Footer, Copyright). The vendor Spinner loader is dropped (JS-only).
// Transformations applied at import time (the "onboarding job" the harness
// measures) — verbatim copy of the vendor markup PLUS these edits ONLY:
//   1. asset paths img/… → /sajtbyggare/drivin/img/… (served from public/)
//   2. vendor JS stripped (jQuery/bootstrap.bundle/wow/easing/waypoints/owlcarousel) —
//      static-first. All <script> removed; JS-only attrs removed (data-bs-toggle,
//      data-bs-target, data-target, data-toggle, data-target-input, data-wow-delay).
//      The `wow`/`fadeIn`/`fadeInUp`/`slideInDown`/`animated` animation classes are
//      stripped (animate.css is intentionally NOT loaded — see DRIVIN_CSS_HREFS).
//      The #spinner loader block and the back-to-top <a> are removed.
//      The Bootstrap hero carousel MARKUP is kept verbatim (both slides + the
//      prev/next controls); its data-bs-ride / data-bs-slide attrs are NOT in the
//      enumerated JS-only set so they are left inert — it renders the first slide
//      statically with no JS. Same documented static-mode tradeoff as the owl
//      testimonial carousel.
//   3. drivin has TWO <form>s. The "Make Appointment" <form>…</form> in the Courses
//      section (under <h1>Make Appointment</h1>) is REPLACED by the module marker
//      <corevo-module type="booking" pos="appointment"> — woven at render. The
//      surrounding heading + bg-primary wrapper are kept verbatim. The OTHER vendor
//      <form action=""> (Footer newsletter) is KEPT as static markup (JS-only attrs
//      stripped, nothing to strip here). Exactly ONE booking marker in the page.
//   4. dropdown/toggler removed (needed vendor JS); nav links that pointed to other
//      vendor pages (about.html etc.) → in-page anchors (#about,#courses,#features,
//      #team,#testimonial,#appointment). Section wrappers carry matching ids so the
//      anchors resolve. The "Pages" dropdown is flattened into the nav (its 404 entry
//      — a dead page with no section — is dropped, mirroring klinik). Home/Contact
//      (no section) + every empty href="" → href="#"; real hrefs (tel:) are kept.
//   5. JS-driven chrome dropped: Spinner, back-to-top <a>. The vendor's REAL Footer +
//      Copyright (incl. the htmlcodex/themewagon credit + the credit-removal comment)
//      are reproduced faithfully; the Corevo attribution strip is kept last.
//
// NOTE on sanitization: this string is author-controlled (we imported it), so it
// is trusted. TENANT-edited HTML MUST be sanitized at SAVE time.
export const DRIVIN_PAGE_HTML = `
<!-- Topbar Start -->
<div class="container-fluid bg-dark text-light p-0">
  <div class="row gx-0 d-none d-lg-flex">
    <div class="col-lg-7 px-5 text-start">
      <div class="h-100 d-inline-flex align-items-center me-4">
        <small class="fa fa-map-marker-alt text-primary me-2"></small>
        <small>123 Street, New York, USA</small>
      </div>
      <div class="h-100 d-inline-flex align-items-center">
        <small class="far fa-clock text-primary me-2"></small>
        <small>Mon - Fri : 09.00 AM - 09.00 PM</small>
      </div>
    </div>
    <div class="col-lg-5 px-5 text-end">
      <div class="h-100 d-inline-flex align-items-center me-4">
        <small class="fa fa-phone-alt text-primary me-2"></small>
        <small>+012 345 6789</small>
      </div>
      <div class="h-100 d-inline-flex align-items-center mx-n2">
        <a class="btn btn-square btn-link rounded-0 border-0 border-end border-secondary" href="#"><i class="fab fa-facebook-f"></i></a>
        <a class="btn btn-square btn-link rounded-0 border-0 border-end border-secondary" href="#"><i class="fab fa-twitter"></i></a>
        <a class="btn btn-square btn-link rounded-0 border-0 border-end border-secondary" href="#"><i class="fab fa-linkedin-in"></i></a>
        <a class="btn btn-square btn-link rounded-0" href="#"><i class="fab fa-instagram"></i></a>
      </div>
    </div>
  </div>
</div>
<!-- Topbar End -->


<!-- Navbar Start -->
<nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
  <a href="#" class="navbar-brand d-flex align-items-center border-end px-4 px-lg-5">
    <h2 class="m-0"><i class="fa fa-car text-primary me-2"></i>Drivin</h2>
  </a>
  <div class="collapse navbar-collapse" id="navbarCollapse">
    <div class="navbar-nav ms-auto p-4 p-lg-0">
      <a href="#" class="nav-item nav-link active">Home</a>
      <a href="#about" class="nav-item nav-link">About</a>
      <a href="#courses" class="nav-item nav-link">Courses</a>
      <a href="#features" class="nav-item nav-link">Features</a>
      <a href="#appointment" class="nav-item nav-link">Appointment</a>
      <a href="#team" class="nav-item nav-link">Our Team</a>
      <a href="#testimonial" class="nav-item nav-link">Testimonial</a>
      <a href="#" class="nav-item nav-link">Contact</a>
    </div>
    <a href="#" class="btn btn-primary py-4 px-lg-5 d-none d-lg-block">Get Started<i class="fa fa-arrow-right ms-3"></i></a>
  </div>
</nav>
<!-- Navbar End -->


<!-- Carousel Start -->
<div class="container-fluid p-0">
  <div id="header-carousel" class="carousel slide" data-bs-ride="carousel">
    <div class="carousel-inner">
      <div class="carousel-item active">
        <img class="w-100" src="/sajtbyggare/drivin/img/carousel-1.jpg" alt="Image">
        <div class="carousel-caption">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-7">
                <h1 class="display-2 text-light mb-5">Learn To Drive With Confidence</h1>
                <a href="#" class="btn btn-primary py-sm-3 px-sm-5">Learn More</a>
                <a href="#" class="btn btn-light py-sm-3 px-sm-5 ms-3">Our Courses</a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="carousel-item">
        <img class="w-100" src="/sajtbyggare/drivin/img/carousel-2.jpg" alt="Image">
        <div class="carousel-caption">
          <div class="container">
            <div class="row justify-content-center">
              <div class="col-lg-7">
                <h1 class="display-2 text-light mb-5">Safe Driving Is Our Top Priority</h1>
                <a href="#" class="btn btn-primary py-sm-3 px-sm-5">Learn More</a>
                <a href="#" class="btn btn-light py-sm-3 px-sm-5 ms-3">Our Courses</a>
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


<!-- Facts Start -->
<div class="container-fluid facts py-5 pt-lg-0">
  <div class="container py-5 pt-lg-0">
    <div class="row gx-0">
      <div class="col-lg-4">
        <div class="bg-white shadow d-flex align-items-center h-100 p-4" style="min-height: 150px;">
          <div class="d-flex">
            <div class="flex-shrink-0 btn-lg-square bg-primary">
              <i class="fa fa-car text-white"></i>
            </div>
            <div class="ps-4">
              <h5>Easy Driving Learn </h5>
              <span>Clita erat ipsum lorem sit sed stet duo justo erat amet</span>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="bg-white shadow d-flex align-items-center h-100 p-4" style="min-height: 150px;">
          <div class="d-flex">
            <div class="flex-shrink-0 btn-lg-square bg-primary">
              <i class="fa fa-users text-white"></i>
            </div>
            <div class="ps-4">
              <h5>National Instructor</h5>
              <span>Clita erat ipsum lorem sit sed stet duo justo erat amet</span>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4">
        <div class="bg-white shadow d-flex align-items-center h-100 p-4" style="min-height: 150px;">
          <div class="d-flex">
            <div class="flex-shrink-0 btn-lg-square bg-primary">
              <i class="fa fa-file-alt text-white"></i>
            </div>
            <div class="ps-4">
              <h5>Get licence</h5>
              <span>Clita erat ipsum lorem sit sed stet duo justo erat amet</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Facts End -->


<!-- About Start -->
<div class="container-xxl py-6" id="about">
  <div class="container">
    <div class="row g-5">
      <div class="col-lg-6">
        <div class="position-relative overflow-hidden ps-5 pt-5 h-100" style="min-height: 400px;">
          <img class="position-absolute w-100 h-100" src="/sajtbyggare/drivin/img/about-1.jpg" alt="" style="object-fit: cover;">
          <img class="position-absolute top-0 start-0 bg-white pe-3 pb-3" src="/sajtbyggare/drivin/img/about-2.jpg" alt="" style="width: 200px; height: 200px;">
        </div>
      </div>
      <div class="col-lg-6">
        <div class="h-100">
          <h6 class="text-primary text-uppercase mb-2">About Us</h6>
          <h1 class="display-6 mb-4">We Help Students To Pass Test & Get A License On The First Try</h1>
          <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
          <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
          <div class="row g-2 mb-4 pb-2">
            <div class="col-sm-6">
              <i class="fa fa-check text-primary me-2"></i>Fully Licensed
            </div>
            <div class="col-sm-6">
              <i class="fa fa-check text-primary me-2"></i>Online Tracking
            </div>
            <div class="col-sm-6">
              <i class="fa fa-check text-primary me-2"></i>Afordable Fee
            </div>
            <div class="col-sm-6">
              <i class="fa fa-check text-primary me-2"></i>Best Trainers
            </div>
          </div>
          <div class="row g-4">
            <div class="col-sm-6">
              <a class="btn btn-primary py-3 px-5" href="#">Read More</a>
            </div>
            <div class="col-sm-6">
              <a class="d-inline-flex align-items-center btn btn-outline-primary border-2 p-2" href="tel:+0123456789">
                <span class="flex-shrink-0 btn-square bg-primary">
                  <i class="fa fa-phone-alt text-white"></i>
                </span>
                <span class="px-3">+012 345 6789</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- About End -->


<!-- Courses Start -->
<div class="container-xxl courses my-6 py-6 pb-0" id="courses">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 500px;">
      <h6 class="text-primary text-uppercase mb-2">Tranding Courses</h6>
      <h1 class="display-6 mb-4">Our Courses Upskill You With Driving Training</h1>
    </div>
    <div class="row g-4 justify-content-center">
      <div class="col-lg-4 col-md-6">
        <div class="courses-item d-flex flex-column bg-white overflow-hidden h-100">
          <div class="text-center p-4 pt-0">
            <div class="d-inline-block bg-primary text-white fs-5 py-1 px-4 mb-4">$99</div>
            <h5 class="mb-3">Automatic Car Lessons</h5>
            <p>Tempor erat elitr rebum at clita dolor diam ipsum sit diam amet diam et eos</p>
            <ol class="breadcrumb justify-content-center mb-0">
              <li class="breadcrumb-item small"><i class="fa fa-signal text-primary me-2"></i>Beginner</li>
              <li class="breadcrumb-item small"><i class="fa fa-calendar-alt text-primary me-2"></i>3 Week</li>
            </ol>
          </div>
          <div class="position-relative mt-auto">
            <img class="img-fluid" src="/sajtbyggare/drivin/img/courses-1.jpg" alt="">
            <div class="courses-overlay">
              <a class="btn btn-outline-primary border-2" href="#">Read More</a>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="courses-item d-flex flex-column bg-white overflow-hidden h-100">
          <div class="text-center p-4 pt-0">
            <div class="d-inline-block bg-primary text-white fs-5 py-1 px-4 mb-4">$99</div>
            <h5 class="mb-3">Highway Driving Lesson</h5>
            <p>Tempor erat elitr rebum at clita dolor diam ipsum sit diam amet diam et eos</p>
            <ol class="breadcrumb justify-content-center mb-0">
              <li class="breadcrumb-item small"><i class="fa fa-signal text-primary me-2"></i>Beginner</li>
              <li class="breadcrumb-item small"><i class="fa fa-calendar-alt text-primary me-2"></i>3 Week</li>
            </ol>
          </div>
          <div class="position-relative mt-auto">
            <img class="img-fluid" src="/sajtbyggare/drivin/img/courses-2.jpg" alt="">
            <div class="courses-overlay">
              <a class="btn btn-outline-primary border-2" href="#">Read More</a>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="courses-item d-flex flex-column bg-white overflow-hidden h-100">
          <div class="text-center p-4 pt-0">
            <div class="d-inline-block bg-primary text-white fs-5 py-1 px-4 mb-4">$99</div>
            <h5 class="mb-3">International Driving</h5>
            <p>Tempor erat elitr rebum at clita dolor diam ipsum sit diam amet diam et eos</p>
            <ol class="breadcrumb justify-content-center mb-0">
              <li class="breadcrumb-item small"><i class="fa fa-signal text-primary me-2"></i>Beginner</li>
              <li class="breadcrumb-item small"><i class="fa fa-calendar-alt text-primary me-2"></i>3 Week</li>
            </ol>
          </div>
          <div class="position-relative mt-auto">
            <img class="img-fluid" src="/sajtbyggare/drivin/img/courses-3.jpg" alt="">
            <div class="courses-overlay">
              <a class="btn btn-outline-primary border-2" href="#">Read More</a>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-8 my-6 mb-0" id="appointment">
        <div class="bg-primary text-center p-5">
          <h1 class="mb-4">Make Appointment</h1>
          <corevo-module type="booking" pos="appointment"></corevo-module>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Courses End -->


<!-- Features Start -->
<div class="container-xxl py-6" id="features">
  <div class="container">
    <div class="row g-5">
      <div class="col-lg-6">
        <h6 class="text-primary text-uppercase mb-2">Why Choose Us!</h6>
        <h1 class="display-6 mb-4">Best Driving Training Agency In Your City</h1>
        <p class="mb-5">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
        <div class="row gy-5 gx-4">
          <div class="col-sm-6">
            <div class="d-flex align-items-center mb-3">
              <div class="flex-shrink-0 btn-square bg-primary me-3">
                <i class="fa fa-check text-white"></i>
              </div>
              <h5 class="mb-0">Fully Licensed</h5>
            </div>
            <span>Magna sea eos sit dolor, ipsum amet ipsum lorem diam eos</span>
          </div>
          <div class="col-sm-6">
            <div class="d-flex align-items-center mb-3">
              <div class="flex-shrink-0 btn-square bg-primary me-3">
                <i class="fa fa-check text-white"></i>
              </div>
              <h5 class="mb-0">Online Tracking</h5>
            </div>
            <span>Magna sea eos sit dolor, ipsum amet ipsum lorem diam eos</span>
          </div>
          <div class="col-sm-6">
            <div class="d-flex align-items-center mb-3">
              <div class="flex-shrink-0 btn-square bg-primary me-3">
                <i class="fa fa-check text-white"></i>
              </div>
              <h5 class="mb-0">Afordable Fee</h5>
            </div>
            <span>Magna sea eos sit dolor, ipsum amet ipsum lorem diam eos</span>
          </div>
          <div class="col-sm-6">
            <div class="d-flex align-items-center mb-3">
              <div class="flex-shrink-0 btn-square bg-primary me-3">
                <i class="fa fa-check text-white"></i>
              </div>
              <h5 class="mb-0">Best Trainers</h5>
            </div>
            <span>Magna sea eos sit dolor, ipsum amet ipsum lorem diam eos</span>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="position-relative overflow-hidden pe-5 pt-5 h-100" style="min-height: 400px;">
          <img class="position-absolute w-100 h-100" src="/sajtbyggare/drivin/img/about-1.jpg" alt="" style="object-fit: cover;">
          <img class="position-absolute top-0 end-0 bg-white ps-3 pb-3" src="/sajtbyggare/drivin/img/about-2.jpg" alt="" style="width: 200px; height: 200px">
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Features End -->


<!-- Team Start -->
<div class="container-xxl py-6" id="team">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 500px;">
      <h6 class="text-primary text-uppercase mb-2">Meet The Team</h6>
      <h1 class="display-6 mb-4">We Have Great Experience Of Driving</h1>
    </div>
    <div class="row g-0 team-items">
      <div class="col-lg-3 col-md-6">
        <div class="team-item position-relative">
          <div class="position-relative">
            <img class="img-fluid" src="/sajtbyggare/drivin/img/team-1.jpg" alt="">
            <div class="team-social text-center">
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-light text-center p-4">
            <h5 class="mt-2">Full Name</h5>
            <span>Trainer</span>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item position-relative">
          <div class="position-relative">
            <img class="img-fluid" src="/sajtbyggare/drivin/img/team-2.jpg" alt="">
            <div class="team-social text-center">
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-light text-center p-4">
            <h5 class="mt-2">Full Name</h5>
            <span>Trainer</span>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item position-relative">
          <div class="position-relative">
            <img class="img-fluid" src="/sajtbyggare/drivin/img/team-3.jpg" alt="">
            <div class="team-social text-center">
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-light text-center p-4">
            <h5 class="mt-2">Full Name</h5>
            <span>Trainer</span>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item position-relative">
          <div class="position-relative">
            <img class="img-fluid" src="/sajtbyggare/drivin/img/team-4.jpg" alt="">
            <div class="team-social text-center">
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square btn-outline-primary border-2 m-1" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-light text-center p-4">
            <h5 class="mt-2">Full Name</h5>
            <span>Trainer</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Team End -->


<!-- Testimonial Start -->
<div class="container-xxl py-6" id="testimonial">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 500px;">
      <h6 class="text-primary text-uppercase mb-2">Testimonial</h6>
      <h1 class="display-6 mb-4">What Our Clients Say!</h1>
    </div>
    <div class="row justify-content-center">
      <div class="col-lg-8">
        <div class="owl-carousel testimonial-carousel">
          <div class="testimonial-item text-center">
            <div class="position-relative mb-5">
              <img class="img-fluid rounded-circle mx-auto" src="/sajtbyggare/drivin/img/testimonial-1.jpg" alt="">
              <div class="position-absolute top-100 start-50 translate-middle d-flex align-items-center justify-content-center bg-white rounded-circle" style="width: 60px; height: 60px;">
                <i class="fa fa-quote-left fa-2x text-primary"></i>
              </div>
            </div>
            <p class="fs-4">Dolores sed duo clita tempor justo dolor et stet lorem kasd labore dolore lorem ipsum. At lorem lorem magna ut et, nonumy et labore et tempor diam tempor erat.</p>
            <hr class="w-25 mx-auto">
            <h5>Client Name</h5>
            <span>Profession</span>
          </div>
          <div class="testimonial-item text-center">
            <div class="position-relative mb-5">
              <img class="img-fluid rounded-circle mx-auto" src="/sajtbyggare/drivin/img/testimonial-2.jpg" alt="">
              <div class="position-absolute top-100 start-50 translate-middle d-flex align-items-center justify-content-center bg-white rounded-circle" style="width: 60px; height: 60px;">
                <i class="fa fa-quote-left fa-2x text-primary"></i>
              </div>
            </div>
            <p class="fs-4">Dolores sed duo clita tempor justo dolor et stet lorem kasd labore dolore lorem ipsum. At lorem lorem magna ut et, nonumy et labore et tempor diam tempor erat.</p>
            <hr class="w-25 mx-auto">
            <h5>Client Name</h5>
            <span>Profession</span>
          </div>
          <div class="testimonial-item text-center">
            <div class="position-relative mb-5">
              <img class="img-fluid rounded-circle mx-auto" src="/sajtbyggare/drivin/img/testimonial-3.jpg" alt="">
              <div class="position-absolute top-100 start-50 translate-middle d-flex align-items-center justify-content-center bg-white rounded-circle" style="width: 60px; height: 60px;">
                <i class="fa fa-quote-left fa-2x text-primary"></i>
              </div>
            </div>
            <p class="fs-4">Dolores sed duo clita tempor justo dolor et stet lorem kasd labore dolore lorem ipsum. At lorem lorem magna ut et, nonumy et labore et tempor diam tempor erat.</p>
            <hr class="w-25 mx-auto">
            <h5>Client Name</h5>
            <span>Profession</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Testimonial End -->


<!-- Footer Start -->
<div class="container-fluid bg-dark text-light footer my-6 mb-0 py-6">
  <div class="container">
    <div class="row g-5">
      <div class="col-lg-3 col-md-6">
        <h4 class="text-white mb-4">Get In Touch</h4>
        <h2 class="text-primary mb-4"><i class="fa fa-car text-white me-2"></i>Drivin</h2>
        <p class="mb-2"><i class="fa fa-map-marker-alt me-3"></i>123 Street, New York, USA</p>
        <p class="mb-2"><i class="fa fa-phone-alt me-3"></i>+012 345 67890</p>
        <p class="mb-2"><i class="fa fa-envelope me-3"></i>info@example.com</p>
      </div>
      <div class="col-lg-3 col-md-6">
        <h4 class="text-light mb-4">Quick Links</h4>
        <a class="btn btn-link" href="#">About Us</a>
        <a class="btn btn-link" href="#">Contact Us</a>
        <a class="btn btn-link" href="#">Our Services</a>
        <a class="btn btn-link" href="#">Terms & Condition</a>
        <a class="btn btn-link" href="#">Support</a>
      </div>
      <div class="col-lg-3 col-md-6">
        <h4 class="text-light mb-4">Popular Links</h4>
        <a class="btn btn-link" href="#">About Us</a>
        <a class="btn btn-link" href="#">Contact Us</a>
        <a class="btn btn-link" href="#">Our Services</a>
        <a class="btn btn-link" href="#">Terms & Condition</a>
        <a class="btn btn-link" href="#">Support</a>
      </div>
      <div class="col-lg-3 col-md-6">
        <h4 class="text-light mb-4">Newsletter</h4>
        <form action="">
          <div class="input-group">
            <input type="text" class="form-control p-3 border-0" placeholder="Your Email Address">
            <button class="btn btn-primary">Sign Up</button>
          </div>
        </form>
        <h6 class="text-white mt-4 mb-3">Follow Us</h6>
        <div class="d-flex pt-2">
          <a class="btn btn-square btn-outline-light me-1" href="#"><i class="fab fa-twitter"></i></a>
          <a class="btn btn-square btn-outline-light me-1" href="#"><i class="fab fa-facebook-f"></i></a>
          <a class="btn btn-square btn-outline-light me-1" href="#"><i class="fab fa-youtube"></i></a>
          <a class="btn btn-square btn-outline-light me-0" href="#"><i class="fab fa-linkedin-in"></i></a>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Footer End -->


<!-- Copyright Start -->
<div class="container-fluid copyright text-light py-4">
  <div class="container">
    <div class="row">
      <div class="col-md-6 text-center text-md-start mb-3 mb-md-0">
        &copy; <a href="#">Your Site Name</a>, All Right Reserved.
      </div>
      <div class="col-md-6 text-center text-md-end">
        <!--/*** This template is free as long as you keep the footer author’s credit link/attribution link/backlink. If you'd like to use the template without the footer author’s credit link/attribution link/backlink, you can purchase the Credit Removal License from "https://htmlcodex.com/credit-removal". Thank you for your support. ***/-->
        Designed By <a href="https://htmlcodex.com">HTML Codex</a>
        <br>Distributed By: <a href="https://themewagon.com" target="_blank">ThemeWagon</a>
      </div>
    </div>
  </div>
</div>
<!-- Copyright End -->

<div class="container-fluid bg-dark text-light py-4 mt-5">
  <div class="container text-center">
    <small class="text-light">Mall: <a class="text-primary" href="https://htmlcodex.com" rel="nofollow">Drivin by HTML Codex</a> (kräver-kredit) — Corevo sajtbyggare.</small>
  </div>
</div>
`.trim()

/** The template's own stylesheets (served from public/). Loaded on the spike route
 *  so the imported page renders with the vendor's real CSS. External CDN deps
 *  (Google Fonts, Font Awesome, bootstrap-icons, animate.css, owl.carousel.css) are
 *  intentionally NOT loaded — blocked by the app CSP — so fonts fall back, the
 *  <i class="fa"> icons are blank, the Bootstrap hero carousel shows its first slide
 *  statically, and the owl testimonial carousel renders stacked. */
export const DRIVIN_CSS_HREFS = [
  '/sajtbyggare/drivin/css/bootstrap.min.css',
  '/sajtbyggare/drivin/css/style.css',
] as const
