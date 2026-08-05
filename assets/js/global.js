/* ==========================================================
   GLOBAL.JS
   Comportement partagé par les 10 pages : menu mobile,
   ombre navbar au scroll, bouton retour en haut, toast.
   ========================================================== */

/* ==========================
    SUIVI DES VISITES
    Un seul appel par chargement de page, sans bloquer le rendu
    ni empêcher la page de fonctionner si ça échoue.
========================== */

if(typeof apiFetch !== "undefined"){

    apiFetch("/visites", {

        method: "POST",

        body: JSON.stringify({ page: window.location.pathname })

    }).catch(() => {});

}

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

    apiFetch("/auth/me").then((utilisateur)=>{

        const navBtn =
        document.querySelector(".btn-nav-link");

        if(!navBtn) return;

        // window.API_BASE ("backend/api" ou "../../backend/api"
        // selon la profondeur de la page) donne déjà le chemin
        // relatif vers la racine du site, sans avoir à le
        // recalculer autrement ici.
        const racine =
        window.API_BASE.replace("backend/api", "");

        const lienTableauDeBord =
        utilisateur.role === "admin"
        ? racine + "pages/dashboard-admin/dashboard-admin.html"
        : racine + "pages/dashboard-proprietaire/dashboard-proprietaire.html";

        navBtn.textContent = "Mon compte";
        navBtn.setAttribute("href", lienTableauDeBord);

        // Le bouton "Déconnexion" du tableau de bord est dans la
        // barre latérale, masquée sur mobile — sans ça, aucun
        // moyen de se déconnecter depuis un téléphone. On ajoute
        // donc un lien de déconnexion dans le menu mobile
        // (hamburger), présent sur toutes les pages.
        const navLinks =
        document.querySelector(".nav-links");

        if(navLinks && !document.getElementById("logoutNavLink")){

            const item =
            document.createElement("li");

            item.innerHTML =
            `<a href="#" id="logoutNavLink"><i class="ph ph-sign-out"></i> Déconnexion</a>`;

            navLinks.appendChild(item);

            document.getElementById("logoutNavLink").addEventListener("click", async (e)=>{

                e.preventDefault();

                await apiFetch("/auth/logout", { method:"POST" });

                window.location.href = racine + "index.html";

            });

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

        showToast("Connectez-vous pour ajouter des favoris.", "error");

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

        if(error.status === 401){

            showToast("Connectez-vous pour réserver un logement — redirection...", "error");

            const lienConnexion =
            document.querySelector(".btn-nav-link");

            setTimeout(()=>{

                if(lienConnexion){

                    window.location.href =
                    lienConnexion.getAttribute("href");

                }

            }, 1500);

        }else{

            showToast("Impossible d'envoyer la demande de réservation.", "error");

        }

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
    CARROUSEL PHOTOS (CARTES)
    Réutilisé par l'accueil et la recherche pour faire défiler
    automatiquement les photos d'une annonce qui en a plusieurs
    (image data-photos="url1|url2|url3"), avec des points de
    navigation cliquables.
========================== */

function demarrerCarrousels(container){

    container.querySelectorAll(".carousel-img[data-photos]").forEach(img => {

        const photos =
        img.dataset.photos.split("|").filter(Boolean);

        if(photos.length <= 1) return;

        const dotsContainer =
        img.parentElement.querySelector(".carousel-dots");

        let index = 0;

        if(dotsContainer){

            dotsContainer.innerHTML =
            photos.map((_, i) => `<span class="carousel-dot${i === 0 ? " active" : ""}"></span>`).join("");

        }

        const afficherPhoto = (i) => {

            index = i;
            img.src = photos[index];

            if(dotsContainer){

                dotsContainer.querySelectorAll(".carousel-dot").forEach((dot, di) => {

                    dot.classList.toggle("active", di === index);

                });

            }

        };

        let intervalle =
        setInterval(() => afficherPhoto((index + 1) % photos.length), 3500);

        const carte =
        img.closest(".card, .housing-card");

        if(carte){

            carte.addEventListener("mouseenter", () => clearInterval(intervalle));

            carte.addEventListener("mouseleave", () => {

                intervalle = setInterval(() => afficherPhoto((index + 1) % photos.length), 3500);

            });

        }

        if(dotsContainer){

            dotsContainer.querySelectorAll(".carousel-dot").forEach((dot, i) => {

                dot.addEventListener("click", (e) => {

                    e.preventDefault();
                    e.stopPropagation();

                    afficherPhoto(i);

                });

            });

        }

    });

}

/* ==========================
        TOAST
========================== */

function showToast(message, type = "success"){

    const toast =
    document.getElementById("toast");

    const icone =
    type === "error" ? "⚠️" : "✅";

    toast.innerHTML =
    icone + " " + message;

    toast.classList.toggle("toast-error", type === "error");

    toast.classList.add("show");

    setTimeout(()=>{

        toast.classList.remove("show");

    },3000);

}
