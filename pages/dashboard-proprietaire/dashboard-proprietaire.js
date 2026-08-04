/* ==========================================================
   DASHBOARD-PROPRIETAIRE.JS — page tableau de bord uniquement
   Page protégée : redirige vers la connexion si aucune session
   active. Affiche et supprime les logements du propriétaire
   connecté via l'API.
   ========================================================== */

(async () => {

    try{

        await apiFetch("/auth/me");

    }catch(error){

        window.location.href =
        "../connexion/connexion.html";

        return;
    }

    chargerAnnonces();
    chargerReservations();

})();

/* ==========================
    DÉCONNEXION
========================== */

const logoutLink =
document.getElementById("logoutLink");

if(logoutLink){

    logoutLink.addEventListener("click", async (e) => {

        e.preventDefault();

        await apiFetch("/auth/logout", { method:"POST" });

        window.location.href =
        "../../index.html";

    });

}

/* ==========================
    LIENS SIDEBAR À VENIR
========================== */

document.querySelectorAll(".sidebar-soon").forEach(link => {

    link.addEventListener("click", (e) => {

        e.preventDefault();

        showToast("Fonctionnalité bientôt disponible.");

    });

});

/* ==========================
    MES ANNONCES
========================== */

const container =
document.getElementById("annonces-container");

async function chargerAnnonces(){

    if(!container) return;

    let logements = [];

    try{

        logements = await apiFetch("/logements/mine");

    }catch(error){

        showToast("Impossible de charger vos annonces.");

        return;
    }

    if(!logements || logements.length === 0){

        container.innerHTML = `
        <div class="empty-state">

            <i class="ph ph-house-simple"></i>

            <p>Vous n'avez encore publié aucune annonce.</p>

            <a href="../publier-logement/publier-logement.html" class="btn-primary">
                + Publier mon premier logement
            </a>

        </div>
        `;

        return;
    }

    container.innerHTML =
    logements.map(logement => `
        <div class="property-card">

            ${
                logement.image_url
                ?
                `<img
                    src="${logement.image_url}"
                    class="property-image">`
                :
                ""
            }

            <div class="property-content">

                <h3>${logement.titre}</h3>

                <p>📍 ${logement.ville || ""}</p>

                <p>💰 ${logement.prix} FCFA</p>

                <p>🛏 ${logement.chambres || 0} chambre(s)</p>

                <p>${logement.description || ""}</p>

                <button data-id="${logement.id}" class="btn-supprimer">
                🗑 Supprimer
                </button>

            </div>

        </div>
    `).join("");

    container.querySelectorAll(".btn-supprimer").forEach(btn => {

        btn.addEventListener("click", () => {

            supprimerLogement(btn.dataset.id);

        });

    });

}

async function supprimerLogement(id){

    try{

        await apiFetch("/logements/" + id, { method:"DELETE" });

        chargerAnnonces();

    }catch(error){

        showToast("Suppression impossible.");

    }

}

/* ==========================
    RÉSERVATIONS REÇUES
========================== */

const reservationsContainer =
document.getElementById("reservations-container");

async function chargerReservations(){

    if(!reservationsContainer) return;

    let reservations = [];

    try{

        reservations = await apiFetch("/reservations/owner");

    }catch(error){

        showToast("Impossible de charger vos réservations.");

        return;
    }

    if(!reservations || reservations.length === 0){

        reservationsContainer.innerHTML = `
        <div class="empty-state">

            <i class="ph ph-calendar-check"></i>

            <p>Vous n'avez encore reçu aucune demande de réservation.</p>

        </div>
        `;

        return;
    }

    const libellesStatut = {
        en_attente: "En attente",
        confirmee: "Confirmée",
        annulee: "Annulée"
    };

    reservationsContainer.innerHTML =
    reservations.map(reservation => `
        <div class="reservation-card">

            <div>

                <h3>${reservation.titre}</h3>

                <p>📍 ${reservation.ville || ""} — demandé par ${reservation.locataire_nom}</p>

                ${
                    reservation.message
                    ? `<p>💬 ${reservation.message}</p>`
                    : ""
                }

            </div>

            <span class="reservation-statut">
                ${libellesStatut[reservation.statut] || reservation.statut}
            </span>

        </div>
    `).join("");

}
