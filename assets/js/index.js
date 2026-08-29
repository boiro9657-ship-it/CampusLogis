/* ==========================================================
   INDEX.JS — page d'accueil uniquement
   Compteurs animés, accordéon FAQ, gestion des favoris.
   ========================================================== */

/* ==========================
    RÉVÉLATION AU SCROLL
========================== */

const revealElements =
document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        if(entry.isIntersecting){

            entry.target.classList.add("revealed");

            revealObserver.unobserve(entry.target);

        }

    });

}, { threshold:.15 });

revealElements.forEach(el => revealObserver.observe(el));

/* ==========================
    TEXTE DÉFILANT DU HERO
    Fait défiler verticalement, une à la fois, une série de phrases
    sous le titre — remplace l'ancien sous-titre statique pour capter
    l'attention dès les premières secondes.
========================== */

(() => {

    const items =
    document.querySelectorAll("#heroRotatingList li");

    if(items.length < 2) return;

    let indexActif = 0;

    setInterval(() => {

        const ancienIndex =
        indexActif;

        items[ancienIndex].classList.remove("active");
        items[ancienIndex].classList.add("leaving");

        indexActif =
        (indexActif + 1) % items.length;

        items[indexActif].classList.remove("leaving");
        items[indexActif].classList.add("active");

        setTimeout(() => {

            items[ancienIndex].classList.remove("leaving");

        }, 650);

    }, 2800);

})();

/* ==========================
    ONGLETS DE LA CARTE DE RECHERCHE
========================== */

const searchTabs =
document.querySelectorAll(".search-tab");

const heroTypeInput =
document.getElementById("heroType");

searchTabs.forEach(tab => {

    tab.addEventListener("click", () => {

        searchTabs.forEach(t => t.classList.remove("active"));

        tab.classList.add("active");

        if(heroTypeInput){

            heroTypeInput.value = tab.dataset.type;

        }

    });

});

/* ==========================
    RECHERCHE DU HERO
========================== */

const heroSearchForm =
document.getElementById("heroSearchForm");

if(heroSearchForm){

    heroSearchForm.addEventListener("submit", (e) => {

        e.preventDefault();

        const ville =
        document.getElementById("heroVille").value.trim();

        const type =
        document.getElementById("heroType").value;

        const budget =
        document.getElementById("heroBudget").value;

        if(budget && Number(budget) < 10000){

            showToast("Le budget minimum est de 10 000 FCFA.", "error");

            return;
        }

        const params = new URLSearchParams();

        if(ville) params.set("ville", ville);
        if(type) params.set("type", type);
        if(budget) params.set("budget", budget);

        window.location.href =
        "pages/rechercher/rechercher.html" +
        (params.toString() ? "?" + params.toString() : "");

    });

}

/* ==========================
    STATISTIQUES RÉELLES
    (nombre réel de logements/propriétaires/villes, jamais de
    chiffres inventés)
========================== */

function animerCompteur(element, cible){

    if(!element) return;

    let count = 0;

    const increment = Math.max(cible / 60, 1);

    const update = () => {

        count += increment;

        if(count < cible){

            element.textContent = Math.floor(count);

            requestAnimationFrame(update);

        }else{

            element.textContent = cible;

        }

    };

    if(cible > 0){
        update();
    }else{
        element.textContent = "0";
    }

}

async function chargerStatistiques(){

    let stats;

    try{

        stats = await apiFetch("/logements/stats");

    }catch(error){

        return;
    }

    animerCompteur(document.getElementById("heroStatLogements"), stats.logements);
    animerCompteur(document.getElementById("heroStatProprietaires"), stats.proprietaires);
    animerCompteur(document.getElementById("heroStatVilles"), stats.villes);

    animerCompteur(document.getElementById("statLogements"), stats.logements);
    animerCompteur(document.getElementById("statProprietaires"), stats.proprietaires);
    animerCompteur(document.getElementById("statVilles"), stats.villes);

}

chargerStatistiques();

/* ==========================
    ACCORDÉON FAQ
========================== */

const questions = document.querySelectorAll(".faq-question");

questions.forEach(question => {

    question.addEventListener("click", () => {

        const answer = question.nextElementSibling;

        if(answer.style.maxHeight){

            answer.style.maxHeight = null;

            question.querySelector("span").innerHTML = "+";

        }else{

            answer.style.maxHeight = answer.scrollHeight + "px";

            question.querySelector("span").innerHTML = "−";

        }

    });

});

/* ==========================
    LOGEMENTS POPULAIRES (API)
========================== */

const featuredContainer =
document.getElementById("featuredCards");

if(featuredContainer){

    featuredContainer.innerHTML = skeletonCardsHTML(6);

    chargerLogementsPopulaires();

}

async function chargerLogementsPopulaires(){

    let logements;

    try{

        logements = await apiFetch("/logements");

    }catch(error){

        featuredContainer.innerHTML =
        '<p class="cards-empty">Impossible de charger les logements pour le moment.</p>';

        return;
    }

    logements = logements || [];

    if(logements.length === 0){

        featuredContainer.innerHTML =
        '<p class="cards-empty">Aucun logement disponible pour le moment.</p>';

        return;
    }

    // Section "populaires" volontairement limitée à un aperçu de 6
    // logements — le bouton "Voir tous les logements" (vers la page
    // Rechercher, qui n'a aucune limite) n'apparaît que s'il y a
    // vraiment plus à voir, pour ne pas induire en erreur.
    const featuredMore =
    document.getElementById("featuredMore");

    if(featuredMore){
        featuredMore.style.display = logements.length > 6 ? "" : "none";
    }

    featuredContainer.innerHTML =
    logements.slice(0, 6).map(carteLogementHTML).join("");

    attacherBoutonsFavoris(featuredContainer);
    attacherBoutonsReservation(featuredContainer);
    demarrerCarrousels(featuredContainer);

}

function carteLogementHTML(logement){

    // La mise en avant reflète le plan ACTUEL du propriétaire (pas
    // un indicateur figé sur l'annonce) : dès qu'il passe Premium
    // ou Pro, toutes ses annonces en profitent immédiatement.
    const planProprietaire =
    logement.owner_plan || "gratuit";

    const estPro =
    planProprietaire === "pro";

    const estPremium =
    planProprietaire === "premium";

    const photos =
    (logement.photos ? logement.photos.split("|") : [logement.image_url]).filter(Boolean);

    const videos =
    (logement.videos ? logement.videos.split("|") : []).filter(Boolean);

    const image =
    photos[0] || "images/logement1.jpg";

    const prix =
    Number(logement.prix).toLocaleString("fr-FR");

    const estReserve =
    logement.statut === "reserve";

    const dureeBadge =
    libelleDureeCarte(logement.duree_location, logement.duree_location_autre);

    return `
    <div class="card ${estPro ? "card-pro" : estPremium ? "card-premium" : ""}">

        <div class="card-image">

            <img src="${image}" data-photos="${photos.join("|")}" data-videos="${videos.join("|")}" class="carousel-img" loading="lazy" alt="${logement.titre}">

            <video class="carousel-video" muted loop playsinline style="display:none;"></video>

            <div class="carousel-dots"></div>

            ${videos.length > 0 ? `<span class="badge-video-card"><i class="ph ph-play-circle"></i> Vidéo</span>` : ""}

            ${dureeBadge ? `<span class="badge-engagement"><i class="ph ${iconeDuree(logement.duree_location)}"></i> ${dureeBadge}</span>` : ""}

            <span class="badge-card">Disponible</span>

            ${estPro ? `
            <span class="badge-pro">
                <i class="ph ph-medal"></i> Pro
            </span>
            ` : estPremium ? `
            <span class="badge-premium">
                <i class="ph ph-crown-simple"></i> Premium
            </span>
            ` : ""}

            ${estAnnonceRecente(logement.created_at) ? `<span class="badge-nouveau"><i class="ph ph-sparkle"></i> Nouveau</span>` : ""}

            <button class="favorite" data-id="${logement.id}">❤</button>

        </div>

        <div class="card-content">

            <div class="card-content-top">
                <h3>${logement.titre}</h3>
                <span class="posted-time">${ilYA(logement.created_at)}</span>
            </div>

            <p class="location"><i class="ph ph-map-pin"></i> ${logement.ville || ""}</p>

            <p class="price">${prix} FCFA${libelleCourtDuree(logement.duree_location)}</p>

            <div class="feature-chips">
                ${Number(logement.chambres) > 0 ? `<span class="feature-chip"><i class="ph ${iconePieces(logement.type)}"></i> ${logement.chambres} ${libeleUnitePieces(logement.type)}(s)</span>` : ""}
                ${Number(logement.salles_bain) > 0 ? `<span class="feature-chip"><i class="ph ${ICONE_SALLES_BAIN}"></i> ${logement.salles_bain} salle${logement.salles_bain > 1 ? "s" : ""} de bain</span>` : ""}
                ${Number(logement.superficie) > 0 ? `<span class="feature-chip"><i class="ph ${ICONE_SUPERFICIE}"></i> ${Number(logement.superficie)} m²</span>` : ""}
            </div>

            <div class="infos">
                <span><i class="ph ${iconeTypeLogement(logement.type)}"></i> ${logement.type || ""}</span>
                ${dureeBadge ? `<span><i class="ph ${iconeDuree(logement.duree_location)}"></i> ${dureeBadge.replace("Location : ", "")}</span>` : ""}
            </div>

            <span class="badge-verifie"><i class="ph ph-shield-check"></i> Propriétaire vérifié</span>

            <div class="bottom-card">

                <button class="btn-reserver ${estReserve ? "btn-reserver-reserve" : ""}" data-id="${logement.id}" data-statut="${logement.statut || "disponible"}">
                    <i class="ph ph-calendar-check"></i> ${estReserve ? "Déjà réservé" : "Demander une visite"}
                </button>

                <a href="pages/details-logement/details-logement.html?id=${logement.id}" class="btn-details">
                    Voir les détails <i class="ph ph-arrow-right"></i>
                </a>

            </div>

        </div>

    </div>
    `;

}

/* ==========================
    TÉMOIGNAGES (API)
    Vrais commentaires laissés sur des annonces, présentés en
    carrousel défilant automatiquement de droite à gauche, un par
    un. La section entière reste masquée s'il n'y a pas au moins
    deux témoignages réels à montrer.
========================== */

const temoignagesSection =
document.getElementById("temoignagesSection");

if(temoignagesSection){

    chargerTemoignages();

}

let temoignageIndex = 0;
let temoignagesChronometre = null;

async function chargerTemoignages(){

    let temoignages;

    try{

        temoignages = await apiFetch("/temoignages?limite=10");

    }catch(error){

        return;
    }

    if(!temoignages || temoignages.length < 2){

        return;
    }

    const track =
    document.getElementById("temoignagesTrack");

    const dots =
    document.getElementById("temoignagesDots");

    track.innerHTML =
    temoignages.map(temoignageHTML).join("");

    dots.innerHTML =
    temoignages.map((t, i) => `<span class="temoignage-dot ${i === 0 ? "active" : ""}"></span>`).join("");

    temoignagesSection.style.display = "";

    temoignagesChronometre =
    setInterval(() => avancerTemoignage(temoignages.length), 5000);

    dots.querySelectorAll(".temoignage-dot").forEach((dot, i) => {

        dot.addEventListener("click", () => {

            temoignageIndex = i;

            positionnerTemoignages();

            clearInterval(temoignagesChronometre);

            temoignagesChronometre = setInterval(() => avancerTemoignage(temoignages.length), 5000);

        });

    });

}

function avancerTemoignage(total){

    temoignageIndex = (temoignageIndex + 1) % total;

    positionnerTemoignages();

}

function positionnerTemoignages(){

    const track =
    document.getElementById("temoignagesTrack");

    track.style.transform = `translateX(-${temoignageIndex * 100}%)`;

    document.querySelectorAll(".temoignage-dot").forEach((dot, i) => {

        dot.classList.toggle("active", i === temoignageIndex);

    });

}

function temoignageHTML(t){

    const avatar =
    t.auteur_photo
    ? `<img src="${t.auteur_photo}" alt="${t.auteur_nom}">`
    : `<i class="ph ph-user"></i>`;

    const roleLabel =
    t.role_auteur === "proprietaire" ? "Propriétaire sur TerangaHome" : "Locataire sur TerangaHome";

    return `
    <div class="temoignage-slide">

        <div class="temoignage-card">

            <div class="temoignage-avatar">${avatar}</div>

            <p class="temoignage-texte">« ${t.message} »</p>

            <p class="temoignage-auteur">
                ${t.auteur_nom}
                <span>${roleLabel}</span>
            </p>

        </div>

    </div>
    `;

}
