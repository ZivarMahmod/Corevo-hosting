// 'barberz' vendor template, imported AS DATA (goal-36). Source: Barberz — a
// barbershop website template by Colorlib (kräver-kredit, CC BY 3.0: the footer
// "made with ♥ by Colorlib" backlink MUST stay). A FAITHFUL, FULL copy of the
// vendor index.html (home) — header/nav, hero cover, "Welcome To Barberz" about,
// "Services & Pricing" cards, "More Hair Styles", "More Services", testimonials,
// "Our Blog", the "Quality Haircut" CTA band, and the footer.
//
// Transforms applied at import time (the "onboarding job" — verbatim vendor markup
// PLUS these edits ONLY):
//   1. asset paths images/css/fonts/... → /sajtbyggare/barberz/... (served from public/).
//   2. vendor JS stripped (jQuery/bootstrap/owl/stellar/aos/datepicker/fancybox/…) —
//      static-first. All <script> removed; the footer copyright <script> that wrote
//      the year is dropped (leaving the plain "Copyright ©" text). JS-only attrs
//      (data-spy/data-target/data-offset) removed. No spinner/back-to-top/toggler.
//   3. The home page has NO native appointment form (only a footer Newsletter), so
//      the template's OWN contact/appointment <form> SECTION from contact.html
//      (heading "Contact Us Or Use This Form To Rent A Car" — a vendor leftover,
//      kept verbatim) is FOLDED in as the booking band before the footer, with its
//      <form>…</form> REPLACED by exactly ONE <corevo-module type="booking" pos="booking">.
//      The surrounding heading + Contact-Info column are kept verbatim.
//   4. The footer Newsletter <form> is rendered as a static <div> (no backend; also
//      fixes the vendor's duplicate `class` attr) — so AFTER the weave NO <form>
//      remains and there is exactly ONE booking marker.
//   5. nav cross-page links (services.html/about.html/blog.html/contact.html) →
//      in-page anchors (#home-section/#services/#about/#blog/#booking); matching
//      section ids added so they resolve. "Barber Shop" (no home section) → "#".
//   6. The Colorlib credit + CC-BY comment in the footer are reproduced faithfully;
//      a Corevo attribution strip (also crediting Colorlib) is appended last.
//
// Author-controlled (we imported it) → trusted. TENANT edits are sanitised at SAVE.
export const BARBERZ_PAGE_HTML = `
<div class="site-wrap" id="home-section">

      <div class="site-mobile-menu site-navbar-target">
        <div class="site-mobile-menu-header">
          <div class="site-mobile-menu-close mt-3">
            <span class="icon-close2 js-menu-toggle"></span>
          </div>
        </div>
        <div class="site-mobile-menu-body"></div>
      </div>



      <header class="site-navbar site-navbar-target" role="banner">

        <div class="container">
          <div class="row align-items-center position-relative">

            <div class="col-3">
              <div class="site-logo">
                <a href="#home-section">Barberz</a>
              </div>
            </div>

            <div class="col-9 text-right">
              

              <span class="d-inline-block d-lg-none"><a href="#" class="text-white site-menu-toggle js-menu-toggle py-5 text-white"><span class="icon-menu h3 text-white"></span></a></span>

              

              <nav class="site-navigation text-right ml-auto d-none d-lg-block" role="navigation">
                <ul class="site-menu main-menu js-clone-nav ml-auto">
                  <li class="active"><a href="#home-section" class="nav-link">Home</a></li>
                  <li><a href="#services" class="nav-link">Services</a></li>
                  <li><a href="#" class="nav-link">Barber Shop</a></li>
                  <li><a href="#about" class="nav-link">About</a></li>
                  <li><a href="#blog" class="nav-link">Blog</a></li>
                  <li><a href="#booking" class="nav-link">Contact</a></li>
                </ul>
              </nav>
            </div>

            
          </div>
        </div>

      </header>

    <div class="ftco-blocks-cover-1">
      <div class="site-section-cover overlay" data-stellar-background-ratio="0.5" style="background-image: url('/sajtbyggare/barberz/images/hero_1.jpg')">
        <div class="container">
          <div class="row align-items-center justify-content-center text-center">
            <div class="col-md-7">
              <h1 class="mb-3">More Than Just A Haircut</h1>
              <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Soluta veritatis in tenetur doloremque, maiores doloribus officia iste. Dolores.</p>
              <p><a href="#" class="btn btn-primary">Learn More</a></p>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <div class="site-section" id="about">
      <div class="container">
        <div class="row">
          <div class="col-lg-6 mb-5 mb-lg-0">
            <div class="img-years">
              <img src="/sajtbyggare/barberz/images/img_1.jpg" alt="Image" class="img-fluid">
              <div class="year">
                <span>3 <span>years in <br>excellent service</span></span>
              </div>
            </div>

          </div>
          <div class="col-lg-5 ml-auto pl-lg-5 text-center">
            <h3 class="scissors text-center">Welcome To Barberz!</h3>
            <p class="mb-5 lead">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Iure nesciunt nemo vel earum maxime neque!</p>
            <p><a href="#" class="btn btn-primary">Learn More</a></p>
          </div>
        </div>
      </div>
    </div>

    

    <div class="site-section bg-light" id="services">
      <div class="container">
        <div class="row justify-content-center mb-5">
          <div class="col-md-7 text-center">
            <h3 class="scissors text-center">Services &amp; Pricing</h3>
            <p class="mb-5 lead">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Iure nesciunt nemo vel earum maxime neque!</p>

            <p class="text-center">
              <a href="#" class="btn btn-primary custom-prev">Prev</a>
              <a href="#" class="btn btn-primary custom-next">Next</a>
            </p>
          </div>

        </div>
        <div class="row">
          <div class="col-12">

            <div class="nonloop-block-13 owl-carousel d-flex">
              
              <div class="item-1 h">
                <img src="/sajtbyggare/barberz/images/img_1.jpg" alt="Image" class="img-fluid">
                <div class="item-1-contents">
                  <h3>Haircut</h3>
                  <ul>
                    <li class="d-flex"><span>Men's Cut</span> <span class="price ml-auto">$29.00</span></li>
                    <li class="d-flex"><span>Men's Cut with Shampoo and Blow Dry</span><span class="price ml-auto">$10.00</span></li>
                    <li class="d-flex"><span>Ladie's Cut with Shampoo and Blow Dry</span><span class="price ml-auto">$32.00</span></li>
                    <li class="d-flex"><span>Head Shave</span><span class="price ml-auto">$23.00</span></li>
                    <li class="d-flex"><span>Hair Art</span><span class="price ml-auto">$54.00</span></li>
                  </ul>
                </div>
                
              </div>

              <div class="item-1 h">
                <img src="/sajtbyggare/barberz/images/img_2.jpg" alt="Image" class="img-fluid">
                <div class="item-1-contents">
                  <h3>Hair Styling</h3>
                  <ul>
                    <li class="d-flex"><span>Shampoo</span> <span class="price ml-auto">$29.00</span></li>
                    <li class="d-flex"><span>Blow Dry</span><span class="price ml-auto">$10.00</span></li>
                    <li class="d-flex"><span>Iron</span><span class="price ml-auto">$32.00</span></li>
                    <li class="d-flex"><span>Brazilian Blow Out</span><span class="price ml-auto">$23.00</span></li>
                    <li class="d-flex"><span>Hair Art</span><span class="price ml-auto">$54.00</span></li>
                  </ul>
                </div>
                
              </div>

              <div class="item-1 h">
                <img src="/sajtbyggare/barberz/images/img_3.jpg" alt="Image" class="img-fluid">
                <div class="item-1-contents">
                  <h3>Hair Scalp Care</h3>
                  <ul>
                    <li class="d-flex"><span>Shampoo</span> <span class="price ml-auto">$29.00</span></li>
                    <li class="d-flex"><span>Blow Dry</span><span class="price ml-auto">$10.00</span></li>
                    <li class="d-flex"><span>Iron</span><span class="price ml-auto">$32.00</span></li>
                    <li class="d-flex"><span>Brazilian Blow Out</span><span class="price ml-auto">$23.00</span></li>
                    <li class="d-flex"><span>Hair Art</span><span class="price ml-auto">$54.00</span></li>
                  </ul>
                </div>
                
              </div>

            </div>
            
          </div>
        </div>
      </div>
    </div>


    <div class="site-section">
      <div class="container">
        <div class="row justify-content-center mb-5">
          <div class="col-md-7 text-center">
            <h3 class="scissors text-center">More Hair Styles</h3>
            <p class="mb-5 lead">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Iure nesciunt nemo vel earum maxime neque!</p>
          </div>
        </div>
        <div class="row hair-style">
          <div class="col-lg-4 col-md-4 col-sm-6 col-12">
            <a href="#" class="place">
              <img src="/sajtbyggare/barberz/images/img_1.jpg" alt="Image placeholder">
              <h2>Beard Shaving</h2>
              <span>$50.00 only</span>
            </a>
          </div>
          <div class="col-lg-4 col-md-4 col-sm-6 col-12">
            <a href="#" class="place">
              <img src="/sajtbyggare/barberz/images/img_2.jpg" alt="Image placeholder">
              <h2>Crew Cut</h2>
              <span>$50.00 only</span>
            </a>
          </div>
          <div class="col-lg-4 col-md-4 col-sm-6 col-12">
            <a href="#" class="place">
              <img src="/sajtbyggare/barberz/images/img_3.jpg" alt="Image placeholder">
              <h2>Beard Trim</h2>
              <span>$50.00 only</span>
            </a>
          </div>
          
        </div>
      </div>
    </div>
    <!-- END section -->

    <div class="site-section section-3" data-stellar-background-ratio="0.5" style="background-image: url('/sajtbyggare/barberz/images/hero_2.jpg');">
      <div class="container">
        <div class="row justify-content-center text-center">
          <div class="col-7 text-center mb-5">
            <h2 class="text-white scissors primary-color-icon text-center">More Services</h2>
            <p class="lead text-white">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Laboriosam quo doloribus, suscipit libero, voluptate aliquam.</p>
          </div>
        </div>
        <div class="row">
          <div class="col-lg-4 col-md-6 mb-4">
            <div class="service-1">
              <span class="service-1-icon">
                <span class="flaticon-bald"></span>
              </span>
              <div class="service-1-contents">
                <h3>Hair Cut</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Obcaecati, laboriosam.</p>
              </div>
            </div>
          </div>
          <div class="col-lg-4 col-md-6 mb-4">
            <div class="service-1">
              <span class="service-1-icon">
                <span class="flaticon-beard"></span>
              </span>
              <div class="service-1-contents">
                <h3>Facial &amp; Body Care</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Obcaecati, laboriosam.</p>
              </div>
            </div>
          </div>
          <div class="col-lg-4 col-md-6 mb-4">
            <div class="service-1">
              <span class="service-1-icon">
                <span class="flaticon-scissors"></span>
              </span>
              <div class="service-1-contents">
                <h3>Massages</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Obcaecati, laboriosam.</p>
              </div>
            </div>
          </div>

          <div class="col-lg-4 col-md-6 mb-4">
            <div class="service-1">
              <span class="service-1-icon">
                <span class="flaticon-hair-spray"></span>
              </span>
              <div class="service-1-contents">
                <h3>Hair Cut</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Obcaecati, laboriosam.</p>
              </div>
            </div>
          </div>
          <div class="col-lg-4 col-md-6 mb-4">
            <div class="service-1">
              <span class="service-1-icon">
                <span class="flaticon-hair"></span>
              </span>
              <div class="service-1-contents">
                <h3>Facial &amp; Body Care</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Obcaecati, laboriosam.</p>
              </div>
            </div>
          </div>
          <div class="col-lg-4 col-md-6 mb-4">
            <div class="service-1">
              <span class="service-1-icon">
                <span class="flaticon-barber-shop"></span>
              </span>
              <div class="service-1-contents">
                <h3>Massages</h3>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Obcaecati, laboriosam.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>


    
    
    <div class="site-section bg-light">
      <div class="container">
        <div class="row justify-content-center text-center mb-5">
          <div class="col-7 text-center mb-5">
            <h2 class="scissors text-center">Our Top Client Says</h2>
            <p class="lead">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nemo assumenda, dolorum necessitatibus eius earum voluptates sed!</p>
          </div>
        </div>
        <div class="row">
          <div class="col-lg-4 mb-4 mb-lg-0">
            <div class="testimonial-2">
              <div class="d-flex v-card align-items-center mb-4">
                <img src="/sajtbyggare/barberz/images/person_1.jpg" alt="Image" class="img-fluid mr-3">
                <span>Mike Fisher</span>
              </div>
              <blockquote>
                <p>"Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptatem, deserunt eveniet veniam. Ipsam, nam, voluptatum"</p>
              </blockquote>
              
            </div>
          </div>
          <div class="col-lg-4 mb-4 mb-lg-0">
            <div class="testimonial-2">
              <div class="d-flex v-card align-items-center mb-4">
                <img src="/sajtbyggare/barberz/images/person_2.jpg" alt="Image" class="img-fluid mr-3">
                <span>Jean Stanley</span>
              </div>
              <blockquote>
                <p>"Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptatem, deserunt eveniet veniam. Ipsam, nam, voluptatum"</p>
              </blockquote>
              
            </div>
          </div>
          <div class="col-lg-4 mb-4 mb-lg-0">
            <div class="testimonial-2">
              <div class="d-flex v-card align-items-center mb-4">
                <img src="/sajtbyggare/barberz/images/person_3.jpg" alt="Image" class="img-fluid mr-3">
                <span>Katie Rose</span>
              </div>
              <blockquote>
                <p>"Lorem ipsum dolor sit amet, consectetur adipisicing elit. Voluptatem, deserunt eveniet veniam. Ipsam, nam, voluptatum"</p>
              </blockquote>
              
            </div>
          </div>
        </div>
      </div>
    </div>


    <div class="site-section bg-white" id="blog">
      <div class="container">
        <div class="row justify-content-center text-center mb-5">
          <div class="col-7 text-center mb-5">
            <h2 class="scissors text-center">Our Blog</h2>
            <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nemo assumenda, dolorum necessitatibus eius earum voluptates sed!</p>
          </div>
        </div>

        <div class="row">
          <div class="col-lg-4 col-md-6 mb-4">
            <div class="post-entry-1 h-100">
              <a href="single.html">
                <img src="/sajtbyggare/barberz/images/img_1.jpg" alt="Image"
                 class="img-fluid">
              </a>
              <div class="post-entry-1-contents">
                
                <h2><a href="single.html">Lorem ipsum dolor sit amet</a></h2>
                <span class="meta d-inline-block mb-3">July 17, 2019 <span class="mx-2">by</span> <a href="#">Admin</a></span>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Dolores eos soluta, dolore harum molestias consectetur.</p>
              </div>
            </div>
          </div>
          <div class="col-lg-4 col-md-6 mb-4">
            <div class="post-entry-1 h-100">
              <a href="single.html">
                <img src="/sajtbyggare/barberz/images/img_2.jpg" alt="Image"
                 class="img-fluid">
              </a>
              <div class="post-entry-1-contents">
                
                <h2><a href="single.html">Lorem ipsum dolor sit amet</a></h2>
                <span class="meta d-inline-block mb-3">July 17, 2019 <span class="mx-2">by</span> <a href="#">Admin</a></span>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Dolores eos soluta, dolore harum molestias consectetur.</p>
              </div>
            </div>
          </div>

          <div class="col-lg-4 col-md-6 mb-4">
            <div class="post-entry-1 h-100">
              <a href="single.html">
                <img src="/sajtbyggare/barberz/images/img_3.jpg" alt="Image"
                 class="img-fluid">
              </a>
              <div class="post-entry-1-contents">
                
                <h2><a href="single.html">Lorem ipsum dolor sit amet</a></h2>
                <span class="meta d-inline-block mb-3">July 17, 2019 <span class="mx-2">by</span> <a href="#">Admin</a></span>
                <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Dolores eos soluta, dolore harum molestias consectetur.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>


    <div class="site-section section-3" data-stellar-background-ratio="0.5" style="background-image: url('/sajtbyggare/barberz/images/hero_1.jpg');">
      <div class="container">
        <div class="row justify-content-center text-center">
          <div class="col-7 text-center mb-5">
            <h2 class="text-white scissors primary-color-icon text-center">Quality Haircut</h2>
            <p class="lead text-white mb-5">Lorem ipsum dolor sit amet, consectetur adipisicing elit. Laboriosam quo doloribus, suscipit libero, voluptate aliquam.</p>
            <p><a href="#" class="btn btn-primary">Contact Us Now</a></p>
          </div>
        </div>
      </div>
    </div>

    <!-- Booking Start (folded from the template's OWN appointment/contact form in contact.html;
         the native form element is REPLACED by exactly one booking module marker — woven at render) -->
    <div class="site-section bg-light" id="booking">
      <div class="container">
        <div class="row justify-content-center text-center">
        <div class="col-7 text-center mb-5">
          <h2>Contact Us Or Use This Form To Rent A Car</h2>
          <p>Lorem ipsum dolor sit amet, consectetur adipisicing elit. Nemo assumenda, dolorum necessitatibus eius earum voluptates sed!</p>
        </div>
      </div>
        <div class="row">
          <div class="col-lg-8 mb-5">
            <corevo-module type="booking" pos="booking"></corevo-module>
          </div>
          <div class="col-lg-4 ml-auto">
            <div class="bg-white p-3 p-md-5">
              <h3 class="text-black mb-4">Contact Info</h3>
              <ul class="list-unstyled footer-link">
                <li class="d-block mb-3">
                  <span class="d-block text-black">Address:</span>
                  <span>34 Street Name, City Name Here, United States</span></li>
                <li class="d-block mb-3"><span class="d-block text-black">Phone:</span><span>+1 242 4942 290</span></li>
                <li class="d-block mb-3"><span class="d-block text-black">Email:</span><span>info@yourdomain.com</span></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Booking End -->



    <footer class="site-footer">
      <div class="container">
        <div class="row">
          <div class="col-lg-3">
            <img src="/sajtbyggare/barberz/images/img_1.jpg" alt="Image" class="img-fluid mb-5">
            <h2 class="footer-heading mb-3">About Us</h2>
                <p>Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts. </p>
          </div>
          <div class="col-lg-8 ml-auto">
            <div class="row">
              <div class="col-lg-6 ml-auto">
                <h2 class="footer-heading mb-4">Quick Links</h2>
                <ul class="list-unstyled">
                  <li><a href="#">About Us</a></li>
                  <li><a href="#">Testimonials</a></li>
                  <li><a href="#">Terms of Service</a></li>
                  <li><a href="#">Privacy</a></li>
                  <li><a href="#">Contact Us</a></li>
                </ul>
              </div>
              <div class="col-lg-6">
                <h2 class="footer-heading mb-4">Newsletter</h2>
                <div class="d-flex subscribe">
                  <input type="text" class="form-control mr-3" placeholder="Email">
                  <input type="submit" value="Send" class="btn btn-primary">
                </div>
              </div>
              
            </div>
          </div>
        </div>
        <div class="row pt-5 mt-5 text-center">
          <div class="col-md-12">
            <div class="border-top pt-5">
              <p>
            <!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. -->
            Copyright &copy; All rights reserved | This template is made with <i class="icon-heart text-danger" aria-hidden="true"></i> by <a href="https://colorlib.com" target="_blank" >Colorlib</a>
            <!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. -->
            </p>
            </div>
          </div>

        </div>
      </div>
    </footer>

    </div>

    <div class="container-fluid bg-black text-white py-4">
      <div class="container text-center">
        <small class="text-white">Mall: <a class="text-primary" href="https://colorlib.com" rel="nofollow">Barberz by Colorlib</a> (kräver-kredit, CC BY 3.0) — Corevo sajtbyggare.</small>
      </div>
    </div>


    
    
    
    
    
    
    
    
    
    
    
    

    
`.trim()

export const BARBERZ_CSS_HREFS = [
  'https://fonts.googleapis.com/css?family=DM+Sans:300,400,700&display=swap',
  '/sajtbyggare/barberz/fonts/icomoon/style.css',
  '/sajtbyggare/barberz/css/bootstrap.min.css',
  '/sajtbyggare/barberz/css/bootstrap-datepicker.css',
  '/sajtbyggare/barberz/css/jquery.fancybox.min.css',
  '/sajtbyggare/barberz/css/owl.carousel.min.css',
  '/sajtbyggare/barberz/css/owl.theme.default.min.css',
  '/sajtbyggare/barberz/fonts/flaticon/font/flaticon.css',
  '/sajtbyggare/barberz/css/aos.css',
  '/sajtbyggare/barberz/css/style.css',
] as const
