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
    ÉTAT DE CONNEXION (NAVBAR)
========================== */

if(typeof apiFetch !== "undefined"){

    apiFetch("/auth/me").then(()=>{

        const navBtn =
        document.querySelector(".btn-nav-link");

        // Réutilise le lien déjà présent dans le menu (chemin
        // relatif correct quelle que soit la profondeur de la
        // page) plutôt que de le recalculer à la main ici.
        const dashboardLink =
        document.querySelector('.nav-links a[href*="dashboard-proprietaire"]');

        if(navBtn && dashboardLink){

            navBtn.textContent = "Mon compte";
            navBtn.setAttribute("href", dashboardLink.getAttribute("href"));

        }

    }).catch(()=>{});

}

/* ==========================
    FAVORIS (API)
    Réutilisé par l'accueil, la recherche et la page favoris
    pour tout bouton .favorite portant un data-id.
========================== */

async function toggleFavorite(button){

    const logementId = button.dataset.id;

    try{

        if(button.classList.contains("active")){

            await apiFetch("/favoris/" + logementId, { method:"DELETE" });

            button.classList.remove("active");

        }else{

            await apiFetch("/favoris/" + logementId, { method:"POST" });

            button.classList.add("active");

        }

    }catch(error){

        showToast("Connectez-vous pour ajouter des favoris.");

    }

}

async function marquerFavorisActifs(container){

    let favoris;

    try{

        favoris = await apiFetch("/favoris");

    }catch(error){

        return;
    }

    const idsFavoris =
    (favoris || []).map(f => String(f.id));

    container.querySelectorAll(".favorite").forEach(btn => {

        if(idsFavoris.includes(btn.dataset.id)){

            btn.classList.add("active");

        }

    });

}

function attacherBoutonsFavoris(container){

    container.querySelectorAll(".favorite").forEach(btn => {

        btn.addEventListener("click", () => toggleFavorite(btn));

    });

    marquerFavorisActifs(container);

}

/* ==========================
    RÉSERVATIONS (API)
    Réutilisé par l'accueil et la recherche pour tout bouton
    .btn-reserver portant un data-id.
========================== */

async function reserverLogement(logementId){

    const message =
    prompt("Un message pour le propriétaire ? (facultatif)");

    if(message === null) return;

    try{

        await apiFetch("/reservations", {

            method: "POST",

            body: JSON.stringify({
                logement_id: logementId,
                message
            })

        });

        showToast("Demande de réservation envoyée !");

    }catch(error){

        showToast("Connectez-vous pour réserver un logement.");

    }

}

function attacherBoutonsReservation(container){

    container.querySelectorAll(".btn-reserver").forEach(btn => {

        btn.addEventListener("click", (e) => {

            e.preventDefault();

            reserverLogement(btn.dataset.id);

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
