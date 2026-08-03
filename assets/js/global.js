/* ==========================================================
   GLOBAL.JS
   Comportement partagé par les 10 pages : menu mobile,
   ombre navbar au scroll, bouton retour en haut, toast.
   ========================================================== */

/* ==========================
        OMBRE NAVBAR AU SCROLL
========================== */

const siteHeader = document.querySelector("header");

if(siteHeader){

    window.addEventListener("scroll", () => {

        siteHeader.classList.toggle("scrolled", window.scrollY > 20);

    });

}

/* ==========================
        MENU MOBILE
========================== */

const menuToggle =
document.querySelector(".menu-toggle");

const navLinks =
document.querySelector(".nav-links");

const navButtons =
document.querySelector(".nav-buttons");

if(menuToggle && navLinks){

    menuToggle.addEventListener("click",()=>{

        navLinks.classList.toggle("active");

    navButtons.classList.toggle("active");

    const icon =
    menuToggle.querySelector("i");

    if(navLinks.classList.contains("active")){

        icon.classList.replace(
            "fa-bars",
            "fa-xmark"
        );

    }else{

        icon.classList.replace(
            "fa-xmark",
            "fa-bars"
        );

    }

});
}

/* ==========================
       RETOUR EN HAUT
========================== */

const scrollTopBtn =
document.getElementById("scrollTop");

if(scrollTopBtn){

    window.addEventListener("scroll",()=>{

        if(window.scrollY > 300){

            scrollTopBtn.style.display =
            "block";

        }else{

            scrollTopBtn.style.display =
            "none";

        }

    });

    scrollTopBtn.addEventListener("click",()=>{

        window.scrollTo({

            top:0,

            behavior:"smooth"

        });

    });

}

/* ==========================
        TOAST
========================== */

function showToast(message){

    const toast =
    document.getElementById("toast");

    toast.innerHTML =
    "✅ " + message;

    toast.classList.add("show");

    setTimeout(()=>{

        toast.classList.remove("show");

    },3000);

}
