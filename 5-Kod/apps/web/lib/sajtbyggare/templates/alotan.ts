// The 'alotan' vendor template, imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/alotan-master — "Alotan" (Barber
// Shop HTML Template) by Colorlib (kräver-kredit / CC BY 3.0: the footer "made with
// … by Colorlib" link can't be removed). A FAITHFUL, FULL copy of the vendor
// index.html — all content sections (Header/nav, Hero, Quick-info, Services slider,
// Barber Features, the appointment CTA band, Good Looking Style, Footer). The vendor
// JS loader spinner is dropped (JS-only).
//
// Transformations applied at import time (the "onboarding job") — verbatim copy of
// the vendor markup PLUS these edits ONLY:
//   1. asset paths images/… → /sajtbyggare/alotan/images/… (served from public/);
//      css/… → /sajtbyggare/alotan/css/… .
//   2. vendor JS stripped (jquery/popper/bootstrap/owl.carousel/waypoints/stellar/
//      magnific-popup/main) — static-first. All <script> removed; the JS-only
//      navbar-toggler button + data-toggle/data-target attrs removed. The inert
//      `element-animate` / `data-animate-effect` / `data-stellar-background-ratio`
//      hooks are NOT in the enumerated strip set, so they are left inert (no JS
//      loaded) — the page renders statically. The JS loading spinner (<div
//      id="loader">, which also carried two non-vendor hex literals #eeeeee/#f4b214)
//      is removed.
//   3. alotan's home page has NO native <form>; its appointment intent is the
//      "Make an Appointment" CTA band (<h2>Appoint a Haircut Today and Get 25%
//      discount</h2>). The template's OWN appointment <form> (from contact.html) is
//      folded into THIS band and REPLACED by the module marker
//      <corevo-module type="booking" pos="booking"> — woven at render. The CTA
//      heading is kept verbatim; the dead "Make an Appointment" <a> button it
//      replaced is dropped. After the weave NO <form> remains. Exactly ONE marker.
//   4. nav links that pointed to other vendor pages (index/about/contact/hairstyle
//      .html) → in-page anchors (#, #services, #about, #booking). Section wrappers
//      carry matching ids so the anchors resolve. The Haircut dropdown markup is
//      kept verbatim but inert (its data-toggle is in the strip set, no JS to open
//      it) — same documented static-mode tradeoff.
//   5. The vendor's REAL Footer (incl. the Colorlib CC-BY credit + the
//      "can't be removed" comment) is reproduced faithfully; the Corevo attribution
//      strip is kept last.
//
// NOTE on sanitization: this string is author-controlled (we imported it), so it
// is trusted. TENANT-edited HTML MUST be sanitized at SAVE time.
export const ALOTAN_PAGE_HTML = `
<header role="banner">
     
      <nav class="navbar navbar-expand-md navbar-dark bg-light">
        <div class="container">
          <a class="navbar-brand" href="#">Alotan</a>


          <div class="collapse navbar-collapse navbar-light" id="navbarsExample05">
            <ul class="navbar-nav ml-auto pl-lg-5 pl-0">
              <li class="nav-item">
                <a class="nav-link active" href="#">Home</a>
              </li>
              <li class="nav-item dropdown">
                <a class="nav-link dropdown-toggle" href="#services" id="dropdown04" aria-haspopup="true" aria-expanded="false">Haircut</a>
                <div class="dropdown-menu" aria-labelledby="dropdown04">
                  <a class="dropdown-item" href="#services">Crew Cut</a>
                  <a class="dropdown-item" href="#services">Regular Hair Cut</a>
                  <a class="dropdown-item" href="#services">Shampoo + Cut</a>
                  <a class="dropdown-item" href="#services">Beard Trim with Razor</a>
                  <a class="dropdown-item" href="#services">Hair Color</a>
                </div>

              </li>
              <li class="nav-item">
                <a class="nav-link" href="#about">About</a>
              </li>
              <li class="nav-item">
                <a class="nav-link" href="#booking">Contact</a>
              </li>
            </ul>
            
          </div>
        </div>
      </nav>
    </header>
    <!-- END header -->

    <section class="site-hero overlay" data-stellar-background-ratio="0.5" style="background-image: url(/sajtbyggare/alotan/images/big_image_1.jpg);">
      <div class="container">
        <div class="row align-items-center site-hero-inner justify-content-center">
          <div class="col-md-8 text-center">

            <div class="mb-5 element-animate">
              <img src="/sajtbyggare/alotan/images/banner_text_1.png" alt="Image placeholder" class="img-md-fluid">
            </div>

          </div>
        </div>
      </div>
    </section>
    <!-- END section -->

    <section class="quick-info element-animate" data-animate-effect="fadeInLeft">
      <div class="container">
        <div class="row">
          <div class="col-lg-8 bgcolor">
            <div class="row">
              <div class="col-md-4 mb-3">
                <div class="media">
                  <div class="mr-3 icon-wrap"><span class="icon ion-ios-telephone"></span></div>
                  <div class="media-body">
                    <h5>+1 234 5633 342</h5>
                    <p>Call us 24/7 we will get back to you ASAP</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4 mb-3">
                <div class="media">
                  <div class="mr-3 icon-wrap"><span class="icon ion-location"></span></div>
                  <div class="media-body">
                    <h5>249 Division Rad</h5>
                    <p>Fake st. New York, New York City,  PO 2923 USA</p>
                  </div>
                </div>
              </div>
              <div class="col-md-4 mb-3">
                <div class="media">
                  <div class="mr-3 icon-wrap"><span class="icon ion-android-time"></span></div>
                  <div class="media-body">
                    <h5>Daily: 8 am - 10 pm</h5>
                    <p>Mon-Fri, Sunday <br> Saturday: Closed</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- END section -->


    <section class="site-section" id="services">
      <div class="container">
        <div class="row">
          <div class="col-md-4 pr-5">

            <h2 class="mb-3">Services</h2>
            <p class="mb-5">Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts. </p>
            
            <div class="mb-3 custom-nav">
              <a href="#" class="btn btn-primary btn-sm custom-prev mr-2 mb-2"><span class="ion-android-arrow-back"></span></a> 
              <a href="#" class="btn btn-primary btn-sm custom-next mr-2 mb-2"><span class="ion-android-arrow-forward"></span></a>
            </div>
          </div>
          <div class="col-md-8">
            <div class="row">
              <div class="col-md-12 slider-wrap">
                <div class="owl-carousel owl-theme no-nav js-carousel-1">
                  
                  <a href="#" class="img-bg" style="background-image: url('/sajtbyggare/alotan/images/img_2.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Haircuting</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg" style="background-image: url('/sajtbyggare/alotan/images/img_1.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Beard Shaving</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg last" style="background-image: url('/sajtbyggare/alotan/images/img_3.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Cream &amp; Shampoo</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg" style="background-image: url('/sajtbyggare/alotan/images/img_2.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Haircuting</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg" style="background-image: url('/sajtbyggare/alotan/images/img_1.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Beard Shaving</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg last" style="background-image: url('/sajtbyggare/alotan/images/img_3.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Cream &amp; Shampoo</h2>
                      <p>Read More</p>
                    </div>
                  </a>
                  <a href="#" class="img-bg" style="background-image: url('/sajtbyggare/alotan/images/img_2.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Haircuting</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg" style="background-image: url('/sajtbyggare/alotan/images/img_1.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Beard Shaving</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg last" style="background-image: url('/sajtbyggare/alotan/images/img_3.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Cream &amp; Shampoo</h2>
                      <p>Read More</p>
                    </div>
                  </a>
                  <a href="#" class="img-bg" style="background-image: url('/sajtbyggare/alotan/images/img_2.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Haircuting</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg" style="background-image: url('/sajtbyggare/alotan/images/img_1.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Beard Shaving</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                  <a href="#" class="img-bg last" style="background-image: url('/sajtbyggare/alotan/images/img_3.jpg')">
                    <div class="text">
                      <span class="icon custom-icon flaticon-scissors"></span>
                      <h2>Cream &amp; Shampoo</h2>
                      <p>Read More</p>
                    </div>
                  </a>

                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- END section -->

    <section class="site-section">
      <div class="container">
        <div class="row justify-content-center mb-5">
          <div class="col-md-7 text-center">
            <h2>Barber Features</h2>
            <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Earum magnam illum maiores adipisci pariatur, eveniet.</p>
          </div>
        </div>
        <div class="row">
          <div class="col-md-4">

            <div class="media d-block media-feature text-center">
              <div class="mr-3 icon-wrap"><span class="custom-icon flaticon-scissors-1"></span></div>
              <div class="media-body">
                <h3>Shave &amp; Haircut</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, assumenda rem nulla odio iure animi repellat voluptates ullam omnis enim?</p>
              </div>
            </div>

          </div>
          <div class="col-md-4">
            <div class="media d-block media-feature text-center">
              <div class="mr-3 icon-wrap"><span class="custom-icon flaticon-cream"></span></div>
              <div class="media-body">
                <h3>Cream &amp; Shampoo</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, assumenda rem nulla odio iure animi repellat voluptates ullam omnis enim?</p>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="media d-block media-feature text-center">
              <div class="mr-3 icon-wrap"><span class="custom-icon flaticon-moustache"></span></div>
              <div class="media-body">
                <h3>Mustache Expert</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, assumenda rem nulla odio iure animi repellat voluptates ullam omnis enim?</p>
              </div>
            </div>
          </div>
        </div>

        <div class="row">
          <div class="col-md-4">

            <div class="media d-block media-feature text-center">
              <div class="mr-3 icon-wrap"><span class="custom-icon flaticon-scissors"></span></div>
              <div class="media-body">
                <h3>Haircut Styler</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, assumenda rem nulla odio iure animi repellat voluptates ullam omnis enim?</p>
              </div>
            </div>

          </div>
          <div class="col-md-4">
            <div class="media d-block media-feature text-center">
              <div class="mr-3 icon-wrap"><span class="custom-icon flaticon-razor"></span></div>
              <div class="media-body">
                <h3>Razor For Beards</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, assumenda rem nulla odio iure animi repellat voluptates ullam omnis enim?</p>
              </div>
            </div>
          </div>
          <div class="col-md-4">
            <div class="media d-block media-feature text-center">
              <div class="mr-3 icon-wrap"><span class="custom-icon flaticon-hair-comb"></span></div>
              <div class="media-body">
                <h3>Haircomb</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Corrupti, assumenda rem nulla odio iure animi repellat voluptates ullam omnis enim?</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    <!-- END section -->

    <!-- Booking Start: index.html "Make an Appointment" CTA band; contact.html appointment form folded in and REPLACED by the booking module -->
    <section class="section-cover cta" id="booking" data-stellar-background-ratio="0.5" style="background-image: url(/sajtbyggare/alotan/images/big_image_2.jpg);">
      <div class="container">
        <div class="row justify-content-center align-items-center intro">
          <div class="col-md-8 text-center element-animate">
            <h2 class="mb-4"><span>Appoint a Haircut Today and</span> Get 25% discount</h2>
            <corevo-module type="booking" pos="booking"></corevo-module>
          </div>
        </div>
      </div>
    </section>
    <!-- Booking End -->

    <section class="site-section" id="about">
      <div class="container">
        <div class="row">
          <div class="col-md-6 video-wrap mb-5">
            <img src="/sajtbyggare/alotan/images/img_5.jpg" alt="Image placeholder" class="img-fluid">
            <a href="https://vimeo.com/channels/staffpicks/93951774" class="popup-vimeo btn-video"><span class="fa fa-play"></span></a>
          </div>
          <div class="col-md-6 pl-md-5">
            <h3>Good Looking Style</h3>
            <p class="lead">Start with us today</p>
            <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Quam facere a excepturi quod impedit rerum ipsum totam incidunt, necessitatibus id veritatis maiores quos saepe dolore commodi magnam fugiat. Incidunt, omnis.</p>
            <p>Nobis quae eaque facere architecto eligendi, voluptas quasi, blanditiis aperiam possimus inventore quis nam! Cupiditate necessitatibus, voluptatem excepturi placeat exercitationem quos vitae ut vero dolorem, provident sit odio porro facere.</p>
          </div>
        </div>
      </div>
    </section>
    <!-- END section -->
    
    
   
    <footer class="site-footer">
      <div class="container">
        <div class="row mb-5">
          <div class="col-md-4">
            <h3 class="mb-4">About</h3>
            <p class="mb-4">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Aut, quod!</p>
            <ul class="list-unstyled">
              <li class="d-flex"><span class="mr-3"><span class="icon ion-ios-location"></span></span><span class="">34 Street Name, City Name Here, United States</span></li>
              <li class="d-flex"><span class="mr-3"><span class="icon ion-ios-telephone"></span></span><span class="">+1 242 4942 290</span></li>
              <li class="d-flex"><span class="mr-3"><span class="icon ion-email"></span></span><span class="">info@yourdomain.com</span></li>
            </ul>
          </div>
          <div class="col-md-2">
            <h3 class="mb-4">Links</h3>
            <ul class="list-unstyled">
              <li><a href="#">About</a></li>
              <li><a href="#">Hairstyle</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
          <div class="col-md-3">
            <h3 class="mb-4">Latest Blog</h3>
            <ul class="list-unstyled blog-entry-footer">
              <li><a href="#">
                <span class="post-meta">March 20, 2018</span>
                <h3>7 Best Destination in The World</h3></a>
              </li>
              <li><a href="#">
                <span class="post-meta">March 20, 2018</span>
                <h3>4 Hour Work Week And The Rest Is Travel</h3></a>
              </li>
              <li><a href="#">
                <span class="post-meta">March 20, 2018</span>
                <h3>Why You Should Travel Today</h3></a>
              </li>
            </ul>
          </div>
          <div class="col-md-3">
            <h3>Connect</h3>
            <p>
              <a href="#" class="p-2"><span class="fa fa-facebook"></span></a>
              <a href="#" class="p-2"><span class="fa fa-twitter"></span></a>
              <a href="#" class="p-2"><span class="fa fa-instagram"></span></a>
            </p>
          </div>
        </div>
        <div class="row justify-content-center">
          <div class="col-md-7 text-center">
            <!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. -->
Copyright &copy; All rights reserved | This template is made with <i class="fa fa-heart-o" aria-hidden="true"></i> by <a href="https://colorlib.com" target="_blank">Colorlib</a>
<!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. -->
          </div>
        </div>
      </div>
    </footer>
    <!-- END footer -->

<div class="container-fluid bg-dark text-light py-4 mt-5">
  <div class="container text-center">
    <small class="text-light">Mall: <a class="text-primary" href="https://colorlib.com" rel="nofollow">Alotan by Colorlib</a> (kräver-kredit, CC BY 3.0) — Corevo sajtbyggare.</small>
  </div>
</div>
`.trim()

export const ALOTAN_CSS_HREFS = [
  'https://fonts.googleapis.com/css?family=Roboto:300,400,700',
  '/sajtbyggare/alotan/css/bootstrap.css',
  // owl.carousel.min.css DROPPED (goal-36): `.owl-carousel{display:none}` only flips to
  // block via owl's (stripped) JS → it HID the Services slider. Without it the 12 service
  // tiles render stacked + visible (static-first).
  '/sajtbyggare/alotan/css/magnific-popup.css',
  '/sajtbyggare/alotan/fonts/ionicons/css/ionicons.min.css',
  '/sajtbyggare/alotan/fonts/fontawesome/css/font-awesome.min.css',
  '/sajtbyggare/alotan/fonts/flaticon/font/flaticon.css',
  '/sajtbyggare/alotan/css/style.css',
] as const
