// The 'hairsal' vendor template, imported AS DATA (not a React file).
//
// Source: Hairsal by Colorlib (https://colorlib.com), licensed CC BY 3.0
// (kräver-kredit: the footer Colorlib backlink + its "can't be removed / CC BY 3.0"
// comment are kept verbatim — stripping them = licence breach + proof FAIL). A
// FAITHFUL, FULL copy of the vendor index.html home page — all content sections
// (Header/nav, hero owl-slider, Welcome intro + Opening Hours, Featured Services,
// "New hairstyle!" testimonial, video CTA cover, Footer) — PLUS the real booking
// <form> SECTION folded in from booking.html (the home page carries no inline
// booking form; this is the template's OWN content, never an invented section).
//
// Transformations applied at import time (the "onboarding job") — verbatim copy of
// the vendor markup PLUS these edits ONLY:
//   1. asset paths images/… → /sajtbyggare/hairsal/images/… (served from public/);
//      css/… → /sajtbyggare/hairsal/css/… . Dead/other-page nav links → "#" (no
//      section), and the "Book Online" nav link → "#booking" (the folded section).
//   2. vendor JS stripped (jQuery/popper/bootstrap/owl/stellar/countdown/magnific/
//      datepicker/aos + main.js) — static-first. All <script> removed (incl. the
//      Cloudflare email-decode + the date-write inline scripts in the footer credit;
//      the credit TEXT + Colorlib link survive). hairsal has no spinner/back-to-top/
//      navbar-toggler chrome. The owl-carousel hero + the `data-aos` reveal hooks are
//      left inert (their CSS — owl.carousel/aos — is intentionally NOT loaded, see
//      HAIRSAL_CSS_HREFS), so both hero slides render stacked + content stays visible.
//   3. The home page has NO booking form; booking.html's real <form action="#"
//      class="p-5 bg-white"> (its "Book Now" heading + First/Last name, Date, Email,
//      Service, Notes fields) is folded in as a new Booking section (id="booking")
//      and the <form>…</form> is REPLACED by the module marker
//      <corevo-module type="booking" pos="booking"> — woven at render. The "Book Now"
//      heading + the booking page's Address / More Info column are kept verbatim.
//      The footer "Subscribe Newsletter" <form> is the vendor's OWN home-page markup
//      and is kept verbatim — so AFTER the weave the page has exactly ONE booking
//      marker and the newsletter is the only surviving <form>. No booking field
//      (e.g. "Service You Want") survives.
//
// NOTE on sanitization: this string is author-controlled (we imported it), so it
// is trusted. TENANT-edited HTML MUST be sanitized at SAVE time.
export const HAIRSAL_PAGE_HTML = `
<div class="site-wrap">

    <div class="site-mobile-menu">
      <div class="site-mobile-menu-header">
        <div class="site-mobile-menu-close mt-3">
          <span class="icon-close2 js-menu-toggle"></span>
        </div>
      </div>
      <div class="site-mobile-menu-body"></div>
    </div>
    



    <header class="site-navbar py-1" role="banner">

      <div class="container-fluid">
        <div class="row align-items-center">
          
          <div class="col-6 col-xl-2" data-aos="fade-down">
            <h1 class="mb-0"><a href="#" class="text-black h2 mb-0">Hairsal</a></h1>
          </div>
          <div class="col-10 col-md-8 d-none d-xl-block" data-aos="fade-down">
            <nav class="site-navigation position-relative text-right text-lg-center" role="navigation">

              <ul class="site-menu js-clone-nav mx-auto d-none d-lg-block">
                <li class="has-children active">
                  <a href="#">Home</a>
                  <ul class="dropdown">
                    <li><a href="#">Menu One</a></li>
                    <li><a href="#">Menu Two</a></li>
                    <li><a href="#">Menu Three</a></li>
                    <li class="has-children">
                      <a href="#">Sub Menu</a>
                      <ul class="dropdown">
                        <li><a href="#">Menu One</a></li>
                        <li><a href="#">Menu Two</a></li>
                        <li><a href="#">Menu Three</a></li>
                      </ul>
                    </li>
                  </ul>
                </li>
                <li class="has-children">
                  <a href="#">Haircut</a>
                  <ul class="dropdown">
                    <li><a href="#">Menu One</a></li>
                    <li><a href="#">Menu Two</a></li>
                    <li><a href="#">Menu Three</a></li>
                  </ul>
                </li>
                <li><a href="#">Services</a></li>
                <li><a href="#">About</a></li>
                <li><a href="#booking">Book Online</a></li>
                <li><a href="#">Contact</a></li>
              </ul>
            </nav>
          </div>

          <div class="col-6 col-xl-2 text-right" data-aos="fade-down">
            <div class="d-none d-xl-inline-block">
              <ul class="site-menu js-clone-nav ml-auto list-unstyled d-flex text-right mb-0" data-class="social">
                <li>
                  <a href="#" class="pl-0 pr-3 text-black"><span class="icon-facebook"></span></a>
                </li>
                <li>
                  <a href="#" class="pl-3 pr-3 text-black"><span class="icon-twitter"></span></a>
                </li>
                <li>
                  <a href="#" class="pl-3 pr-3 text-black"><span class="icon-instagram"></span></a>
                </li>
                <li>
                  <a href="#" class="pl-3 pr-3 text-black"><span class="icon-youtube-play"></span></a>
                </li>
              </ul>
            </div>

            <div class="d-inline-block d-xl-none ml-md-0 mr-auto py-3" style="position: relative; top: 3px;"><a href="#" class="site-menu-toggle js-menu-toggle text-black"><span class="icon-menu h3"></span></a></div>

          </div>

        </div>
      </div>
      
    </header>

  

   

    <div class="slide-one-item home-slider owl-carousel">
      
      <div class="site-blocks-cover" style="background-image: url(/sajtbyggare/hairsal/images/hero_bg_1.jpg);" data-aos="fade" data-stellar-background-ratio="0.5">
        <div class="container">
          <div class="row align-items-center justify-content-center text-center">

            <div class="col-md-8" data-aos="fade-up" data-aos-delay="400">
              <h5 class="text-white font-weight-light text-uppercase">Welcome to Hairsal</h5>
              <h2 class="text-white font-weight-light mb-2 display-1">Hair Salon Expert</h2>

              <p><a href="#" class="btn btn-black py-3 px-5">Book Now!</a></p>
            </div>
          </div>
        </div>
      </div>  

      <div class="site-blocks-cover" style="background-image: url(/sajtbyggare/hairsal/images/hero_bg_2.jpg);" data-aos="fade" data-stellar-background-ratio="0.5">
        <div class="container">
          <div class="row align-items-center justify-content-center text-center">

            <div class="col-md-8" data-aos="fade-up" data-aos-delay="400">
              <h2 class="text-white font-weight-light mb-2 display-1">Beautiful Hair, Healthy You!</h2>

              <p><a href="#" class="btn btn-black py-3 px-5">Book Now!</a></p>
            </div>
          </div>
        </div>
      </div>  

    </div>


    <div class="site-section">
      <div class="container">
        <div class="row">
          <div class="col-md-6 col-lg-4 text-center">
            <h3 class="line-height-1 mb-3"><span class="d-block display-4 line-height-1 text-black">Welcome to</span> <span class="d-block display-4 line-height-1"><em class="text-primary font-weight-bold">Hair Salon</em></span></h3>
            <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Incidunt architecto ab hic rem placeat eius commodi eum eligendi recusandae sed qui cumque quibusdam.</p>
            <p><a href="#"><small class="text-uppercase font-weight-bold">Read More</small></a></p>
          </div>
          <div class="col-md-6 col-lg-4">
            <figure class="h-100 hover-bg-enlarge">
              <div class="bg-image h-100 bg-image-md-height" style="background-image: url('/sajtbyggare/hairsal/images/img_2.jpg');"></div>
            </figure>
          </div>
          <div class="col-md-6 col-lg-4">
            <div class="border p-4 d-flex align-items-center justify-content-center h-100">
              <div class="text-center">
                <h2 class="text-primary h2 mb-5">Opening Hours</h2>
                <p class="mb-4">
                  <span class="d-block font-weight-bold">Mon – Fri </span>
                  10:00 AM – 8:30 PM
                </p>

                <p class="mb-4">
                  <span class="d-block font-weight-bold">Saturday</span>
                  Closed
                </p>

                <p class="mb-4">
                  <span class="d-block font-weight-bold">Sunday</span>
                  10:00 AM – 8:30 PM
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="site-section">
      <div class="container">
        <div class="row justify-content-center mb-5">
          <div class="col-md-7">
            <h2 class="site-section-heading font-weight-light text-black text-center">Featured Services</h2>
          </div>
        </div>

        <div class="row">
          <div class="col-md-6 col-lg-4 text-center mb-5 mb-lg-5">
            <div class="h-100 p-4 p-lg-5 bg-light site-block-feature-7">
              <span class="icon flaticon-razor display-3 text-primary mb-4 d-block"></span>
              <h3 class="text-black h4">Barber Razor</h3>
              <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum exercitationem quae id dolorum debitis.</p>
              <p><strong class="font-weight-bold text-primary">$29</strong></p>
            </div>
          </div>
          <div class="col-md-6 col-lg-4 text-center mb-5 mb-lg-5">
            <div class="h-100 p-4 p-lg-5 bg-light site-block-feature-7">
              <span class="icon flaticon-location-pin display-3 text-primary mb-4 d-block"></span>
              <h3 class="text-black h4">Location Pin</h3>
              <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum exercitationem quae id dolorum debitis.</p>
              <p><strong class="font-weight-bold text-primary">$46</strong></p>
            </div>
          </div>
          <div class="col-md-6 col-lg-4 text-center mb-5 mb-lg-5">
            <div class="h-100 p-4 p-lg-5 bg-light site-block-feature-7">
              <span class="icon flaticon-shave display-3 text-primary mb-4 d-block"></span>
              <h3 class="text-black h4">Barber Shave</h3>
              <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Rerum exercitationem quae id dolorum debitis.</p>
              <p><strong class="font-weight-bold text-primary">$24</strong></p>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div class="site-section bg-light">
      <div class="container">
        <div class="row">
          <div class="col-lg-6 mb-5">
            <img src="/sajtbyggare/hairsal/images/person_1.jpg" alt="Image" class="img-md-fluid">
          </div>
          <div class="col-lg-6 bg-white p-md-5 align-self-center">
            <h2 class="display-1 text-black line-height-1 site-section-heading mb-4 pb-3">New hairstyle!</h2>
            <p class="text-black lead"><em>&ldquo;Lorem ipsum dolor sit amet, consectetur adipisicing elit. Similique dolorem quisquam laudantium, incidunt id laborum, tempora aliquid labore minus. Nemo maxime, veniam! Fugiat odio nam eveniet ipsam atque, corrupti porro&rdquo;</em></p>
            <p class="lead text-black">&mdash; <em>Stellla Martin</em></p>
          </div>
        </div>
      </div>
    </div>


    <div class="site-blocks-cover overlay inner-page-cover" style="background-image: url(/sajtbyggare/hairsal/images/hero_bg_2.jpg); background-attachment: fixed;">
      <div class="container">
        <div class="row align-items-center justify-content-center text-center">

          <div class="col-md-10" data-aos="fade-up" data-aos-delay="400">
            <h2 class="text-white font-weight-light mb-5 display-3">Experience Our Outstanding Services</h2>
            <a href="https://vimeo.com/channels/staffpicks/93951774" class="play-single-big d-inline-block popup-vimeo"><span class="icon-play"></span></a>
          </div>
        </div>
      </div>
    </div>  

    
    <!-- Booking Start (folded verbatim from booking.html; its booking form replaced by the module) -->
    <div class="site-section bg-light" id="booking">
      <div class="container">
        <div class="row">
          <div class="col-md-7 mb-5">

            <div class="p-5 bg-white">
              <h2 class="mb-4 site-section-heading">Book Now</h2>
              <corevo-module type="booking" pos="booking"></corevo-module>
            </div>
          </div>
          <div class="col-md-5">

            <div class="p-4 mb-3 bg-white">
              <p class="mb-0 font-weight-bold">Address</p>
              <p class="mb-4">203 Fake St. Mountain View, San Francisco, California, USA</p>

              <p class="mb-0 font-weight-bold">Phone</p>
              <p class="mb-4"><a href="#">+1 232 3235 324</a></p>

              <p class="mb-0 font-weight-bold">Email Address</p>
              <p class="mb-0"><a href="#">youremail@domain.com</a></p>

            </div>

            <div class="p-4 mb-3 bg-white">
              <h3 class="h5 text-black mb-3">More Info</h3>
              <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Ipsa ad iure porro mollitia architecto hic consequuntur. Distinctio nisi perferendis dolore, ipsa consectetur? Fugiat quaerat eos qui, libero neque sed nulla.</p>
              <p><a href="#" class="btn btn-primary px-4 py-2 text-white">Get In Touch</a></p>
            </div>

          </div>
        </div>
      </div>
    </div>
    <!-- Booking End -->


    <footer class="site-footer">
      <div class="container">
        <div class="row">
          <div class="col-lg-4">
            <div class="mb-5">
              <h3 class="footer-heading mb-4">About Hairsal</h3>
              <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Saepe pariatur reprehenderit vero atque, consequatur id ratione, et non dignissimos culpa? Ut veritatis, quos illum totam quis blanditiis, minima minus odio!</p>
            </div>

            
            
          </div>
          <div class="col-lg-4 mb-5 mb-lg-0">
            <div class="row mb-5">
              <div class="col-md-12">
                <h3 class="footer-heading mb-4">Quick Menu</h3>
              </div>
              <div class="col-md-6 col-lg-6">
                <ul class="list-unstyled">
                  <li><a href="#">Home</a></li>
                  <li><a href="#">Barbers</a></li>
                  <li><a href="#">News</a></li>
                  <li><a href="#">Team</a></li>
                </ul>
              </div>
              <div class="col-md-6 col-lg-6">
                <ul class="list-unstyled">
                  <li><a href="#">About Us</a></li>
                  <li><a href="#">Privacy Policy</a></li>
                  <li><a href="#">Contact Us</a></li>
                  <li><a href="#">Membership</a></li>
                </ul>
              </div>
            </div>

            

          </div>

          <div class="col-lg-4 mb-5 mb-lg-0">
           

            <div class="mb-5">
              <h3 class="footer-heading mb-2">Subscribe Newsletter</h3>
              <p>Lorem ipsum dolor sit amet consectetur adipisicing elit minima minus odio.</p>

              <form action="#" method="post">
                <div class="input-group mb-3">
                  <input type="text" class="form-control border-secondary text-white bg-transparent" placeholder="Enter Email" aria-label="Enter Email" aria-describedby="button-addon2">
                  <div class="input-group-append">
                    <button class="btn btn-primary text-white" type="button" id="button-addon2">Send</button>
                  </div>
                </div>
              </form>

            </div>

          </div>
          
        </div>
        <div class="row pt-5 mt-5 text-center">
          <div class="col-md-12">
            <div class="mb-5">
              <a href="#" class="pl-0 pr-3"><span class="icon-facebook"></span></a>
              <a href="#" class="pl-3 pr-3"><span class="icon-twitter"></span></a>
              <a href="#" class="pl-3 pr-3"><span class="icon-instagram"></span></a>
              <a href="#" class="pl-3 pr-3"><span class="icon-linkedin"></span></a>
            </div>

            <p>
            <!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. -->
            Copyright &copy; All rights reserved | This template is made with <i class="icon-heart-o" aria-hidden="true"></i> by <a href="https://colorlib.com" target="_blank" >Colorlib</a>
            <!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. -->
            </p>
          </div>
          
        </div>
      </div>
    </footer>
  </div>

  
  
  
  
  
  
  
  
  
  
  

  
`.trim()

/** The template's own stylesheets (served from public/). Loaded on the spike route
 *  so the imported page renders with the vendor's real CSS. Mirrors carserv's
 *  minimal static-first set: ONLY the layout + theme sheets are loaded. The vendor's
 *  JS-component / animation CSS is intentionally NOT loaded —
 *    - owl.carousel/owl.theme: `.owl-carousel { display:none }` would HIDE the hero
 *      slider with no JS, so it is dropped → both hero slides render stacked + visible.
 *    - aos.css: `[data-aos] { opacity:0 }` would HIDE reveal-on-scroll content with no
 *      JS, so it is dropped → the (inert) data-aos attrs have no effect, content shows.
 *    - magnific-popup / jquery-ui / bootstrap-datepicker / mediaelement: JS widgets
 *      with no static role here.
 *  Google Fonts ("Poppins"/"Display Playfair") fall back (CSP-blocked CDN). The LOCAL
 *  icomoon + flaticon icon fonts ARE loaded (goal-36) so the service/social glyphs render. */
export const HAIRSAL_CSS_HREFS = [
  '/sajtbyggare/hairsal/css/bootstrap.min.css',
  // goal-36: load the LOCAL icon fonts (present on disk) so the Featured-Services glyphs
  // (flaticon-razor / location-pin / shave) + social icons render instead of blank boxes.
  '/sajtbyggare/hairsal/fonts/icomoon/style.css',
  '/sajtbyggare/hairsal/fonts/flaticon/font/flaticon.css',
  '/sajtbyggare/hairsal/css/style.css',
] as const
