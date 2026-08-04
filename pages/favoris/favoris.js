/* ==========================================================
   FAVORIS.JS — page favoris uniquement
   Page protégée : affiche les logements favoris de
   l'utilisateur connecté, chargés depuis l'API.
   ========================================================== */

const favorisContainer =
document.getElementById("favoris-container");

if(favorisContainer){

    (async () => {

        try{

            await apiFetch("/auth/me");

        }catch(error){

            window.location.href =
            "../connexion/connexion.html";

            return;
        }

        chargerFavoris();

    })();

}

async function chargerFavoris(){

    let logements;

    try{

        logements = await apiFetch("/favoris");

    }catch(error){

        favorisContainer.innerHTML =
        '<p class="cards-empty">Impossible de charger vos favoris.</p>';

        return;
    }

    if(!logements || logements.length === 0){

        favorisContainer.innerHTML = `

            <div class="empty-state">

                <i class="ph ph-heart-break"></i>

                <h2>Vous n'avez encore aucun logement favori.</h2>

                <p>Parcourez les annonces et cliquez sur le cœur pour les enregistrer ici.</p>

                <a href="../rechercher/rechercher.html" class="btn-primary">
                    Découvrir des logements
                </a>

            </div>

        `;

        return;
    }

    favorisContainer.innerHTML =
    logements.map(logement => {

        const image =
        logement.image_url || "../../images/logement1.jpg";

        const prix =
        Number(logement.prix).toLocaleString("fr-FR");

        return `
        <div class="similar-card">

            <img
            src="${image}"
            alt="${logement.titre}">

            <div class="similar-content">

                <h3>${logement.titre}</h3>

                <p>📍 ${logement.ville || ""} — ${prix} FCFA/mois</p>

                <button class="favorite active" data-id="${logement.id}">
                    ❤️ Retirer des favoris
                </button>

                <a href="../details-logement/details-logement.html">
                    Voir les détails
                </a>

            </div>

        </div>
        `;

    }).join("");

    // Retirer un favori depuis cette page recharge simplement
    // la liste, pour ne pas laisser une carte "fantôme" active.
    favorisContainer.querySelectorAll(".favorite").forEach(btn => {

        btn.addEventListener("click", async () => {

            await toggleFavorite(btn);

            chargerFavoris();

        });

    });

}
