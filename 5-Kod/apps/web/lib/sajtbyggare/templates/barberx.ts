// 'barberx' (Barber X) vendor template — imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/BarberX-master — "Barber X"
// (Barber Shop HTML Template) by HTML Codex (CC-BY 4.0, kräver-kredit: keep the
// footer "Designed By HTML Codex" attribution). A FAITHFUL, FULL copy of the vendor
// index.html — every content section (Top Bar, Navbar, Hero, About, Service,
// Pricing, Testimonial, Team, Contact, Blog, Footer) reproduced verbatim.
// Transformations applied at import time (the codemod's mechanical 80% + judgment):
//   1. asset paths img/… → /sajtbyggare/barberx/img/… (served from public/).
//   2. vendor JS stripped (jQuery/bootstrap.bundle/easing/owlcarousel/isotope/
//      lightbox/contact.js/main.js) — static-first. All <script> removed; JS-only
//      attrs removed (data-toggle, data-target, data-dismiss, data-src). The
//      back-to-top <a> and navbar-toggler button are removed. The JS-driven Video
//      Modal + its hero btn-play trigger (a YouTube lightbox) are removed (modal
//      requires JS; it also carried an empty-src <iframe>).
//   3. barberx has exactly ONE native <form> — the Contact <form id="contactForm">
//      (name/email/subject/message). The home page presents it HEADLESS, so the
//      template's OWN contact section-header (<p>Get In Touch</p><h2>If You Have Any
//      Query, Please Contact Us</h2>, lifted verbatim from contact.html — the same
//      form's heading) is FOLDED into the band, and the <form>…</form> is REPLACED by
//      the module marker <corevo-module type="booking" pos="contact"> (woven at
//      render). After the weave NO <form> remains (the footer "Newsletter" is an
//      input+button <div class="form">, no <form> tag). Exactly ONE booking marker.
//   4. nav links that pointed to other vendor pages (about.html, service.html …) →
//      in-page anchors (#about,#service,#price,#team,#blog,#contact); the matching
//      section wrappers carry those ids. The JS "Pages" dropdown is flattened to a
//      single Blog link (#blog, the home blog section); its Single Page entry (no
//      home section) is dropped; Gallery (no home section) + every href="" → "#".
//   5. The vendor's REAL Footer (incl. the htmlcodex credit) is reproduced
//      faithfully; a Corevo attribution strip is appended last.
//
// NOTE on sanitization: this string is author-controlled (we imported it), so it
// is trusted. TENANT-edited HTML MUST be sanitized at SAVE time.
export const BARBERX_PAGE_HTML = `
<!-- Top Bar Start -->
        <div class="top-bar d-none d-md-block">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-md-6">
                        <div class="top-bar-left">
                            <div class="text">
                                <h2>8:00 - 9:00</h2>
                                <p>Opening Hour Mon - Fri</p>
                            </div>
                            <div class="text">
                                <h2>+123 456 7890</h2>
                                <p>Call Us For Appointment</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="top-bar-right">
                            <div class="social">
                                <a href="#"><i class="fab fa-twitter"></i></a>
                                <a href="#"><i class="fab fa-facebook-f"></i></a>
                                <a href="#"><i class="fab fa-linkedin-in"></i></a>
                                <a href="#"><i class="fab fa-instagram"></i></a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Top Bar End -->

        <!-- Nav Bar Start -->
        <div class="navbar navbar-expand-lg bg-dark navbar-dark">
            <div class="container-fluid">
                <a href="#" class="navbar-brand">Barber <span>X</span></a>
                

                <div class="collapse navbar-collapse justify-content-between" id="navbarCollapse">
                    <div class="navbar-nav ml-auto">
                        <a href="#" class="nav-item nav-link active">Home</a>
                        <a href="#about" class="nav-item nav-link">About</a>
                        <a href="#service" class="nav-item nav-link">Service</a>
                        <a href="#price" class="nav-item nav-link">Price</a>
                        <a href="#team" class="nav-item nav-link">Barber</a>
                        <a href="#" class="nav-item nav-link">Gallery</a>
                        <a href="#blog" class="nav-item nav-link">Blog</a>
                        <a href="#contact" class="nav-item nav-link">Contact</a>
                    </div>
                </div>
            </div>
        </div>
        <!-- Nav Bar End -->


        <!-- Hero Start -->
        <div class="hero">
            <div class="container-fluid">
                <div class="row">
                    <div class="col-sm-12 col-md-6">
                        <div class="hero-text">
                            <h1>HTML5 Template for Salon Website</h1>
                            <p>
                                Lorem ipsum dolor sit amet elit. Phasell nec pretum mi. Curabi ornare velit non. Aliqua metus tortor auctor quis sem.
                            </p>
                            <a class="btn" href="#">Download Now</a>
                        </div>
                    </div>
                    <div class="col-sm-12 col-md-6 d-none d-md-block">
                        <div class="hero-image">
                            <img src="/sajtbyggare/barberx/img/hero.png" alt="Hero Image">
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Hero End -->


        <!-- About Start -->
        <div class="about" id="about">
            <div class="container">
                <div class="row align-items-center">
                    <div class="col-lg-5 col-md-6">
                        <div class="about-img">
                            <img src="/sajtbyggare/barberx/img/about.jpg" alt="Image">
                        </div>
                    </div>
                    <div class="col-lg-7 col-md-6">
                        <div class="section-header text-left">
                            <p>Learn About Us</p>
                            <h2>25 Years Experience</h2>
                        </div>
                        <div class="about-text">
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec pretium mi. Curabitur facilisis ornare velit non vulputate. Aliquam metus tortor, auctor id gravida condimentum, viverra quis sem.
                            </p>
                            <p>
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus nec pretium mi. Curabitur facilisis ornare velit non vulputate. Aliquam metus tortor, auctor id gravida condimentum, viverra quis sem. Curabitur non nisl nec nisi scelerisque maximus. Aenean consectetur convallis porttitor. Aliquam interdum at lacus non blandit.
                            </p>
                            <a class="btn" href="#">Learn More</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- About End -->


        <!-- Service Start -->
        <div class="service" id="service">
            <div class="container">
                <div class="section-header text-center">
                    <p>Our Salon Services</p>
                    <h2>Best Salon and Barber Services for You</h2>
                </div>
                <div class="row">
                    <div class="col-lg-4 col-md-6">
                        <div class="service-item">
                            <div class="service-img">
                                <img src="/sajtbyggare/barberx/img/service-1.jpg" alt="Image">
                            </div>
                            <h3>Hair Cut</h3>
                            <p>
                                Lorem ipsum dolor sit amet elit. Phasellus nec pretium mi. Curabitur facilisis ornare velit non
                            </p>
                            <a class="btn" href="#">Learn More</a>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <div class="service-item">
                            <div class="service-img">
                                <img src="/sajtbyggare/barberx/img/service-2.jpg" alt="Image">
                            </div>
                            <h3>Beard Style</h3>
                            <p>
                                Lorem ipsum dolor sit amet elit. Phasellus nec pretium mi. Curabitur facilisis ornare velit non
                            </p>
                            <a class="btn" href="#">Learn More</a>
                        </div>
                    </div>
                    <div class="col-lg-4 col-md-6">
                        <div class="service-item">
                            <div class="service-img">
                                <img src="/sajtbyggare/barberx/img/service-3.jpg" alt="Image">
                            </div>
                            <h3>Color & Wash</h3>
                            <p>
                                Lorem ipsum dolor sit amet elit. Phasellus nec pretium mi. Curabitur facilisis ornare velit non
                            </p>
                            <a class="btn" href="#">Learn More</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Service End -->


        <!-- Pricing Start -->
        <div class="price" id="price">
            <div class="container">
                <div class="section-header text-center">
                    <p>Our Best Pricing</p>
                    <h2>We Provide Best Price in the City</h2>
                </div>
                <div class="row">
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-1.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Hair Cut</h2>
                                <h3>$9.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-2.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Hair Wash</h2>
                                <h3>$10.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-3.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Hair Color</h2>
                                <h3>$11.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-4.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Hair Shave</h2>
                                <h3>$12.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-5.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Hair Straight</h2>
                                <h3>$13.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-6.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Facial</h2>
                                <h3>$14.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-7.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Shampoo</h2>
                                <h3>$15.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-8.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Beard Trim</h2>
                                <h3>$16.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-9.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Beard Shave</h2>
                                <h3>$17.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-10.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Wedding Cut</h2>
                                <h3>$18.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-11.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Clean Up</h2>
                                <h3>$19.99</h3>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-4 col-sm-6">
                        <div class="price-item">
                            <div class="price-img">
                                <img src="/sajtbyggare/barberx/img/price-12.jpg" alt="Image">
                            </div>
                            <div class="price-text">
                                <h2>Massage</h2>
                                <h3>$20.99</h3>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Pricing End -->
        
        
        <!-- Testimonial Start -->
        <div class="testimonial">
            <div class="container">
                <div class="owl-carousel testimonials-carousel">
                    <div class="testimonial-item">
                        <img src="/sajtbyggare/barberx/img/testimonial-1.jpg" alt="Image">
                        <p>
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus ut mollis mauris. Vivamus egestas eleifend dui ac consequat. Fusce venenatis at lectus in malesuada. Suspendisse sit amet dolor et odio varius mattis.
                        </p>
                        <h2>Client Name</h2>
                        <h3>Profession</h3>
                    </div>
                    <div class="testimonial-item">
                        <img src="/sajtbyggare/barberx/img/testimonial-2.jpg" alt="Image">
                        <p>
                            Phasellus pellentesque tempus pretium. Quisque in enim sit amet purus venenatis porttitor sed non velit. Vivamus vehicula finibus tortor. Aliquam vehicula molestie pulvinar. Sed varius libero in leo finibus, ac consectetur tortor rutrum.
                        </p>
                        <h2>Client Name</h2>
                        <h3>Profession</h3>
                    </div>
                    <div class="testimonial-item">
                        <img src="/sajtbyggare/barberx/img/testimonial-3.jpg" alt="Image">
                        <p>
                            Sed in lectus eu eros tincidunt cursus. Aliquam eleifend velit nisl. Sed et posuere urna, ut vestibulum massa. Integer quis magna non enim luctus interdum. Phasellus sed eleifend erat. Aliquam ligula ex, semper vel tempor pellentesque, pretium eu nulla.
                        </p>
                        <h2>Client Name</h2>
                        <h3>Profession</h3>
                    </div>
                </div>
            </div>
        </div>
        <!-- Testimonial End -->


        <!-- Team Start -->
        <div class="team" id="team">
            <div class="container">
                <div class="section-header text-center">
                    <p>Our Barber Team</p>
                    <h2>Meet Our Hair Cut Expert Barber</h2>
                </div>
                <div class="row">
                    <div class="col-lg-3 col-md-6">
                        <div class="team-item">
                            <div class="team-img">
                                <img src="/sajtbyggare/barberx/img/team-1.jpg" alt="Team Image">
                            </div>
                            <div class="team-text">
                                <h2>Adam Phillips</h2>
                                <p>Master Barber</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="team-item">
                            <div class="team-img">
                                <img src="/sajtbyggare/barberx/img/team-2.jpg" alt="Team Image">
                            </div>
                            <div class="team-text">
                                <h2>Dylan Adams</h2>
                                <p>Hair Expert</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="team-item">
                            <div class="team-img">
                                <img src="/sajtbyggare/barberx/img/team-3.jpg" alt="Team Image">
                            </div>
                            <div class="team-text">
                                <h2>Gloria Edwards</h2>
                                <p>Beard Expert</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-3 col-md-6">
                        <div class="team-item">
                            <div class="team-img">
                                <img src="/sajtbyggare/barberx/img/team-4.jpg" alt="Team Image">
                            </div>
                            <div class="team-text">
                                <h2>Josh Dunn</h2>
                                <p>Color Expert</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Team End -->
        
        
                <!-- Contact Start -->
        <div class="contact" id="contact">
            <div class="container-fluid">
                <div class="container">
                    <div class="section-header text-center">
                        <p>Get In Touch</p>
                        <h2>If You Have Any Query, Please Contact Us</h2>
                    </div>
                    <div class="row align-items-center">
                        <div class="col-md-4"></div>
                        <div class="col-md-8">
                            <div class="contact-form">
                                <corevo-module type="booking" pos="contact"></corevo-module>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Contact End -->


        <!-- Blog Start -->
        <div class="blog" id="blog">
            <div class="container">
                <div class="section-header text-center">
                    <p>Latest From Blog</p>
                    <h2>Learn More from Latest Barber Blog</h2>
                </div>
                <div class="owl-carousel blog-carousel">
                    <div class="blog-item">
                        <div class="blog-img">
                            <img src="/sajtbyggare/barberx/img/blog-1.jpg" alt="Blog">
                        </div>
                        <div class="blog-meta">
                            <i class="fa fa-list-alt"></i>
                            <a href="#">Hair Cut</a>
                            <i class="fa fa-calendar-alt"></i>
                            <p>01-Jan-2045</p>
                        </div>
                        <div class="blog-text">
                            <h2>Lorem ipsum dolor</h2>
                            <p>
                                Lorem ipsum dolor sit amet elit. Neca pretim miura bitur facili ornare velit non vulpte liqum metus tortor
                            </p>
                            <a class="btn" href="#">Read More <i class="fa fa-angle-right"></i></a>
                        </div>
                    </div>
                    <div class="blog-item">
                        <div class="blog-img">
                            <img src="/sajtbyggare/barberx/img/blog-2.jpg" alt="Blog">
                        </div>
                        <div class="blog-meta">
                            <i class="fa fa-list-alt"></i>
                            <a href="#">Beard Style</a>
                            <i class="fa fa-calendar-alt"></i>
                            <p>01-Jan-2045</p>
                        </div>
                        <div class="blog-text">
                            <h2>Lorem ipsum dolor</h2>
                            <p>
                                Lorem ipsum dolor sit amet elit. Neca pretim miura bitur facili ornare velit non vulpte liqum metus tortor
                            </p>
                            <a class="btn" href="#">Read More <i class="fa fa-angle-right"></i></a>
                        </div>
                    </div>
                    <div class="blog-item">
                        <div class="blog-img">
                            <img src="/sajtbyggare/barberx/img/blog-3.jpg" alt="Blog">
                        </div>
                        <div class="blog-meta">
                            <i class="fa fa-list-alt"></i>
                            <a href="#">Color & Wash</a>
                            <i class="fa fa-calendar-alt"></i>
                            <p>01-Jan-2045</p>
                        </div>
                        <div class="blog-text">
                            <h2>Lorem ipsum dolor</h2>
                            <p>
                                Lorem ipsum dolor sit amet elit. Neca pretim miura bitur facili ornare velit non vulpte liqum metus tortor
                            </p>
                            <a class="btn" href="#">Read More <i class="fa fa-angle-right"></i></a>
                        </div>
                    </div>
                    <div class="blog-item">
                        <div class="blog-img">
                            <img src="/sajtbyggare/barberx/img/blog-4.jpg" alt="Blog">
                        </div>
                        <div class="blog-meta">
                            <i class="fa fa-list-alt"></i>
                            <a href="#">Hair Cut</a>
                            <i class="fa fa-calendar-alt"></i>
                            <p>01-Jan-2045</p>
                        </div>
                        <div class="blog-text">
                            <h2>Lorem ipsum dolor</h2>
                            <p>
                                Lorem ipsum dolor sit amet elit. Neca pretim miura bitur facili ornare velit non vulpte liqum metus tortor
                            </p>
                            <a class="btn" href="#">Read More <i class="fa fa-angle-right"></i></a>
                        </div>
                    </div>
                    <div class="blog-item">
                        <div class="blog-img">
                            <img src="/sajtbyggare/barberx/img/blog-5.jpg" alt="Blog">
                        </div>
                        <div class="blog-meta">
                            <i class="fa fa-list-alt"></i>
                            <a href="#">Beard Style</a>
                            <i class="fa fa-calendar-alt"></i>
                            <p>01-Jan-2045</p>
                        </div>
                        <div class="blog-text">
                            <h2>Lorem ipsum dolor</h2>
                            <p>
                                Lorem ipsum dolor sit amet elit. Neca pretim miura bitur facili ornare velit non vulpte liqum metus tortor
                            </p>
                            <a class="btn" href="#">Read More <i class="fa fa-angle-right"></i></a>
                        </div>
                    </div>
                    <div class="blog-item">
                        <div class="blog-img">
                            <img src="/sajtbyggare/barberx/img/blog-6.jpg" alt="Blog">
                        </div>
                        <div class="blog-meta">
                            <i class="fa fa-list-alt"></i>
                            <a href="#">Color & Wash</a>
                            <i class="fa fa-calendar-alt"></i>
                            <p>01-Jan-2045</p>
                        </div>
                        <div class="blog-text">
                            <h2>Lorem ipsum dolor</h2>
                            <p>
                                Lorem ipsum dolor sit amet elit. Neca pretim miura bitur facili ornare velit non vulpte liqum metus tortor
                            </p>
                            <a class="btn" href="#">Read More <i class="fa fa-angle-right"></i></a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        <!-- Blog End -->


        <!-- Footer Start -->
        <div class="footer">
            <div class="container">
                <div class="row">
                    <div class="col-lg-7">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="footer-contact">
                                    <h2>Salon Address</h2>
                                    <p><i class="fa fa-map-marker-alt"></i>123 Street, New York, USA</p>
                                    <p><i class="fa fa-phone-alt"></i>+012 345 67890</p>
                                    <p><i class="fa fa-envelope"></i>info@example.com</p>
                                    <div class="footer-social">
                                        <a href="#"><i class="fab fa-twitter"></i></a>
                                        <a href="#"><i class="fab fa-facebook-f"></i></a>
                                        <a href="#"><i class="fab fa-youtube"></i></a>
                                        <a href="#"><i class="fab fa-instagram"></i></a>
                                        <a href="#"><i class="fab fa-linkedin-in"></i></a>
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="footer-link">
                                    <h2>Quick Links</h2>
                                    <a href="#">Terms of use</a>
                                    <a href="#">Privacy policy</a>
                                    <a href="#">Cookies</a>
                                    <a href="#">Help</a>
                                    <a href="#">FQAs</a>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="col-lg-5">
                        <div class="footer-newsletter">
                            <h2>Newsletter</h2>
                            <p>
                                Lorem ipsum dolor sit amet elit. Quisque eu lectus a leo dictum nec non quam. Tortor eu placerat rhoncus, lorem quam iaculis felis, sed lacus neque id eros.
                            </p>
                            <div class="form">
                                <input class="form-control" placeholder="Email goes here">
                                <button class="btn">Submit</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="container copyright">
                <div class="row">
                    <div class="col-md-6">
                        <p>&copy; <a href="#">Your Site Name</a>, All Right Reserved.</p>
                    </div>
                    <div class="col-md-6">
                        <p>Designed By <a href="https://htmlcodex.com">HTML Codex</a></p>
                    </div>
                </div>
            </div>
        </div>
        <!-- Footer End -->

        <div class="container-fluid bg-dark text-light py-4 mt-5">
            <div class="container text-center">
                <small class="text-light">Mall: <a class="text-primary" href="https://htmlcodex.com" rel="nofollow">Barber X by HTML Codex</a> (kräver-kredit) — Corevo sajtbyggare.</small>
            </div>
        </div>
`.trim()

// The template's OWN stylesheet (served from public/). The vendor loads Bootstrap
// 4.4.1, Font Awesome 5.10 and the Open Sans webfont from CDNs and animate.css/
// owl.carousel/lightbox from lib/ — all intentionally NOT loaded here (CDN deps are
// blocked by the app CSP; the JS-widget CSS would hide the un-initialised owl
// carousels). So fonts fall back, the <i class="fa"> icons are blank, the Bootstrap
// grid degrades to a stacked column flow, and the owl testimonial/blog carousels
// render stacked.
export const BARBERX_CSS_HREFS = [
  '/sajtbyggare/barberx/css/style.css',
] as const
