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

const budgetSelect =
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
    budgetSelect ? budgetSelect.value : "";

    if(ville) query.set("ville", ville);
    if(type) query.set("type", type);

    if(budgetTexte){

        const budget =
        parseInt(budgetTexte.replace(/\D/g, ""), 10);

        if(!isNaN(budget)){

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

        resultsContainer.innerHTML =
        '<p class="cards-empty">Aucun logement ne correspond à votre recherche.</p>';

        return;
    }

    resultsContainer.innerHTML =
    logements.map(carteRechercheHTML).join("");

    attacherBoutonsFavoris(resultsContainer);
    attacherBoutonsReservation(resultsContainer);

}

function carteRechercheHTML(logement){

    const estPremium =
    Number(logement.premium) === 1;

    const image =
    logement.image_url || "../../images/logement1.jpg";

    const prix =
    Number(logement.prix).toLocaleString("fr-FR");

    return `
    <div class="housing-card ${estPremium ? "housing-card-premium" : ""}">

        <img src="${image}" loading="lazy" alt="${logement.titre}">

        <span class="badge-card">Disponible</span>

        ${estPremium ? `
        <span class="badge-premium">
            <i class="ph ph-crown-simple"></i> Premium
        </span>
        ` : ""}

        <button class="favorite" data-id="${logement.id}">
            <i class="ph ph-heart"></i>
        </button>

        <div class="housing-content">

            <h3>${logement.titre}</h3>

            <p>
                <i class="ph ph-map-pin"></i>
                ${logement.ville || ""}
            </p>

            <h4>${prix} FCFA/mois</h4>

            <div class="housing-info">
                <span>
                    <i class="ph ph-bed"></i>
                    ${logement.chambres || 0} chambre(s)
                </span>
            </div>

            <div class="housing-actions">

                <a href="../details-logement/details-logement.html?id=${logement.id}"
                class="btn-details">
                    Voir plus
                </a>

                <button class="btn-reserver" data-id="${logement.id}">
                    Réserver
                </button>

            </div>

        </div>

    </div>
    `;

}
