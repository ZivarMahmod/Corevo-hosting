// 'haircare' vendor template, imported AS DATA (not a React file).
//
// Source: 4-Dokument-Underlag/03-template-katalog/haircare-master — "Haircare"
// (Free Bootstrap 4 salon template) by Colorlib (CC BY 3.0 → kräver-kredit: the
// footer "made by Colorlib" link MUST stay). A FAITHFUL, FULL copy of the vendor
// index.html — all content sections (Navbar, Hero, Intro/About, Services, Booking,
// Team, Gallery, Pricing, Testimony, Footer). Transforms applied at import time —
// verbatim vendor markup PLUS these edits ONLY:
//   1. asset paths images/css/... → /sajtbyggare/haircare/... (served from public/).
//   2. vendor JS stripped (jQuery/bootstrap/owl/aos/stellar/datepicker/timepicker/
//      magnific/google-map). All <script> removed; JS-only attrs removed (data-toggle/
//      data-target via the navbar-toggler button, which is itself removed).
//   3. Colorlib's reveal-on-scroll class `ftco-animate` is stripped — its CSS sets
//      `opacity:0; visibility:hidden` and the AOS/waypoints JS that reveals it is
//      gone, so keeping it would hide every section statically (the colorlib analogue
//      of carserv stripping `wow`/`animated`). The `#ftco-loader` spinner block is
//      removed (JS chrome; it also carried #eeeeee/#F96D00 literals absent from the
//      vendor CSS).
//   4. haircare has exactly ONE <form> — the "Make an Appointment" appointment-form
//      in the ftco-booking section. It is REPLACED by the module marker
//      <corevo-module type="booking" pos="booking"> — woven at render. The section
//      gets id="booking" (so pos + the anchor resolve); its heading + "Call Us" line
//      are kept verbatim. After the weave NO <form> remains. Exactly ONE booking marker.
//   5. In-template page links (index/services/gallery/about/blog/contact/project.html)
//      → href="#" (no other vendor page is imported). The footer Colorlib credit +
//      the "licensed under CC BY 3.0" comment are reproduced faithfully (attribution).
//
// NOTE on sanitization: this string is author-controlled (we imported it), so it
// is trusted. TENANT-edited HTML MUST be sanitized at SAVE time.
export const HAIRCARE_PAGE_HTML = `
<nav class="navbar navbar-expand-lg navbar-dark ftco_navbar bg-dark ftco-navbar-light" id="ftco-navbar">
	    <div class="container">
	      <a class="navbar-brand" href="#"><span class="flaticon-scissors-in-a-hair-salon-badge"></span>Haircare</a>
	      

	      <div class="collapse navbar-collapse" id="ftco-nav">
	        <ul class="navbar-nav ml-auto">
	        	<li class="nav-item active"><a href="#" class="nav-link">Home</a></li>
	        	<li class="nav-item"><a href="#" class="nav-link">Services</a></li>
	        	<li class="nav-item"><a href="#" class="nav-link">Gallery</a></li>
	        	<li class="nav-item"><a href="#" class="nav-link">About</a></li>
	        	<li class="nav-item"><a href="#" class="nav-link">Blog</a></li>
	          <li class="nav-item"><a href="#" class="nav-link">Contact</a></li>
	        </ul>
	      </div>
	    </div>
	  </nav>
    <!-- END nav -->

    <section class="hero-wrap js-fullheight" style="min-height: 100vh; background-image: url(/sajtbyggare/haircare/images/bg-2.jpg);" data-stellar-background-ratio="0.5">
      <div class="overlay"></div>
      <div class="container">
        <div class="row no-gutters slider-text js-fullheight justify-content-center align-items-center">
          <div class="col-lg-12 d-flex align-items-center">
          	<div class="text text-center">
          		<span class="subheading">Welcome to Haircare</span>
		  				<h1 class="mb-4">We are professional care for your hair</h1>
		  				<p><a href="#" class="btn btn-primary btn-outline-primary px-4 py-2">Book now</a></p>
							</div>
            </div>
          </div>
        </div>
      </div>
    </section>
		
		<section class="ftco-section ftco-no-pt ftco-no-pb">
			<div class="container-fluid px-0">
				<div class="row no-gutters">
					<div class="col-md text-center d-flex align-items-stretch">
						<div class="services-wrap d-flex align-items-center img" style="background-image: url(/sajtbyggare/haircare/images/formen.jpg);">
							<div class="text">
								<h3>For Men</h3>
								<p><a href="#" class="btn-custom">See pricing <span class="ion-ios-arrow-round-forward"></span></a></p>
							</div>
						</div>
					</div>
					<div class="col-md-3 text-center d-flex align-items-stretch">
						<div class="text-about py-5 px-4">
							<h1 class="logo">
								<a href="#"><span class="flaticon-scissors-in-a-hair-salon-badge"></span>Haircare</a>
							</h1>
							<h2>Welcome to our Salon</h2>
							<p>A small river named Duden flows by their place and supplies it with the necessary regelialia. It is a paradisematic country, in which roasted parts of sentences fly into your mouth. Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.</p>
							<p class="mt-3"><a href="#" class="btn btn-primary btn-outline-primary">Read more</a></p>
						</div>
					</div>
					<div class="col-md text-center d-flex align-items-stretch">
						<div class="services-wrap d-flex align-items-center img" style="background-image: url(/sajtbyggare/haircare/images/forwomen.jpg);">
							<div class="text">
								<h3>For Women</h3>
								<p><a href="#" class="btn-custom">See pricing <span class="ion-ios-arrow-round-forward"></span></a></p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
    
    <section class="services-section ftco-section">
      <div class="container">
      	<div class="row justify-content-center pb-3">
          <div class="col-md-10 heading-section text-center">
          	<span class="subheading">Services</span>
            <h2 class="mb-4">Services Menu</h2>
            <p>Far far away, behind the word mountains, far from the countries Vokalia and Consonantia</p>
          </div>
        </div>
        <div class="row no-gutters d-flex">
          <div class="col-md-6 col-lg-3 d-flex align-self-stretch">
            <div class="media block-6 services d-block text-center">
              <div class="icon"><span class="flaticon-male-hair-of-head-and-face-shapes"></span></div>
              <div class="media-body">
                <h3 class="heading mb-3">Haircut &amp; Styling</h3>
                <p>A small river named Duden flows by their place and supplies.</p>
              </div>
            </div>    
          </div>
          <div class="col-md-6 col-lg-3 d-flex align-self-stretch">
            <div class="media block-6 services d-block text-center">
              <div class="icon"><span class="flaticon-beard"></span></div>
              <div class="media-body">
                <h3 class="heading mb-3">Beard</h3>
                <p>A small river named Duden flows by their place and supplies.</p>
              </div>
            </div>      
          </div>
          <div class="col-md-6 col-lg-3 d-flex align-self-stretch">
            <div class="media block-6 services d-block text-center">
              <div class="icon"><span class="flaticon-beauty-products"></span></div>
              <div class="media-body">
                <h3 class="heading mb-3">Makeup</h3>
                <p>A small river named Duden flows by their place and supplies.</p>
              </div>
            </div>      
          </div>
          <div class="col-md-6 col-lg-3 d-flex align-self-stretch">
            <div class="media block-6 services d-block text-center">
              <div class="icon"><span class="flaticon-healthy-lifestyle-logo"></span></div>
              <div class="media-body">
                <h3 class="heading mb-3">Body Treatment</h3>
                <p>A small river named Duden flows by their place and supplies.</p>
              </div>
            </div>      
          </div>
        </div>
      </div>
    </section>

    <section class="ftco-section ftco-booking bg-light" id="booking">
    	<div class="container ftco-relative">
    		<div class="row justify-content-center pb-3">
          <div class="col-md-10 heading-section text-center">
          	<span class="subheading">Booking</span>
            <h2 class="mb-4">Make an Appointment</h2>
            <p>Far far away, behind the word mountains, far from the countries Vokalia and Consonantia</p>
          </div>
        </div>
        <h3 class="vr">Call Us: 012-3456-7890</h3>
    		<div class="row justify-content-center">
    			<div class="col-md-10">
    				<corevo-module type="booking" pos="booking"></corevo-module>
    			</div>
    		</div>
    	</div>
    </section>

    <section class="ftco-section ftco-team">
    	<div class="container-fluid px-md-5">
    		<div class="row justify-content-center pb-3">
          <div class="col-md-10 heading-section text-center">
          	<span class="subheading">Artistic Director</span>
            <h2 class="mb-4">Makeup Artist</h2>
            <p>Far far away, behind the word mountains, far from the countries Vokalia and Consonantia</p>
          </div>
        </div>
        <div class="row">
        	<div class="col-md-12">
        		<div class="carousel-team owl-carousel">
        			<div class="item">
		        		<a href="#" class="team text-center">
		        			<div class="img" style="background-image: url(/sajtbyggare/haircare/images/stylist-1.jpg);"></div>
		        			<h2>Danica Lewis</h2>
		        			<span class="position">Hair Stylist</span>
		        		</a>
        			</div>
        			<div class="item">
	        			<a href="#" class="team text-center">
		        			<div class="img" style="background-image: url(/sajtbyggare/haircare/images/stylist-2.jpg);"></div>
		        			<h2>Nicole Simon</h2>
		        			<span class="position">Nail Master</span>
		        		</a>
	        		</div>
	        		<div class="item">
	        			<a href="#" class="team text-center">
		        			<div class="img" style="background-image: url(/sajtbyggare/haircare/images/stylist-3.jpg);"></div>
		        			<h2>Cloe Meyer</h2>
		        			<span class="position">Director</span>
		        		</a>
	        		</div>
	        		<div class="item">
	        			<a href="#" class="team text-center">
		        			<div class="img" style="background-image: url(/sajtbyggare/haircare/images/stylist-4.jpg);"></div>
		        			<h2>Rachel Clinton</h2>
		        			<span class="position">Hair Stylist</span>
		        		</a>
	        		</div>
	        		<div class="item">
	        			<a href="#" class="team text-center">
		        			<div class="img" style="background-image: url(/sajtbyggare/haircare/images/stylist-5.jpg);"></div>
		        			<h2>Dave Buff</h2>
		        			<span class="position">Barber</span>
		        		</a>
	        		</div>
        		</div>
        	</div>
        </div>
    	</div>
    </section>

    <section class="ftco-section ftco-no-pt ftco-no-pb">
    	<div class="container">
    		<div class="row no-gutters justify-content-center mb-5 pb-2">
          <div class="col-md-6 text-center heading-section">
          	<span class="subheading">Gallery</span>
            <h2 class="mb-4">Our gallery</h2>
            <p>Separated they live in. A small river named Duden flows by their place and supplies it with the necessary regelialia.</p>
          </div>
        </div>
    	</div>
			<div class="container-fluid p-0">
    		<div class="row no-gutters">
    			<div class="col-md-6 col-lg-3">
    				<div class="project">
	    				<img src="/sajtbyggare/haircare/images/work-1.jpg" class="img-fluid" alt="Colorlib Template">
	    				<div class="text">
	    					<span>Stylist</span>
	    					<h3><a href="#">Beard</a></h3>
	    				</div>
	    				<a href="/sajtbyggare/haircare/images/work-1.jpg" class="icon image-popup d-flex justify-content-center align-items-center">
	    					<span class="icon-expand"></span>
	    				</a>
    				</div>
    			</div>
    			<div class="col-md-6 col-lg-3">
    				<div class="project">
	    				<img src="/sajtbyggare/haircare/images/work-2.jpg" class="img-fluid" alt="Colorlib Template">
	    				<div class="text">
	    					<span>Beauty</span>
	    					<h3><a href="#">Haircut</a></h3>
	    				</div>
	    				<a href="/sajtbyggare/haircare/images/work-2.jpg" class="icon image-popup d-flex justify-content-center align-items-center">
	    					<span class="icon-expand"></span>
	    				</a>
    				</div>
    			</div>
    			<div class="col-md-6 col-lg-3">
    				<div class="project">
	    				<img src="/sajtbyggare/haircare/images/work-3.jpg" class="img-fluid" alt="Colorlib Template">
	    				<div class="text">
	    					<span>Beauty</span>
	    					<h3><a href="#">Hairstylist</a></h3>
	    				</div>
	    				<a href="/sajtbyggare/haircare/images/work-3.jpg" class="icon image-popup d-flex justify-content-center align-items-center">
	    					<span class="icon-expand"></span>
	    				</a>
    				</div>
    			</div>
    			<div class="col-md-6 col-lg-3">
    				<div class="project">
	    				<img src="/sajtbyggare/haircare/images/work-4.jpg" class="img-fluid" alt="Colorlib Template">
	    				<div class="text">
	    					<span>Beauty</span>
	    					<h3><a href="#">Haircut</a></h3>
	    				</div>
	    				<a href="/sajtbyggare/haircare/images/work-4.jpg" class="icon image-popup d-flex justify-content-center align-items-center">
	    					<span class="icon-expand"></span>
	    				</a>
    				</div>
    			</div>
    			<div class="col-md-6 col-lg-3">
    				<div class="project">
	    				<img src="/sajtbyggare/haircare/images/work-5.jpg" class="img-fluid" alt="Colorlib Template">
	    				<div class="text">
	    					<span>Beauty</span>
	    					<h3><a href="#">Makeup</a></h3>
	    				</div>
	    				<a href="/sajtbyggare/haircare/images/work-5.jpg" class="icon image-popup d-flex justify-content-center align-items-center">
	    					<span class="icon-expand"></span>
	    				</a>
    				</div>
    			</div>
    			<div class="col-md-6 col-lg-3">
    				<div class="project">
	    				<img src="/sajtbyggare/haircare/images/work-6.jpg" class="img-fluid" alt="Colorlib Template">
	    				<div class="text">
	    					<span>Fashion</span>
	    					<h3><a href="#">Model</a></h3>
	    				</div>
	    				<a href="/sajtbyggare/haircare/images/work-6.jpg" class="icon image-popup d-flex justify-content-center align-items-center">
	    					<span class="icon-expand"></span>
	    				</a>
    				</div>
    			</div>
    			<div class="col-md-6 col-lg-3">
    				<div class="project">
	    				<img src="/sajtbyggare/haircare/images/work-7.jpg" class="img-fluid" alt="Colorlib Template">
	    				<div class="text">
	    					<span>Beauty</span>
	    					<h3><a href="#">Makeup</a></h3>
	    				</div>
	    				<a href="/sajtbyggare/haircare/images/work-7.jpg" class="icon image-popup d-flex justify-content-center align-items-center">
	    					<span class="icon-expand"></span>
	    				</a>
    				</div>
    			</div>
    			<div class="col-md-6 col-lg-3">
    				<div class="project">
	    				<img src="/sajtbyggare/haircare/images/work-8.jpg" class="img-fluid" alt="Colorlib Template">
	    				<div class="text">
	    					<span>Beauty</span>
	    					<h3><a href="#">Makeup</a></h3>
	    				</div>
	    				<a href="/sajtbyggare/haircare/images/work-8.jpg" class="icon image-popup d-flex justify-content-center align-items-center">
	    					<span class="icon-expand"></span>
	    				</a>
    				</div>
    			</div>
    		</div>
    	</div>
		</section>
		
		<section class="ftco-section ftco-pricing">
			<div class="container">
				<div class="row justify-content-center pb-3">
          <div class="col-md-10 heading-section text-center">
          	<span class="subheading">Pricing</span>
            <h2 class="mb-4">Our Prices</h2>
            <p>Far far away, behind the word mountains, far from the countries Vokalia and Consonantia</p>
          </div>
        </div>
        <div class="row">
        	<div class="col-md-3">
        		<div class="pricing-entry pb-5 text-center">
        			<div>
	        			<h3 class="mb-4">Hair Style</h3>
	        			<p><span class="price">$50.00</span> <span class="per">/ session</span></p>
	        		</div>
        			<ul>
        				<li>Hair Dryer</li>
								<li>Hair Coloring</li>
								<li>Hair Cut</li>
								<li>Hair Dresser</li>
								<li>Hair Spa</li>
        			</ul>
        			<p class="button text-center"><a href="#" class="btn btn-primary px-4 py-3">Get Offer</a></p>
        		</div>
        	</div>
        	<div class="col-md-3">
        		<div class="pricing-entry pb-5 text-center">
        			<div>
	        			<h3 class="mb-4">Manicure Pedicure</h3>
	        			<p><span class="price">$34.50</span> <span class="per">/ session</span></p>
	        		</div>
        			<ul>
        				<li>Manicure</li>
								<li>Pedicure</li>
								<li>Coloring</li>
								<li>Nails</li>
								<li>Nail Cut</li>
        			</ul>
        			<p class="button text-center"><a href="#" class="btn btn-primary px-4 py-3">Get Offer</a></p>
        		</div>
        	</div>
        	<div class="col-md-3">
        		<div class="pricing-entry active pb-5 text-center">
        			<div>
	        			<h3 class="mb-4">Makeup</h3>
	        			<p><span class="price">$54.50</span> <span class="per">/ session</span></p>
	        		</div>
        			<ul>
        				<li>Makeup</li>
								<li>Professional Makeup</li>
								<li>Blush On</li>
								<li>Facial Massage</li>
								<li>Facial Spa</li>
        			</ul>
        			<p class="button text-center"><a href="#" class="btn btn-primary px-4 py-3">Get Offer</a></p>
        		</div>
        	</div>
        	<div class="col-md-3">
        		<div class="pricing-entry pb-5 text-center">
        			<div>
	        			<h3 class="mb-4">Body Treatment</h3>
	        			<p><span class="price">$89.50</span> <span class="per">/ session</span></p>
	        		</div>
        			<ul>
        				<li>Massage</li>
								<li>Spa</li>
								<li>Foot Spa</li>
								<li>Body Spa</li>
								<li>Relaxing</li>
        			</ul>
        			<p class="button text-center"><a href="#" class="btn btn-primary px-4 py-3">Get Offer</a></p>
        		</div>
        	</div>
        </div>
			</div>
		</section>

		<section class="testimony-section bg-light">
      <div class="container">
        <div class="row justify-content-center">
        	<div class="col-md-6 col-lg-5 d-flex">
        		<div class="testimony-img" style="background-image: url(/sajtbyggare/haircare/images/testimony-img.jpg);"></div>
        	</div>
          <div class="col-md-6 col-lg-7 py-5 pl-md-5">
          	<div class="py-md-5">
	          	<div class="heading-section">
	          		<span class="subheading">Testimony</span>
			          <h2 class="mb-0">Happy Customer</h2>
			        </div>
	            <div class="carousel-testimony owl-carousel">
	              <div class="item">
	                <div class="testimony-wrap pb-4">
	                  <div class="text">
	                    <p class="mb-4">Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.</p>
	                  </div>
	                  <div class="d-flex">
		                  <div class="user-img" style="background-image: url(/sajtbyggare/haircare/images/stylist-1.jpg)">
		                  </div>
		                  <div class="pos ml-3">
		                  	<p class="name">Jeff Nucci</p>
		                    <span class="position">Businessman</span>
		                  </div>
		                </div>
	                </div>
	              </div>
	              <div class="item">
	                <div class="testimony-wrap pb-4">
	                  <div class="text">
	                    <p class="mb-4">Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.</p>
	                  </div>
	                  <div class="d-flex">
		                  <div class="user-img" style="background-image: url(/sajtbyggare/haircare/images/stylist-2.jpg)">
		                  </div>
		                  <div class="pos ml-3">
		                  	<p class="name">Jeff Nucci</p>
		                    <span class="position">Businessman</span>
		                  </div>
		                </div>
	                </div>
	              </div>
	              <div class="item">
	                <div class="testimony-wrap pb-4">
	                  <div class="text">
	                    <p class="mb-4">Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.</p>
	                  </div>
	                  <div class="d-flex">
		                  <div class="user-img" style="background-image: url(/sajtbyggare/haircare/images/stylist-3.jpg)">
		                  </div>
		                  <div class="pos ml-3">
		                  	<p class="name">Jeff Nucci</p>
		                    <span class="position">Businessman</span>
		                  </div>
		                </div>
	                </div>
	              </div>
	              <div class="item">
	                <div class="testimony-wrap pb-4">
	                  <div class="text">
	                    <p class="mb-4">Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.</p>
	                  </div>
	                  <div class="d-flex">
		                  <div class="user-img" style="background-image: url(/sajtbyggare/haircare/images/stylist-4.jpg)">
		                  </div>
		                  <div class="pos ml-3">
		                  	<p class="name">Jeff Nucci</p>
		                    <span class="position">Businessman</span>
		                  </div>
		                </div>
	                </div>
	              </div>
	              <div class="item">
	                <div class="testimony-wrap pb-4">
	                  <div class="text">
	                    <p class="mb-4">Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.</p>
	                  </div>
	                  <div class="d-flex">
		                  <div class="user-img" style="background-image: url(/sajtbyggare/haircare/images/stylist-5.jpg)">
		                  </div>
		                  <div class="pos ml-3">
		                  	<p class="name">Jeff Nucci</p>
		                    <span class="position">Businessman</span>
		                  </div>
		                </div>
	                </div>
	              </div>
	            </div>
	          </div>
          </div>
        </div>
      </div>
    </section>

    <footer class="ftco-footer ftco-section">
      <div class="container">
        <div class="row mb-5">
          <div class="col-md">
            <div class="ftco-footer-widget mb-4">
              <h2 class="ftco-heading-2 logo">Haircare</h2>
              <p>Far far away, behind the word mountains, far from the countries Vokalia and Consonantia, there live the blind texts.</p>
              <ul class="ftco-footer-social list-unstyled float-md-left float-lft mt-5">
                <li class=""><a href="#"><span class="icon-twitter"></span></a></li>
                <li class=""><a href="#"><span class="icon-facebook"></span></a></li>
                <li class=""><a href="#"><span class="icon-instagram"></span></a></li>
              </ul>
            </div>
          </div>
          <div class="col-md">
            <div class="ftco-footer-widget mb-4 ml-md-5">
              <h2 class="ftco-heading-2">Information</h2>
              <ul class="list-unstyled">
                <li><a href="#" class="py-2 d-block">FAQs</a></li>
                <li><a href="#" class="py-2 d-block">Privacy</a></li>
                <li><a href="#" class="py-2 d-block">Terms Condition</a></li>
              </ul>
            </div>
          </div>
          <div class="col-md">
             <div class="ftco-footer-widget mb-4">
              <h2 class="ftco-heading-2">Links</h2>
              <ul class="list-unstyled">
                <li><a href="#" class="py-2 d-block">Home</a></li>
                <li><a href="#" class="py-2 d-block">About</a></li>
                <li><a href="#" class="py-2 d-block">Services</a></li>
                <li><a href="#" class="py-2 d-block">Work</a></li>
                <li><a href="#" class="py-2 d-block">Blog</a></li>
                <li><a href="#" class="py-2 d-block">Contact</a></li>
              </ul>
            </div>
          </div>
          <div class="col-md">
            <div class="ftco-footer-widget mb-4">
            	<h2 class="ftco-heading-2">Have a Questions?</h2>
            	<div class="block-23 mb-3">
	              <ul>
	                <li><span class="icon icon-map-marker"></span><span class="text">203 Fake St. Mountain View, San Francisco, California, USA</span></li>
	                <li><a href="#"><span class="icon icon-phone"></span><span class="text">+2 392 3929 210</span></a></li>
	                <li><a href="#"><span class="icon icon-envelope"></span><span class="text">info@yourdomain.com</span></a></li>
	              </ul>
	            </div>
            </div>
          </div>
        </div>
        <div class="row">
          <div class="col-md-12 text-center">

            <p><!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. -->
  Copyright &copy; All rights reserved | This template is made with <i class="icon-heart color-danger" aria-hidden="true"></i> by <a href="https://colorlib.com" target="_blank">Colorlib</a>
  <!-- Link back to Colorlib can't be removed. Template is licensed under CC BY 3.0. --></p>
          </div>
        </div>
      </div>
    </footer>

  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
  
`.trim()

export const HAIRCARE_CSS_HREFS = [
  'https://fonts.googleapis.com/css?family=Poppins:300,400,500,600,700',
  'https://fonts.googleapis.com/css?family=Barlow+Condensed:500,600,700&display=swap',
  '/sajtbyggare/haircare/css/open-iconic-bootstrap.min.css',
  // owl.carousel + owl.theme + aos DROPPED (goal-36): they set display:none / opacity:0
  // and only reveal via stripped JS → they HID the Team ("Makeup Artist", 5 stylists)
  // and Testimony carousels. Without them those sections render stacked + visible.
  '/sajtbyggare/haircare/css/magnific-popup.css',
  '/sajtbyggare/haircare/css/ionicons.min.css',
  '/sajtbyggare/haircare/css/bootstrap-datepicker.css',
  '/sajtbyggare/haircare/css/jquery.timepicker.css',
  '/sajtbyggare/haircare/css/flaticon.css',
  '/sajtbyggare/haircare/css/icomoon.css',
  '/sajtbyggare/haircare/css/style.css',
] as const
