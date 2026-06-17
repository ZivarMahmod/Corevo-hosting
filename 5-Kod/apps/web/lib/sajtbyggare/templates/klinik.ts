// The 'klinik' vendor template, imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/42 klinik-1.0.0 — "Klinik"
// by HTML Codex (kräver-kredit / CC-style: keep the footer attribution). A
// FAITHFUL, FULL copy of the vendor index.html — all content sections (Topbar,
// Navbar, Header/Hero carousel, About, Service, Feature, Team, Appointment,
// Testimonial, Footer). The vendor Spinner loader is dropped (JS-only).
// Transformations applied at import time (the "onboarding job" the harness
// measures) — verbatim copy of the vendor markup PLUS these edits ONLY:
//   1. asset paths img/… → /sajtbyggare/klinik/img/… (served from public/)
//   2. vendor JS stripped (jQuery/owlcarousel/wow/counterup/tempusdominus) —
//      static-first. All <script> removed; JS-only attrs removed (data-bs-toggle,
//      data-bs-target, data-target, data-toggle, data-target-input, data-wow-delay,
//      data-toggle="counter-up"). The `wow`/`fadeIn`/`fadeInUp` animation classes
//      are stripped (animate.css is intentionally NOT loaded — see KLINIK_CSS_HREFS).
//   3. the vendor Appointment <form>…</form> (right column) REPLACED by the module
//      marker <corevo-module type="booking" pos="appointment"> — woven at render.
//      Exactly ONE booking marker in the whole page. The left column (heading +
//      call/mail cards) is kept verbatim.
//   4. dropdown/toggler removed (needed vendor JS); nav links → in-page anchors
//      (#about,#service,#feature,#team,#appointment,#testimonial). Section wrappers
//      carry matching ids so the anchors resolve. The "Pages" dropdown is flattened.
//   5. JS-driven chrome dropped: Spinner, back-to-top <a>. The owl-carousel markup
//      (header + testimonial) is kept verbatim but renders statically (no rotation)
//      since owl JS/CSS are not loaded — a documented static-mode tradeoff. The
//      vendor's REAL Footer (incl. the htmlcodex/themewagon credit) is reproduced
//      faithfully; the Corevo attribution strip is kept last.
//
// NOTE on sanitization: this string is author-controlled (we imported it), so it
// is trusted. TENANT-edited HTML MUST be sanitized at SAVE time.
export const KLINIK_PAGE_HTML = `
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
        <a class="btn btn-sm-square rounded-circle bg-white text-primary me-1" href="#"><i class="fab fa-facebook-f"></i></a>
        <a class="btn btn-sm-square rounded-circle bg-white text-primary me-1" href="#"><i class="fab fa-twitter"></i></a>
        <a class="btn btn-sm-square rounded-circle bg-white text-primary me-1" href="#"><i class="fab fa-linkedin-in"></i></a>
        <a class="btn btn-sm-square rounded-circle bg-white text-primary me-0" href="#"><i class="fab fa-instagram"></i></a>
      </div>
    </div>
  </div>
</div>
<!-- Topbar End -->


<!-- Navbar Start -->
<nav class="navbar navbar-expand-lg bg-white navbar-light sticky-top p-0">
  <a href="#" class="navbar-brand d-flex align-items-center px-4 px-lg-5">
    <h1 class="m-0 text-primary"><i class="far fa-hospital me-3"></i>Klinik</h1>
  </a>
  <div class="collapse navbar-collapse" id="navbarCollapse">
    <div class="navbar-nav ms-auto p-4 p-lg-0">
      <a href="#" class="nav-item nav-link active">Home</a>
      <a href="#about" class="nav-item nav-link">About</a>
      <a href="#service" class="nav-item nav-link">Service</a>
      <a href="#feature" class="nav-item nav-link">Feature</a>
      <a href="#team" class="nav-item nav-link">Our Doctor</a>
      <a href="#appointment" class="nav-item nav-link">Appointment</a>
      <a href="#testimonial" class="nav-item nav-link">Testimonial</a>
    </div>
    <a href="#appointment" class="btn btn-primary rounded-0 py-4 px-lg-5 d-none d-lg-block">Appointment<i class="fa fa-arrow-right ms-3"></i></a>
  </div>
</nav>
<!-- Navbar End -->


<!-- Header Start -->
<div class="container-fluid header bg-primary p-0 mb-5" id="home">
  <div class="row g-0 align-items-center flex-column-reverse flex-lg-row">
    <div class="col-lg-6 p-5">
      <h1 class="display-4 text-white mb-5">Good Health Is The Root Of All Heppiness</h1>
      <div class="row g-4">
        <div class="col-sm-4">
          <div class="border-start border-light ps-4">
            <h2 class="text-white mb-1">123</h2>
            <p class="text-light mb-0">Expert Doctors</p>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="border-start border-light ps-4">
            <h2 class="text-white mb-1">1234</h2>
            <p class="text-light mb-0">Medical Stuff</p>
          </div>
        </div>
        <div class="col-sm-4">
          <div class="border-start border-light ps-4">
            <h2 class="text-white mb-1">12345</h2>
            <p class="text-light mb-0">Total Patients</p>
          </div>
        </div>
      </div>
    </div>
    <div class="col-lg-6">
      <div class="owl-carousel header-carousel">
        <div class="owl-carousel-item position-relative">
          <img class="img-fluid" src="/sajtbyggare/klinik/img/carousel-1.jpg" alt="">
          <div class="owl-carousel-text">
            <h1 class="display-1 text-white mb-0">Cardiology</h1>
          </div>
        </div>
        <div class="owl-carousel-item position-relative">
          <img class="img-fluid" src="/sajtbyggare/klinik/img/carousel-2.jpg" alt="">
          <div class="owl-carousel-text">
            <h1 class="display-1 text-white mb-0">Neurology</h1>
          </div>
        </div>
        <div class="owl-carousel-item position-relative">
          <img class="img-fluid" src="/sajtbyggare/klinik/img/carousel-3.jpg" alt="">
          <div class="owl-carousel-text">
            <h1 class="display-1 text-white mb-0">Pulmonary</h1>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Header End -->


<!-- About Start -->
<div class="container-xxl py-5" id="about">
  <div class="container">
    <div class="row g-5">
      <div class="col-lg-6">
        <div class="d-flex flex-column">
          <img class="img-fluid rounded w-75 align-self-end" src="/sajtbyggare/klinik/img/about-1.jpg" alt="">
          <img class="img-fluid rounded w-50 bg-white pt-3 pe-3" src="/sajtbyggare/klinik/img/about-2.jpg" alt="" style="margin-top: -25%;">
        </div>
      </div>
      <div class="col-lg-6">
        <p class="d-inline-block border rounded-pill py-1 px-4">About Us</p>
        <h1 class="mb-4">Why You Should Trust Us? Get Know About Us!</h1>
        <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
        <p class="mb-4">Stet no et lorem dolor et diam, amet duo ut dolore vero eos. No stet est diam rebum amet diam ipsum. Clita clita labore, dolor duo nonumy clita sit at, sed sit sanctus dolor eos.</p>
        <p><i class="far fa-check-circle text-primary me-3"></i>Quality health care</p>
        <p><i class="far fa-check-circle text-primary me-3"></i>Only Qualified Doctors</p>
        <p><i class="far fa-check-circle text-primary me-3"></i>Medical Research Professionals</p>
        <a class="btn btn-primary rounded-pill py-3 px-5 mt-3" href="#">Read More</a>
      </div>
    </div>
  </div>
</div>
<!-- About End -->


<!-- Service Start -->
<div class="container-xxl py-5" id="service">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 600px;">
      <p class="d-inline-block border rounded-pill py-1 px-4">Services</p>
      <h1>Health Care Solutions</h1>
    </div>
    <div class="row g-4">
      <div class="col-lg-4 col-md-6">
        <div class="service-item bg-light rounded h-100 p-5">
          <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle mb-4" style="width: 65px; height: 65px;">
            <i class="fa fa-heartbeat text-primary fs-4"></i>
          </div>
          <h4 class="mb-3">Cardiology</h4>
          <p class="mb-4">Erat ipsum justo amet duo et elitr dolor, est duo duo eos lorem sed diam stet diam sed stet.</p>
          <a class="btn" href="#"><i class="fa fa-plus text-primary me-3"></i>Read More</a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item bg-light rounded h-100 p-5">
          <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle mb-4" style="width: 65px; height: 65px;">
            <i class="fa fa-x-ray text-primary fs-4"></i>
          </div>
          <h4 class="mb-3">Pulmonary</h4>
          <p class="mb-4">Erat ipsum justo amet duo et elitr dolor, est duo duo eos lorem sed diam stet diam sed stet.</p>
          <a class="btn" href="#"><i class="fa fa-plus text-primary me-3"></i>Read More</a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item bg-light rounded h-100 p-5">
          <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle mb-4" style="width: 65px; height: 65px;">
            <i class="fa fa-brain text-primary fs-4"></i>
          </div>
          <h4 class="mb-3">Neurology</h4>
          <p class="mb-4">Erat ipsum justo amet duo et elitr dolor, est duo duo eos lorem sed diam stet diam sed stet.</p>
          <a class="btn" href="#"><i class="fa fa-plus text-primary me-3"></i>Read More</a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item bg-light rounded h-100 p-5">
          <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle mb-4" style="width: 65px; height: 65px;">
            <i class="fa fa-wheelchair text-primary fs-4"></i>
          </div>
          <h4 class="mb-3">Orthopedics</h4>
          <p class="mb-4">Erat ipsum justo amet duo et elitr dolor, est duo duo eos lorem sed diam stet diam sed stet.</p>
          <a class="btn" href="#"><i class="fa fa-plus text-primary me-3"></i>Read More</a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item bg-light rounded h-100 p-5">
          <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle mb-4" style="width: 65px; height: 65px;">
            <i class="fa fa-tooth text-primary fs-4"></i>
          </div>
          <h4 class="mb-3">Dental Surgery</h4>
          <p class="mb-4">Erat ipsum justo amet duo et elitr dolor, est duo duo eos lorem sed diam stet diam sed stet.</p>
          <a class="btn" href="#"><i class="fa fa-plus text-primary me-3"></i>Read More</a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item bg-light rounded h-100 p-5">
          <div class="d-inline-flex align-items-center justify-content-center bg-white rounded-circle mb-4" style="width: 65px; height: 65px;">
            <i class="fa fa-vials text-primary fs-4"></i>
          </div>
          <h4 class="mb-3">Laboratory</h4>
          <p class="mb-4">Erat ipsum justo amet duo et elitr dolor, est duo duo eos lorem sed diam stet diam sed stet.</p>
          <a class="btn" href="#"><i class="fa fa-plus text-primary me-3"></i>Read More</a>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Service End -->


<!-- Feature Start -->
<div class="container-fluid bg-primary overflow-hidden my-5 px-lg-0" id="feature">
  <div class="container feature px-lg-0">
    <div class="row g-0 mx-lg-0">
      <div class="col-lg-6 feature-text py-5">
        <div class="p-lg-5 ps-lg-0">
          <p class="d-inline-block border rounded-pill text-light py-1 px-4">Features</p>
          <h1 class="text-white mb-4">Why Choose Us</h1>
          <p class="text-white mb-4 pb-2">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo erat amet</p>
          <div class="row g-4">
            <div class="col-6">
              <div class="d-flex align-items-center">
                <div class="d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle bg-light" style="width: 55px; height: 55px;">
                  <i class="fa fa-user-md text-primary"></i>
                </div>
                <div class="ms-4">
                  <p class="text-white mb-2">Experience</p>
                  <h5 class="text-white mb-0">Doctors</h5>
                </div>
              </div>
            </div>
            <div class="col-6">
              <div class="d-flex align-items-center">
                <div class="d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle bg-light" style="width: 55px; height: 55px;">
                  <i class="fa fa-check text-primary"></i>
                </div>
                <div class="ms-4">
                  <p class="text-white mb-2">Quality</p>
                  <h5 class="text-white mb-0">Services</h5>
                </div>
              </div>
            </div>
            <div class="col-6">
              <div class="d-flex align-items-center">
                <div class="d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle bg-light" style="width: 55px; height: 55px;">
                  <i class="fa fa-comment-medical text-primary"></i>
                </div>
                <div class="ms-4">
                  <p class="text-white mb-2">Positive</p>
                  <h5 class="text-white mb-0">Consultation</h5>
                </div>
              </div>
            </div>
            <div class="col-6">
              <div class="d-flex align-items-center">
                <div class="d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle bg-light" style="width: 55px; height: 55px;">
                  <i class="fa fa-headphones text-primary"></i>
                </div>
                <div class="ms-4">
                  <p class="text-white mb-2">24 Hours</p>
                  <h5 class="text-white mb-0">Support</h5>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-6 pe-lg-0" style="min-height: 400px;">
        <div class="position-relative h-100">
          <img class="position-absolute img-fluid w-100 h-100" src="/sajtbyggare/klinik/img/feature.jpg" style="object-fit: cover;" alt="">
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Feature End -->


<!-- Team Start -->
<div class="container-xxl py-5" id="team">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 600px;">
      <p class="d-inline-block border rounded-pill py-1 px-4">Doctors</p>
      <h1>Our Experience Doctors</h1>
    </div>
    <div class="row g-4">
      <div class="col-lg-3 col-md-6">
        <div class="team-item position-relative rounded overflow-hidden">
          <div class="overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/klinik/img/team-1.jpg" alt="">
          </div>
          <div class="team-text bg-light text-center p-4">
            <h5>Doctor Name</h5>
            <p class="text-primary">Department</p>
            <div class="team-social text-center">
              <a class="btn btn-square" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item position-relative rounded overflow-hidden">
          <div class="overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/klinik/img/team-2.jpg" alt="">
          </div>
          <div class="team-text bg-light text-center p-4">
            <h5>Doctor Name</h5>
            <p class="text-primary">Department</p>
            <div class="team-social text-center">
              <a class="btn btn-square" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item position-relative rounded overflow-hidden">
          <div class="overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/klinik/img/team-3.jpg" alt="">
          </div>
          <div class="team-text bg-light text-center p-4">
            <h5>Doctor Name</h5>
            <p class="text-primary">Department</p>
            <div class="team-social text-center">
              <a class="btn btn-square" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item position-relative rounded overflow-hidden">
          <div class="overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/klinik/img/team-4.jpg" alt="">
          </div>
          <div class="team-text bg-light text-center p-4">
            <h5>Doctor Name</h5>
            <p class="text-primary">Department</p>
            <div class="team-social text-center">
              <a class="btn btn-square" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Team End -->


<!-- Appointment Start -->
<div class="container-xxl py-5" id="appointment">
  <div class="container">
    <div class="row g-5">
      <div class="col-lg-6">
        <p class="d-inline-block border rounded-pill py-1 px-4">Appointment</p>
        <h1 class="mb-4">Make An Appointment To Visit Our Doctor</h1>
        <p class="mb-4">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
        <div class="bg-light rounded d-flex align-items-center p-5 mb-4">
          <div class="d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle bg-white" style="width: 55px; height: 55px;">
            <i class="fa fa-phone-alt text-primary"></i>
          </div>
          <div class="ms-4">
            <p class="mb-2">Call Us Now</p>
            <h5 class="mb-0">+012 345 6789</h5>
          </div>
        </div>
        <div class="bg-light rounded d-flex align-items-center p-5">
          <div class="d-flex flex-shrink-0 align-items-center justify-content-center rounded-circle bg-white" style="width: 55px; height: 55px;">
            <i class="fa fa-envelope-open text-primary"></i>
          </div>
          <div class="ms-4">
            <p class="mb-2">Mail Us Now</p>
            <h5 class="mb-0">info@example.com</h5>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="bg-light rounded h-100 d-flex align-items-center p-5">
          <corevo-module type="booking" pos="appointment"></corevo-module>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Appointment End -->


<!-- Testimonial Start -->
<div class="container-xxl py-5" id="testimonial">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 600px;">
      <p class="d-inline-block border rounded-pill py-1 px-4">Testimonial</p>
      <h1>What Say Our Patients!</h1>
    </div>
    <div class="owl-carousel testimonial-carousel">
      <div class="testimonial-item text-center">
        <img class="img-fluid bg-light rounded-circle p-2 mx-auto mb-4" src="/sajtbyggare/klinik/img/testimonial-1.jpg" style="width: 100px; height: 100px;">
        <div class="testimonial-text rounded text-center p-4">
          <p>Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.</p>
          <h5 class="mb-1">Patient Name</h5>
          <span class="fst-italic">Profession</span>
        </div>
      </div>
      <div class="testimonial-item text-center">
        <img class="img-fluid bg-light rounded-circle p-2 mx-auto mb-4" src="/sajtbyggare/klinik/img/testimonial-2.jpg" style="width: 100px; height: 100px;">
        <div class="testimonial-text rounded text-center p-4">
          <p>Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.</p>
          <h5 class="mb-1">Patient Name</h5>
          <span class="fst-italic">Profession</span>
        </div>
      </div>
      <div class="testimonial-item text-center">
        <img class="img-fluid bg-light rounded-circle p-2 mx-auto mb-4" src="/sajtbyggare/klinik/img/testimonial-3.jpg" style="width: 100px; height: 100px;">
        <div class="testimonial-text rounded text-center p-4">
          <p>Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.</p>
          <h5 class="mb-1">Patient Name</h5>
          <span class="fst-italic">Profession</span>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Testimonial End -->


<!-- Footer Start -->
<div class="container-fluid bg-dark text-light footer mt-5 pt-5">
  <div class="container py-5">
    <div class="row g-5">
      <div class="col-lg-3 col-md-6">
        <h5 class="text-light mb-4">Address</h5>
        <p class="mb-2"><i class="fa fa-map-marker-alt me-3"></i>123 Street, New York, USA</p>
        <p class="mb-2"><i class="fa fa-phone-alt me-3"></i>+012 345 67890</p>
        <p class="mb-2"><i class="fa fa-envelope me-3"></i>info@example.com</p>
        <div class="d-flex pt-2">
          <a class="btn btn-outline-light btn-social rounded-circle" href="#"><i class="fab fa-twitter"></i></a>
          <a class="btn btn-outline-light btn-social rounded-circle" href="#"><i class="fab fa-facebook-f"></i></a>
          <a class="btn btn-outline-light btn-social rounded-circle" href="#"><i class="fab fa-youtube"></i></a>
          <a class="btn btn-outline-light btn-social rounded-circle" href="#"><i class="fab fa-linkedin-in"></i></a>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <h5 class="text-light mb-4">Services</h5>
        <a class="btn btn-link" href="#">Cardiology</a>
        <a class="btn btn-link" href="#">Pulmonary</a>
        <a class="btn btn-link" href="#">Neurology</a>
        <a class="btn btn-link" href="#">Orthopedics</a>
        <a class="btn btn-link" href="#">Laboratory</a>
      </div>
      <div class="col-lg-3 col-md-6">
        <h5 class="text-light mb-4">Quick Links</h5>
        <a class="btn btn-link" href="#">About Us</a>
        <a class="btn btn-link" href="#">Contact Us</a>
        <a class="btn btn-link" href="#">Our Services</a>
        <a class="btn btn-link" href="#">Terms & Condition</a>
        <a class="btn btn-link" href="#">Support</a>
      </div>
      <div class="col-lg-3 col-md-6">
        <h5 class="text-light mb-4">Newsletter</h5>
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
        </div>
        <div class="col-md-6 text-center text-md-end">
          Designed By <a class="border-bottom" href="https://htmlcodex.com">HTML Codex</a><br>
          Distributed By <a class="border-bottom" href="https://themewagon.com" target="_blank">ThemeWagon</a>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Footer End -->

<div class="container-fluid bg-dark text-light py-4 mt-5">
  <div class="container text-center">
    <small class="text-light">Mall: <a class="text-primary" href="https://htmlcodex.com/clinic-website-template" rel="nofollow">Klinik by HTML Codex</a> (kräver-kredit) — Corevo sajtbyggare.</small>
  </div>
</div>
`.trim()

/** The template's own stylesheets (served from public/). Loaded on the spike route
 *  so the imported page renders with the vendor's real CSS. External CDN deps
 *  (Google Fonts, Font Awesome, animate.css, owl.carousel.css) are intentionally
 *  NOT loaded — blocked by the app CSP — so fonts fall back, the <i class="fa">
 *  icons are blank, and the owl carousels render statically (stacked). */
export const KLINIK_CSS_HREFS = [
  '/sajtbyggare/klinik/css/bootstrap.min.css',
  '/sajtbyggare/klinik/css/style.css',
] as const
