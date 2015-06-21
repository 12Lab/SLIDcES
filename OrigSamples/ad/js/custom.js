/* -------------------- Check Browser --------------------- */

function browser() {
	
	//var isOpera = !!(window.opera && window.opera.version);  // Opera 8.0+
	//var isFirefox = testCSS('MozBoxSizing');                 // FF 0.8+
	var isSafari = Object.prototype.toString.call(window.HTMLElement).indexOf('Constructor') > 0;
	    // At least Safari 3+: "[object HTMLElementConstructor]"
	var isChrome = !isSafari && testCSS('WebkitTransform');  // Chrome 1+
	//var isIE = /*@cc_on!@*/false || testCSS('msTransform');  // At least IE6

	function testCSS(prop) {
	    return prop in document.documentElement.style;
	}
	
	if (isSafari || isChrome) {
		
		return true;
		
	} else {
		
		return false;
		
	}
	
}


jQuery(document).ready(function($){
	
	/* ------------------ Back To Top ------------------- */

	jQuery('#under-footer-back-to-top a').click(function(){
		jQuery('html, body').animate({scrollTop:0}, 300); 
		return false; 
	});
});
	

/* ------------------ Icon Box Hover Effect ----------------- */

jQuery(document).ready(function () {
	
	$('.icons-box').hover(function () {
		
		firstClassName = $(this).find('i').attr('class').split(' ')[0];
		
		className = $(this).find('i').attr('class');
		
		$(this).find('i').removeClass(className);
		
		$(this).find('i').addClass(firstClassName).addClass('ico-white circle-white big-red');
		
		
	},function () {
		
		$(this).find('i').removeClass('ico-white circle-white big-red');
		
		$(this).find('i').addClass(className);
		
	});
	
});