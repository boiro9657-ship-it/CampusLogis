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

        // "Mon profil" et "Déconnexion" ne vivaient que dans la
        // barre latérale du tableau de bord, masquée sur mobile —
        // sans ça, aucun moyen d'y accéder depuis un téléphone. On
        // les ajoute donc dans le menu de navigation (hamburger
        // sur mobile), présent sur toutes les pages, pour
        // locataire comme propriétaire.
        const navLinks =
        document.querySelector(".nav-links");

        if(navLinks && !document.getElementById("profilNavLink")){

            const itemProfil =
            document.createElement("li");

            itemProfil.innerHTML =
            `<a href="${racine}pages/profil/profil.html" id="profilNavLink"><i class="ph ph-user-circle"></i> Mon profil</a>`;

            navLinks.appendChild(itemProfil);

        }

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

        initClocheNotifications(racine);

    }).catch(()=>{});

}

/* ==========================
    NOTIFICATIONS (CLOCHE NAVBAR)
    Affiche une cloche avec le nombre de notifications non lues
    (nouveaux logements publiés) dans les boutons de navbar,
    présente sur toutes les pages pour tout utilisateur connecté.
========================== */

function initClocheNotifications(racine){

    const navButtons =
    document.querySelector(".nav-buttons");

    if(!navButtons || document.getElementById("notifBellWrap")) return;

    const wrap =
    document.createElement("div");

    wrap.id = "notifBellWrap";
    wrap.className = "notif-bell-wrap";

    wrap.innerHTML = `
        <button type="button" class="notif-bell" id="notifBellBtn">
            <i class="ph ph-bell"></i>
            <span class="notif-badge" id="notifBadge" style="display:none;"></span>
        </button>
        <div class="notif-dropdown" id="notifDropdown">
            <div class="notif-dropdown-header">Notifications</div>
            <div class="notif-dropdown-list" id="notifList">
                <p class="notif-empty">Chargement...</p>
            </div>
        </div>
    `;

    navButtons.insertBefore(wrap, navButtons.firstChild);

    const bellBtn =
    document.getElementById("notifBellBtn");

    const dropdown =
    document.getElementById("notifDropdown");

    bellBtn.addEventListener("click", (e) => {

        e.stopPropagation();

        const ouverte =
        dropdown.classList.toggle("show");

        if(ouverte){

            marquerNotificationsCommeLues();

        }

    });

    document.addEventListener("click", (e) => {

        if(!wrap.contains(e.target)){

            dropdown.classList.remove("show");

        }

    });

    chargerNotifications(racine);

}

async function chargerNotifications(racine){

    let notifications;

    try{

        notifications = await apiFetch("/notifications");

    }catch(error){

        return;
    }

    const badge =
    document.getElementById("notifBadge");

    const nbNonLues =
    notifications.filter(n => !Number(n.lu)).length;

    if(badge){

        if(nbNonLues > 0){

            badge.textContent = nbNonLues > 9 ? "9+" : nbNonLues;
            badge.style.display = "";

        }else{

            badge.style.display = "none";

        }

    }

    const list =
    document.getElementById("notifList");

    if(!list) return;

    if(notifications.length === 0){

        list.innerHTML =
        `<p class="notif-empty">Aucune notification pour le moment.</p>`;

        return;
    }

    list.innerHTML =
    notifications.map(n => {

        const date =
        new Date(n.created_at).toLocaleDateString("fr-FR", { day:"numeric", month:"short", hour:"2-digit", minute:"2-digit" });

        return `
        <a href="${n.lien ? racine + n.lien : "#"}" class="notif-item${Number(n.lu) ? "" : " notif-item-non-lu"}">
            <p>${n.message}</p>
            <span>${date}</span>
        </a>
        `;

    }).join("");

}

async function marquerNotificationsCommeLues(){

    const badge =
    document.getElementById("notifBadge");

    if(badge) badge.style.display = "none";

    try{

        await apiFetch("/notifications/lu", { method:"PUT" });

    }catch(error){

        // Pas grave si ça échoue : la cloche réaffichera juste le
        // compteur au prochain chargement de page.

    }

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
    Réutilisé par l'accueil, la recherche et la page détails pour
    tout bouton .btn-reserver (ou #contactOwnerBtn) portant un
    data-id. Ouvre une vraie modale (message + acceptation des
    conditions d'utilisation) plutôt qu'un prompt() du navigateur.
========================== */

function creerModaleReservation(){

    if(document.getElementById("reservationModalOverlay")) return;

    const racine =
    window.API_BASE ? window.API_BASE.replace("backend/api", "") : "";

    const overlay =
    document.createElement("div");

    overlay.id = "reservationModalOverlay";
    overlay.className = "reservation-modal-overlay";

    overlay.innerHTML = `
        <div class="reservation-modal">

            <button type="button" class="reservation-modal-close" id="reservationModalClose">
                <i class="ph ph-x"></i>
            </button>

            <h3><i class="ph ph-calendar-check"></i> Demande de réservation</h3>

            <p class="reservation-modal-hint">
                Laissez un message au propriétaire (facultatif), puis confirmez votre demande.
            </p>

            <textarea id="reservationMessage" maxlength="500" placeholder="Ex : Bonjour, je suis intéressé(e) par ce logement, serait-il possible de le visiter cette semaine ?"></textarea>

            <label class="reservation-modal-terms">
                <input type="checkbox" id="reservationTerms">
                J'accepte les <a href="${racine}pages/conditions-utilisation/conditions-utilisation.html" target="_blank" rel="noopener">conditions d'utilisation</a>
            </label>

            <div class="reservation-modal-actions">
                <button type="button" class="btn-secondary" id="reservationModalCancel">Annuler</button>
                <button type="button" class="btn-primary" id="reservationModalSubmit">Envoyer la demande</button>
            </div>

        </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById("reservationModalClose").addEventListener("click", fermerModaleReservation);
    document.getElementById("reservationModalCancel").addEventListener("click", fermerModaleReservation);

    overlay.addEventListener("click", (e) => {

        if(e.target === overlay) fermerModaleReservation();

    });

}

function fermerModaleReservation(){

    const overlay =
    document.getElementById("reservationModalOverlay");

    if(overlay) overlay.classList.remove("show");

}

function reserverLogement(logementId){

    creerModaleReservation();

    const overlay =
    document.getElementById("reservationModalOverlay");

    document.getElementById("reservationMessage").value = "";
    document.getElementById("reservationTerms").checked = false;

    overlay.classList.add("show");

    document.getElementById("reservationModalSubmit").onclick =
    () => envoyerReservation(logementId);

}

async function envoyerReservation(logementId){

    const message =
    document.getElementById("reservationMessage").value.trim();

    const accepte =
    document.getElementById("reservationTerms").checked;

    if(!accepte){

        showToast("Vous devez accepter les conditions d'utilisation pour réserver.", "error");

        return;
    }

    const submitBtn =
    document.getElementById("reservationModalSubmit");

    submitBtn.disabled = true;

    try{

        await apiFetch("/reservations", {

            method: "POST",

            body: JSON.stringify({
                logement_id: logementId,
                message,
                conditions_acceptees: true
            })

        });

        showToast("Demande de réservation envoyée !");

        fermerModaleReservation();

    }catch(error){

        if(error.status === 401){

            showToast("Connectez-vous pour réserver un logement — redirection...", "error");

            fermerModaleReservation();

            const lienConnexion =
            document.querySelector(".btn-nav-link");

            setTimeout(()=>{

                if(lienConnexion){

                    window.location.href =
                    lienConnexion.getAttribute("href");

                }

            }, 1500);

        }else{

            showToast(error.message || "Impossible d'envoyer la demande de réservation.", "error");

        }

    }finally{

        submitBtn.disabled = false;

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
    DURÉE DE LOCATION
    Réutilisé par toutes les cartes de logement (accueil,
    recherche, similaires) pour afficher le prix avec la bonne
    période ("/mois", "/nuit", "/semaine"...) au lieu d'un "/mois"
    fixe qui serait faux pour une annonce en courte durée.
========================== */

const LIBELLES_COURTS_DUREE = {
    "24h": "/24h",
    nuit: "/nuitée",
    journee: "/jour",
    semaine: "/semaine",
    "1_mois": "/mois",
    "3_mois": "/3 mois",
    "6_mois": "/6 mois",
    "1_an": "/an"
};

function libelleCourtDuree(duree){

    return LIBELLES_COURTS_DUREE[duree] || "/mois";

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
