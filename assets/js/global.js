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

    // Empêche la navbar fixe de cacher le haut de la page :
    // mesure la vraie hauteur de la navbar (au lieu d'un
    // chiffre codé en dur, qui se désynchronise dès que la
    // navbar change de hauteur — mobile, contenu, police...)
    // et l'expose en variable CSS + en décalage d'ancre.
    const setScrollOffset = () => {

        const height =
        siteHeader.getBoundingClientRect().height;

        document.documentElement.style.setProperty(
            "--header-height",
            height + "px"
        );

        document.documentElement.style.scrollPaddingTop =
        (height + 15) + "px";

    };

    setScrollOffset();

    // Recalcule une fois toutes les ressources chargées (polices,
    // icônes Phosphor) : leur chargement asynchrone peut changer
    // la hauteur réelle de la navbar après la première mesure.
    window.addEventListener("load", setScrollOffset);

    window.addEventListener("resize", setScrollOffset);

}

/* ==========================
        MENU MOBILE
========================== */

const menuToggle =
document.querySelector(".menu-toggle");

const navLinks =
document.querySelector(".nav-links");

if(menuToggle && navLinks){

    menuToggle.addEventListener("click",()=>{

        navLinks.classList.toggle("active");

    const icon =
    menuToggle.querySelector("i");

    if(navLinks.classList.contains("active")){

        icon.classList.replace(
            "ph-list",
            "ph-x"
        );

    }else{

        icon.classList.replace(
            "ph-x",
            "ph-list"
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
