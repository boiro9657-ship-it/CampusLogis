/* ==========================================================
   RECHERCHER.JS — page de recherche uniquement
   Charge les logements depuis l'API, avec filtres ville/type/
   budget (venant de l'URL au premier chargement, ou du
   formulaire de recherche de la page).
   ========================================================== */

const form =
document.querySelector(".search-page-box");

const villeInput =
document.getElementById("searchVille");

const budgetInput =
document.getElementById("searchBudget");

const typeSelect =
document.getElementById("searchType");

const resultsContainer =
document.getElementById("searchResults");

if(form){

    // Pré-remplit le formulaire à partir des paramètres
    // transmis depuis la recherche du hero (accueil).
    const params =
    new URLSearchParams(window.location.search);

    if(params.get("ville") && villeInput){

        villeInput.value = params.get("ville");

    }

    if(params.get("type") && typeSelect){

        typeSelect.value = params.get("type");

    }

    form.addEventListener("submit",(e)=>{

        e.preventDefault();

        rechercherLogements();

    });

}

if(resultsContainer){

    rechercherLogements();

}

async function rechercherLogements(){

    const query =
    new URLSearchParams();

    const ville =
    villeInput ? villeInput.value.trim() : "";

    const type =
    typeSelect ? typeSelect.value : "";

    const budgetTexte =
    budgetInput ? budgetInput.value : "";

    if(ville) query.set("ville", ville);
    if(type) query.set("type", type);

    if(budgetTexte){

        const budget =
        parseInt(budgetTexte, 10);

        if(!isNaN(budget)){

            if(budget < 10000){

                showToast("Le budget minimum est de 10 000 FCFA.", "error");

                return;
            }

            query.set("budget", budget);

        }

    }

    resultsContainer.innerHTML =
    '<p class="cards-loading">Chargement des logements...</p>';

    let logements;

    try{

        logements =
        await apiFetch("/logements?" + query.toString());

    }catch(error){

        resultsContainer.innerHTML =
        '<p class="cards-empty">Impossible de charger les logements pour le moment.</p>';

        return;
    }

    if(!logements || logements.length === 0){

        await afficherSuggestions(ville, type);

        return;
    }

    resultsContainer.innerHTML =
    logements.map(carteRechercheHTML).join("");

    attacherBoutonsFavoris(resultsContainer);
    attacherBoutonsReservation(resultsContainer);
    demarrerCarrousels(resultsContainer);

}

/**
 * Aucun logement ne correspond exactement aux filtres : plutôt
 * qu'un simple message, on relâche progressivement les critères
 * (budget puis type puis ville) pour proposer de vraies annonces
 * disponibles proches de la recherche, avec un message clair sur
 * le fait qu'il s'agit de suggestions et non de résultats exacts.
 */
async function afficherSuggestions(ville, type){

    const tentatives = [];

    if(ville) tentatives.push(new URLSearchParams({ ville }));
    tentatives.push(new URLSearchParams());

    let suggestions = [];

    for(const tentative of tentatives){

        try{

            suggestions =
            await apiFetch("/logements?" + tentative.toString());

        }catch(error){

            suggestions = [];
        }

        if(suggestions && suggestions.length > 0) break;

    }

    if(!suggestions || suggestions.length === 0){

        resultsContainer.innerHTML =
        '<p class="cards-empty">Aucun logement disponible pour le moment. Revenez bientôt, de nouvelles annonces sont publiées régulièrement !</p>';

        return;
    }

    resultsContainer.innerHTML = `
        <p class="cards-empty cards-empty-suggestions">
            Aucun logement ne correspond exactement à votre recherche. Voici des logements similaires :
        </p>
    ` + suggestions.slice(0, 6).map(carteRechercheHTML).join("");

    attacherBoutonsFavoris(resultsContainer);
    attacherBoutonsReservation(resultsContainer);
    demarrerCarrousels(resultsContainer);

}

function carteRechercheHTML(logement){

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
    photos[0] || "../../images/logement1.jpg";

    const prix =
    Number(logement.prix).toLocaleString("fr-FR");

    const estReserve =
    logement.statut === "reserve";

    const engagement =
    libelleEngagementDuree(logement.duree_location);

    return `
    <div class="housing-card ${estPro ? "housing-card-pro" : estPremium ? "housing-card-premium" : ""}">

        <div class="card-image-wrap">

            <img src="${image}" data-photos="${photos.join("|")}" data-videos="${videos.join("|")}" class="carousel-img" loading="lazy" alt="${logement.titre}">

            <video class="carousel-video" muted loop playsinline style="display:none;"></video>

            <div class="carousel-dots"></div>

            ${videos.length > 0 ? `<span class="badge-video-card"><i class="ph ph-play-circle"></i> Vidéo</span>` : ""}

            ${engagement ? `<span class="badge-engagement"><i class="ph ph-calendar-check"></i> ${engagement}</span>` : ""}

        </div>

        <span class="badge-card ${estReserve ? "badge-card-reserve" : ""}">${estReserve ? "Déjà réservé" : "Disponible"}</span>

        ${estPro ? `
        <span class="badge-pro">
            <i class="ph ph-medal"></i> Pro
        </span>
        ` : estPremium ? `
        <span class="badge-premium">
            <i class="ph ph-crown-simple"></i> Premium
        </span>
        ` : ""}

        <button class="favorite" data-id="${logement.id}">
            <i class="ph ph-heart"></i>
        </button>

        <div class="housing-content">

            <div class="housing-content-top">
                <h3>${logement.titre}</h3>
                <span class="posted-time">${ilYA(logement.created_at)}</span>
            </div>

            <p>
                <i class="ph ph-map-pin"></i>
                ${logement.ville || ""}
            </p>

            <h4>${prix} FCFA${libelleCourtDuree(logement.duree_location)}</h4>

            <div class="housing-info">
                <span>
                    <i class="ph ${iconeTypeLogement(logement.type)}"></i>
                    ${logement.type || ""}
                </span>
                ${Number(logement.chambres) > 0 ? `
                <span>
                    <i class="ph ph-bed"></i>
                    ${logement.chambres} chambre(s)
                </span>
                ` : ""}
            </div>

            <div class="housing-actions">

                <a href="../details-logement/details-logement.html?id=${logement.id}"
                class="btn-details">
                    Voir plus
                </a>

                <button class="btn-reserver ${estReserve ? "btn-reserver-reserve" : ""}" data-id="${logement.id}" data-statut="${logement.statut || "disponible"}">
                    ${estReserve ? "Déjà réservé" : "Réserver"}
                </button>

            </div>

        </div>

    </div>
    `;

}
