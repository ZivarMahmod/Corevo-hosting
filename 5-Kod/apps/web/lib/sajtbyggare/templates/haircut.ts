// The 'haircut' vendor template, imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/52 haircut-1.0.0 — "HairCut"
// (Hair Salon HTML Template) by HTML Codex (kräver-kredit: keep the footer
// attribution). A FAITHFUL, FULL copy of the vendor index.html — all home-page
// content sections (Navbar, Carousel/hero, About, Service, Price, Team, Working
// Hours, Testimonial, Footer). The vendor Spinner loader is dropped (JS-only).
//
// Transformations applied at import time (the "onboarding job") — verbatim copy
// of the vendor markup PLUS these edits ONLY:
//   1. asset paths img/… → /sajtbyggare/haircut/img/… (served from public/).
//   2. vendor JS stripped (jQuery/bootstrap.bundle/wow/easing/waypoints/
//      owlcarousel) — static-first. All <script> removed; JS-only attrs removed
//      (data-bs-toggle, data-bs-target, data-wow-delay). The `wow`/`fadeIn`/
//      `fadeInUp`/`slideInDown`/`animated` animation classes are stripped
//      (animate.css is intentionally NOT loaded — see HAIRCUT_CSS_HREFS). The
//      #spinner loader block, the back-to-top <a>, and the navbar-toggler button
//      are removed. The owl-carousel testimonial `data-dot="<img …>"` attrs are
//      JS-only (owl thumbnail nav) and are dropped too.
//      The Bootstrap hero carousel MARKUP is kept verbatim (both slides + the
//      prev/next controls); its data-bs-ride / data-bs-slide attrs are NOT in the
//      enumerated JS-only set so they are left inert — it renders the first slide
//      statically with no JS (its prev/next data-bs-target IS stripped).
//   3. BOOKING WEAVE: the vendor home page has NO appointment <form> (only the
//      footer "Newsletter" input+button <div>, no <form> tag). Per the import
//      contract, the template's OWN appointment/contact <form> is FOLDED IN from
//      the vendor's contact.html "Contact" section (its own content, not invented)
//      as the Booking band (id="booking"), and that <form>…</form> is REPLACED by
//      the module marker <corevo-module type="booking" pos="booking"> — woven at
//      render. The section heading (<h1>Have Any Query? Please Contact Us!</h1>),
//      the "Contact Us" eyebrow and the Google-map column are kept verbatim. The
//      vendor's developer-only "The contact form is currently inactive…" notice
//      (which described the now-removed form + linked an external download) is the
//      ONLY other thing dropped. AFTER the weave NO <form> remains. Exactly ONE
//      booking marker.
//   4. nav links that pointed to other vendor pages (about.html etc.) → in-page
//      anchors (#about,#service,#price,#team,#hours,#testimonial,#booking). Section
//      wrappers carry matching ids so the anchors resolve. The "Pages" dropdown is
//      flattened into the nav (its 404 entry — a dead page with no section — is
//      dropped, mirroring carserv/klinik/drivin). Home (no section) + every empty
//      href="" → href="#". The "Appointment"/"Contact" links point to #booking.
//   5. JS-driven chrome dropped: Spinner, back-to-top <a>, navbar-toggler. The
//      vendor's REAL Footer (incl. the htmlcodex/themewagon credit + the
//      credit-removal comment) is reproduced faithfully; the Corevo attribution
//      strip is kept last.
//
// NOTE on sanitization: this string is author-controlled (we imported it), so it
// is trusted. TENANT-edited HTML MUST be sanitized at SAVE time.
export const HAIRCUT_PAGE_HTML = `
<!-- Navbar Start -->
<nav class="navbar navbar-expand-lg bg-secondary navbar-dark sticky-top py-lg-0 px-lg-5">
  <a href="#" class="navbar-brand ms-4 ms-lg-0">
    <h1 class="mb-0 text-primary text-uppercase"><i class="fa fa-cut me-3"></i>HairCut</h1>
  </a>
  <div class="collapse navbar-collapse" id="navbarCollapse">
    <div class="navbar-nav ms-auto p-4 p-lg-0">
      <a href="#" class="nav-item nav-link active">Home</a>
      <a href="#about" class="nav-item nav-link">About</a>
      <a href="#service" class="nav-item nav-link">Service</a>
      <a href="#price" class="nav-item nav-link">Pricing Plan</a>
      <a href="#team" class="nav-item nav-link">Our Barber</a>
      <a href="#hours" class="nav-item nav-link">Working Hours</a>
      <a href="#testimonial" class="nav-item nav-link">Testimonial</a>
      <a href="#booking" class="nav-item nav-link">Contact</a>
    </div>
    <a href="#booking" class="btn btn-primary rounded-0 py-2 px-lg-4 d-none d-lg-block">Appointment<i class="fa fa-arrow-right ms-3"></i></a>
  </div>
</nav>
<!-- Navbar End -->


<!-- Carousel Start -->
<div class="container-fluid p-0 mb-5">
  <div id="header-carousel" class="carousel slide" data-bs-ride="carousel">
    <div class="carousel-inner">
      <div class="carousel-item active">
        <img class="w-100" src="/sajtbyggare/haircut/img/carousel-1.jpg" alt="Image">
        <div class="carousel-caption d-flex align-items-center justify-content-center text-start">
          <div class="mx-sm-5 px-5" style="max-width: 900px;">
            <h1 class="display-2 text-white text-uppercase mb-4">We Will Keep You An Awesome Look</h1>
            <h4 class="text-white text-uppercase mb-4"><i class="fa fa-map-marker-alt text-primary me-3"></i>123 Street, New York, USA</h4>
            <h4 class="text-white text-uppercase mb-4"><i class="fa fa-phone-alt text-primary me-3"></i>+012 345 67890</h4>
          </div>
        </div>
      </div>
      <div class="carousel-item">
        <img class="w-100" src="/sajtbyggare/haircut/img/carousel-2.jpg" alt="Image">
        <div class="carousel-caption d-flex align-items-center justify-content-center text-start">
          <div class="mx-sm-5 px-5" style="max-width: 900px;">
            <h1 class="display-2 text-white text-uppercase mb-4">Luxury Haircut at Affordable Price</h1>
            <h4 class="text-white text-uppercase mb-4"><i class="fa fa-map-marker-alt text-primary me-3"></i>123 Street, New York, USA</h4>
            <h4 class="text-white text-uppercase mb-4"><i class="fa fa-phone-alt text-primary me-3"></i>+012 345 67890</h4>
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


<!-- About Start -->
<div class="container-xxl py-5" id="about">
  <div class="container">
    <div class="row g-5">
      <div class="col-lg-6">
        <div class="d-flex flex-column">
          <img class="img-fluid w-75 align-self-end" src="/sajtbyggare/haircut/img/about.jpg" alt="">
          <div class="w-50 bg-secondary p-5" style="margin-top: -25%;">
            <h1 class="text-uppercase text-primary mb-3">25 Years</h1>
            <h2 class="text-uppercase mb-0">Experience</h2>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <p class="d-inline-block bg-secondary text-primary py-1 px-4">About Us</p>
        <h1 class="text-uppercase mb-4">More Than Just A Haircut. Learn More About Us!</h1>
        <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos. Clita erat ipsum et lorem et sit, sed stet lorem sit clita duo justo magna dolore erat amet</p>
        <p class="mb-4">Stet no et lorem dolor et diam, amet duo ut dolore vero eos. No stet est diam rebum amet diam ipsum. Clita clita labore, dolor duo nonumy clita sit at, sed sit sanctus dolor eos.</p>
        <div class="row g-4">
          <div class="col-md-6">
            <h3 class="text-uppercase mb-3">Since 1990</h3>
            <p class="mb-0">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos.</p>
          </div>
          <div class="col-md-6">
            <h3 class="text-uppercase mb-3">1000+ clients</h3>
            <p class="mb-0">Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam et eos.</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- About End -->


<!-- Service Start -->
<div class="container-xxl py-5" id="service">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 600px;">
      <p class="d-inline-block bg-secondary text-primary py-1 px-4">Services</p>
      <h1 class="text-uppercase">What We Provide</h1>
    </div>
    <div class="row g-4">
      <div class="col-lg-4 col-md-6">
        <div class="service-item position-relative overflow-hidden bg-secondary d-flex h-100 p-5 ps-0">
          <div class="bg-dark d-flex flex-shrink-0 align-items-center justify-content-center" style="width: 60px; height: 60px;">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/haircut.png" alt="">
          </div>
          <div class="ps-4">
            <h3 class="text-uppercase mb-3">Haircut</h3>
            <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam.</p>
            <span class="text-uppercase text-primary">From $15</span>
          </div>
          <a class="btn btn-square" href="#"><i class="fa fa-plus text-primary"></i></a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item position-relative overflow-hidden bg-secondary d-flex h-100 p-5 ps-0">
          <div class="bg-dark d-flex flex-shrink-0 align-items-center justify-content-center" style="width: 60px; height: 60px;">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/beard-trim.png" alt="">
          </div>
          <div class="ps-4">
            <h3 class="text-uppercase mb-3">Beard Trim</h3>
            <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam.</p>
            <span class="text-uppercase text-primary">From $15</span>
          </div>
          <a class="btn btn-square" href="#"><i class="fa fa-plus text-primary"></i></a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item position-relative overflow-hidden bg-secondary d-flex h-100 p-5 ps-0">
          <div class="bg-dark d-flex flex-shrink-0 align-items-center justify-content-center" style="width: 60px; height: 60px;">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/mans-shave.png" alt="">
          </div>
          <div class="ps-4">
            <h3 class="text-uppercase mb-3">Mans Shave</h3>
            <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam.</p>
            <span class="text-uppercase text-primary">From $15</span>
          </div>
          <a class="btn btn-square" href="#"><i class="fa fa-plus text-primary"></i></a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item position-relative overflow-hidden bg-secondary d-flex h-100 p-5 ps-0">
          <div class="bg-dark d-flex flex-shrink-0 align-items-center justify-content-center" style="width: 60px; height: 60px;">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/hair-dyeing.png" alt="">
          </div>
          <div class="ps-4">
            <h3 class="text-uppercase mb-3">Hair Dyeing</h3>
            <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam.</p>
            <span class="text-uppercase text-primary">From $15</span>
          </div>
          <a class="btn btn-square" href="#"><i class="fa fa-plus text-primary"></i></a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item position-relative overflow-hidden bg-secondary d-flex h-100 p-5 ps-0">
          <div class="bg-dark d-flex flex-shrink-0 align-items-center justify-content-center" style="width: 60px; height: 60px;">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/mustache.png" alt="">
          </div>
          <div class="ps-4">
            <h3 class="text-uppercase mb-3">Mustache</h3>
            <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam.</p>
            <span class="text-uppercase text-primary">From $15</span>
          </div>
          <a class="btn btn-square" href="#"><i class="fa fa-plus text-primary"></i></a>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <div class="service-item position-relative overflow-hidden bg-secondary d-flex h-100 p-5 ps-0">
          <div class="bg-dark d-flex flex-shrink-0 align-items-center justify-content-center" style="width: 60px; height: 60px;">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/stacking.png" alt="">
          </div>
          <div class="ps-4">
            <h3 class="text-uppercase mb-3">Stacking</h3>
            <p>Tempor erat elitr rebum at clita. Diam dolor diam ipsum sit. Aliqu diam amet diam.</p>
            <span class="text-uppercase text-primary">From $15</span>
          </div>
          <a class="btn btn-square" href="#"><i class="fa fa-plus text-primary"></i></a>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Service End -->


<!-- Price Start -->
<div class="container-xxl py-5" id="price">
  <div class="container">
    <div class="row g-0">
      <div class="col-lg-6">
        <div class="bg-secondary h-100 d-flex flex-column justify-content-center p-5">
          <p class="d-inline-flex bg-dark text-primary py-1 px-4 me-auto">Price & Plan</p>
          <h1 class="text-uppercase mb-4">Check Out Our Barber Services And Prices</h1>
          <div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Haircut</h6>
              <span class="text-uppercase text-primary">$29.00</span>
            </div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Beard Trim</h6>
              <span class="text-uppercase text-primary">$35.00</span>
            </div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Mans Shave</h6>
              <span class="text-uppercase text-primary">$23.00</span>
            </div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Hair Dyeing</h6>
              <span class="text-uppercase text-primary">$19.00</span>
            </div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Mustache</h6>
              <span class="text-uppercase text-primary">$15.00</span>
            </div>
            <div class="d-flex justify-content-between py-2">
              <h6 class="text-uppercase mb-0">Stacking</h6>
              <span class="text-uppercase text-primary">$39.00</span>
            </div>
          </div>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="h-100">
          <img class="img-fluid h-100" src="/sajtbyggare/haircut/img/price.jpg" alt="">
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Price End -->


<!-- Team Start -->
<div class="container-xxl py-5" id="team">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 600px;">
      <p class="d-inline-block bg-secondary text-primary py-1 px-4">Our Barber</p>
      <h1 class="text-uppercase">Meet Our Barber</h1>
    </div>
    <div class="row g-4">
      <div class="col-lg-3 col-md-6">
        <div class="team-item">
          <div class="team-img position-relative overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/team-1.jpg" alt="">
            <div class="team-social">
              <a class="btn btn-square" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-secondary text-center p-4">
            <h5 class="text-uppercase">Barber Name</h5>
            <span class="text-primary">Designation</span>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item">
          <div class="team-img position-relative overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/team-2.jpg" alt="">
            <div class="team-social">
              <a class="btn btn-square" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-secondary text-center p-4">
            <h5 class="text-uppercase">Barber Name</h5>
            <span class="text-primary">Designation</span>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item">
          <div class="team-img position-relative overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/team-3.jpg" alt="">
            <div class="team-social">
              <a class="btn btn-square" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-secondary text-center p-4">
            <h5 class="text-uppercase">Barber Name</h5>
            <span class="text-primary">Designation</span>
          </div>
        </div>
      </div>
      <div class="col-lg-3 col-md-6">
        <div class="team-item">
          <div class="team-img position-relative overflow-hidden">
            <img class="img-fluid" src="/sajtbyggare/haircut/img/team-4.jpg" alt="">
            <div class="team-social">
              <a class="btn btn-square" href="#"><i class="fab fa-facebook-f"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-twitter"></i></a>
              <a class="btn btn-square" href="#"><i class="fab fa-instagram"></i></a>
            </div>
          </div>
          <div class="bg-secondary text-center p-4">
            <h5 class="text-uppercase">Barber Name</h5>
            <span class="text-primary">Designation</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Team End -->


<!-- Working Hours Start -->
<div class="container-xxl py-5" id="hours">
  <div class="container">
    <div class="row g-0">
      <div class="col-lg-6">
        <div class="h-100">
          <img class="img-fluid h-100" src="/sajtbyggare/haircut/img/open.jpg" alt="">
        </div>
      </div>
      <div class="col-lg-6">
        <div class="bg-secondary h-100 d-flex flex-column justify-content-center p-5">
          <p class="d-inline-flex bg-dark text-primary py-1 px-4 me-auto">Working Hours</p>
          <h1 class="text-uppercase mb-4">Professional Barbers Are Waiting For You</h1>
          <div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Monday</h6>
              <span class="text-uppercase">09 AM - 09 PM</span>
            </div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Tuesday</h6>
              <span class="text-uppercase">09 AM - 09 PM</span>
            </div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Wednesday</h6>
              <span class="text-uppercase">09 AM - 09 PM</span>
            </div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Thursday</h6>
              <span class="text-uppercase">09 AM - 09 PM</span>
            </div>
            <div class="d-flex justify-content-between border-bottom py-2">
              <h6 class="text-uppercase mb-0">Friday</h6>
              <span class="text-uppercase">09 AM - 09 PM</span>
            </div>
            <div class="d-flex justify-content-between py-2">
              <h6 class="text-uppercase mb-0">Sat / Sun</h6>
              <span class="text-uppercase text-primary">Closed</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Working Hours End -->


<!-- Testimonial Start -->
<div class="container-xxl py-5" id="testimonial">
  <div class="container">
    <div class="text-center mx-auto mb-5" style="max-width: 600px;">
      <p class="d-inline-block bg-secondary text-primary py-1 px-4">Testimonial</p>
      <h1 class="text-uppercase">What Our Clients Say!</h1>
    </div>
    <div class="owl-carousel testimonial-carousel">
      <div class="testimonial-item text-center">
        <h4 class="text-uppercase">Client Name</h4>
        <p class="text-primary">Profession</p>
        <span class="fs-5">Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.</span>
      </div>
      <div class="testimonial-item text-center">
        <h4 class="text-uppercase">Client Name</h4>
        <p class="text-primary">Profession</p>
        <span class="fs-5">Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.</span>
      </div>
      <div class="testimonial-item text-center">
        <h4 class="text-uppercase">Client Name</h4>
        <p class="text-primary">Profession</p>
        <span class="fs-5">Clita clita tempor justo dolor ipsum amet kasd amet duo justo duo duo labore sed sed. Magna ut diam sit et amet stet eos sed clita erat magna elitr erat sit sit erat at rebum justo sea clita.</span>
      </div>
    </div>
  </div>
</div>
<!-- Testimonial End -->


<!-- Booking Start (folded from the vendor contact.html "Contact" section) -->
<div class="container-xxl py-5" id="booking">
  <div class="container">
    <div class="row g-0">
      <div class="col-lg-6">
        <div class="bg-secondary p-5">
          <p class="d-inline-block bg-dark text-primary py-1 px-4">Contact Us</p>
          <h1 class="text-uppercase mb-4">Have Any Query? Please Contact Us!</h1>
          <corevo-module type="booking" pos="booking"></corevo-module>
        </div>
      </div>
      <div class="col-lg-6">
        <div class="h-100" style="min-height: 400px;">
          <iframe class="google-map w-100 h-100" src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3001156.4288297426!2d-78.01371936852176!3d42.72876761954724!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x4ccc4bf0f123a5a9%3A0xddcfc6c1de189567!2sNew%20York%2C%20USA!5e0!3m2!1sen!2sbd!4v1603794290143!5m2!1sen!2sbd" frameborder="0" allowfullscreen="" aria-hidden="false" tabindex="0" style="filter: grayscale(100%) invert(92%) contrast(83%); border: 0;"></iframe>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Booking End -->


<!-- Footer Start -->
<div class="container-fluid bg-secondary text-light footer mt-5 pt-5">
  <div class="container py-5">
    <div class="row g-5">
      <div class="col-lg-4 col-md-6">
        <h4 class="text-uppercase mb-4">Get In Touch</h4>
        <div class="d-flex align-items-center mb-2">
          <div class="btn-square bg-dark flex-shrink-0 me-3">
            <span class="fa fa-map-marker-alt text-primary"></span>
          </div>
          <span>123 Street, New York, USA</span>
        </div>
        <div class="d-flex align-items-center mb-2">
          <div class="btn-square bg-dark flex-shrink-0 me-3">
            <span class="fa fa-phone-alt text-primary"></span>
          </div>
          <span>+012 345 67890</span>
        </div>
        <div class="d-flex align-items-center">
          <div class="btn-square bg-dark flex-shrink-0 me-3">
            <span class="fa fa-envelope-open text-primary"></span>
          </div>
          <span>info@example.com</span>
        </div>
      </div>
      <div class="col-lg-4 col-md-6">
        <h4 class="text-uppercase mb-4">Quick Links</h4>
        <a class="btn btn-link" href="#">About Us</a>
        <a class="btn btn-link" href="#">Contact Us</a>
        <a class="btn btn-link" href="#">Our Services</a>
        <a class="btn btn-link" href="#">Terms & Condition</a>
        <a class="btn btn-link" href="#">Support</a>
      </div>
      <div class="col-lg-4 col-md-6">
        <h4 class="text-uppercase mb-4">Newsletter</h4>
        <div class="position-relative mb-4">
          <input class="form-control border-0 w-100 py-3 ps-4 pe-5" type="text" placeholder="Your email">
          <button type="button" class="btn btn-primary py-2 position-absolute top-0 end-0 mt-2 me-2">SignUp</button>
        </div>
        <div class="d-flex pt-1 m-n1">
          <a class="btn btn-lg-square btn-dark text-primary m-1" href="#"><i class="fab fa-twitter"></i></a>
          <a class="btn btn-lg-square btn-dark text-primary m-1" href="#"><i class="fab fa-facebook-f"></i></a>
          <a class="btn btn-lg-square btn-dark text-primary m-1" href="#"><i class="fab fa-youtube"></i></a>
          <a class="btn btn-lg-square btn-dark text-primary m-1" href="#"><i class="fab fa-linkedin-in"></i></a>
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
          <!--/*** This template is free as long as you keep the footer author’s credit link/attribution link/backlink. If you'd like to use the template without the footer author’s credit link/attribution link/backlink, you can purchase the Credit Removal License from "https://htmlcodex.com/credit-removal". Thank you for your support. ***/-->
          Designed By <a class="border-bottom" href="https://htmlcodex.com">HTML Codex</a>
          <br>Distributed By: <a class="border-bottom" href="https://themewagon.com" target="_blank">ThemeWagon</a>
        </div>
      </div>
    </div>
  </div>
</div>
<!-- Footer End -->

<div class="container-fluid bg-dark text-light py-4 mt-5">
  <div class="container text-center">
    <small class="text-light">Mall: <a class="text-primary" href="https://htmlcodex.com" rel="nofollow">HairCut by HTML Codex</a> (kräver-kredit) — Corevo sajtbyggare.</small>
  </div>
</div>
`.trim()

/** The template's own stylesheets (served from public/). Loaded on the spike route
 *  so the imported page renders with the vendor's real CSS. External CDN deps
 *  (Google Fonts — Roboto/Oswald, Font Awesome, bootstrap-icons, animate.css,
 *  owl.carousel.css) are intentionally NOT loaded — blocked by the app CSP — so
 *  fonts fall back, the <i class="fa"> icons are blank, the Bootstrap hero carousel
 *  shows its first slide statically, the owl testimonial carousel renders stacked,
 *  and the Google-map iframe is empty. */
export const HAIRCUT_CSS_HREFS = [
  '/sajtbyggare/haircut/css/bootstrap.min.css',
  '/sajtbyggare/haircut/css/style.css',
] as const
