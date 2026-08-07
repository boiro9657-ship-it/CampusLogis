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

    logements = (logements || []).slice(0, 6);

    if(logements.length === 0){

        featuredContainer.innerHTML =
        '<p class="cards-empty">Aucun logement disponible pour le moment.</p>';

        return;
    }

    featuredContainer.innerHTML =
    logements.map(carteLogementHTML).join("");

    attacherBoutonsFavoris(featuredContainer);
    attacherBoutonsReservation(featuredContainer);
    demarrerCarrousels(featuredContainer);

}

function carteLogementHTML(logement){

    const estPremium =
    Number(logement.premium) === 1;

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

    return `
    <div class="card ${estPremium ? "card-premium" : ""}">

        <div class="card-image">

            <img src="${image}" data-photos="${photos.join("|")}" data-videos="${videos.join("|")}" class="carousel-img" loading="lazy" alt="${logement.titre}">

            <video class="carousel-video" muted loop playsinline style="display:none;"></video>

            <div class="carousel-dots"></div>

            ${videos.length > 0 ? `<span class="badge-video-card"><i class="ph ph-play-circle"></i> Vidéo</span>` : ""}

            <span class="badge-card ${estReserve ? "badge-card-reserve" : ""}">${estReserve ? "Déjà réservé" : "Disponible"}</span>

            ${estPremium ? `
            <span class="badge-premium">
                <i class="ph ph-crown-simple"></i> Premium
            </span>
            ` : ""}

            <button class="favorite" data-id="${logement.id}">❤</button>

        </div>

        <div class="card-content">

            <h3>${logement.titre}</h3>

            <p class="price">${prix} FCFA${libelleCourtDuree(logement.duree_location)}</p>

            <p class="location">📍 ${logement.ville || ""}</p>

            <div class="infos">
                <span>🛏 ${logement.chambres || 0} Chambre(s)</span>
            </div>

            <div class="bottom-card">

                <button class="btn-reserver ${estReserve ? "btn-reserver-reserve" : ""}" data-id="${logement.id}" data-statut="${logement.statut || "disponible"}">
                    ${estReserve ? "Déjà réservé" : "Réserver"}
                </button>

                <a href="pages/details-logement/details-logement.html?id=${logement.id}">
                    Voir les détails →
                </a>

            </div>

        </div>

    </div>
    `;

}
