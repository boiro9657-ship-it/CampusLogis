/* ==========================================================
   DASHBOARD-PROPRIETAIRE.JS — tableau de bord propriétaire ET
   locataire (page partagée). Le contenu s'adapte au rôle réel
   du compte connecté : un propriétaire voit ses annonces et les
   réservations reçues ; un locataire voit ses propres
   réservations et une invitation à publier s'il n'a encore
   aucune annonce. Un locataire qui a quand même publié une
   annonce (rien ne l'en empêche) voit "Mes annonces" apparaître
   comme un propriétaire.
   ========================================================== */

let utilisateurConnecte = null;

(async () => {

    try{

        utilisateurConnecte = await apiFetch("/auth/me");

    }catch(error){

        window.location.href =
        "../connexion/connexion.html";

        return;
    }

    initDashboard();

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
    ORCHESTRATION DU TABLEAU DE BORD
========================== */

async function initDashboard(){

    const estProprietaire =
    utilisateurConnecte.role === "proprietaire";

    const premierPrenom =
    (utilisateurConnecte.nom_complet || "").split(" ")[0];

    document.getElementById("dashboardGreeting").textContent =
    `Bonjour ${premierPrenom} 👋`;

    document.getElementById("dashboardSubtitle").textContent =
    estProprietaire
    ? "Gérez facilement vos logements."
    : "Suivez vos réservations et vos favoris.";

    let logements = [];

    try{

        logements = await apiFetch("/logements/mine");

    }catch(error){

        showToast("Impossible de charger vos annonces.", "error");

    }

    const aDesAnnonces =
    logements.length > 0;

    const sectionAnnonces =
    document.getElementById("mes-annonces");

    const ctaPublier =
    document.getElementById("cta-publier");

    if(aDesAnnonces || estProprietaire){

        sectionAnnonces.style.display = "";
        ctaPublier.style.display = "none";
        afficherAnnonces(logements);

    }else{

        sectionAnnonces.style.display = "none";
        ctaPublier.style.display = "";

    }

    const titreReservations =
    document.getElementById("reservationsSectionTitle");

    let reservations = [];

    if(estProprietaire){

        titreReservations.textContent = "Réservations reçues";

        try{
            reservations = await apiFetch("/reservations/owner");
        }catch(error){
            showToast("Impossible de charger vos réservations.", "error");
        }

        afficherReservations(reservations, "owner");

    }else{

        titreReservations.textContent = "Mes réservations";

        try{
            reservations = await apiFetch("/reservations/mine");
        }catch(error){
            showToast("Impossible de charger vos réservations.", "error");
        }

        afficherReservations(reservations, "locataire");

    }

    const nbEnAttente =
    logements.filter(l => l.statut_validation === "en_attente").length;

    document.getElementById("statPrincipal").textContent =
    logements.length;

    document.getElementById("statSecondaire").textContent =
    reservations.length;

    document.getElementById("statSecondaireLabel").textContent =
    estProprietaire ? "Réservations reçues" : "Réservations effectuées";

    document.getElementById("statTertiaire").textContent =
    nbEnAttente;

    afficherTableRecente(logements, reservations, aDesAnnonces || estProprietaire);

}

/* ==========================
    MES ANNONCES
========================== */

const container =
document.getElementById("annonces-container");

const libellesValidation = {
    en_attente: { texte: "⏳ En attente de validation", classe: "validation-badge-attente" },
    approuve: { texte: "✅ Approuvée", classe: "validation-badge-approuve" },
    rejete: { texte: "❌ Rejetée", classe: "validation-badge-rejete" }
};

function afficherAnnonces(logements){

    if(!container) return;

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
    logements.map(logement => {

        const nbPhotos = Number(logement.nb_photos || 0);
        const nbVideos = Number(logement.nb_videos || 0);
        const validation = libellesValidation[logement.statut_validation] || libellesValidation.en_attente;

        return `
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

                <span class="validation-badge ${validation.classe}">${validation.texte}</span>

                <h3>${logement.titre}</h3>

                <p>📍 ${logement.ville || ""}</p>

                <p>💰 ${logement.prix} FCFA</p>

                <p>🛏 ${logement.chambres || 0} chambre(s)</p>

                <div class="media-badges">
                    <span class="media-badge">📷 ${nbPhotos} photo${nbPhotos > 1 ? "s" : ""}</span>
                    ${
                        nbVideos > 0
                        ? `<span class="media-badge media-badge-video">🎥 ${nbVideos} vidéo${nbVideos > 1 ? "s" : ""}</span>`
                        : ""
                    }
                </div>

                <p>${logement.description || ""}</p>

                <a href="../details-logement/details-logement.html?id=${logement.id}" class="btn-voir">
                👁 Voir l'annonce
                </a>

                <button data-id="${logement.id}" class="btn-supprimer">
                🗑 Supprimer
                </button>

            </div>

        </div>
        `;

    }).join("");

    container.querySelectorAll(".btn-supprimer").forEach(btn => {

        btn.addEventListener("click", () => {

            supprimerLogement(btn.dataset.id);

        });

    });

}

async function supprimerLogement(id){

    try{

        await apiFetch("/logements/" + id, { method:"DELETE" });

        initDashboard();

    }catch(error){

        showToast("Suppression impossible.", "error");

    }

}

/* ==========================
    RÉSERVATIONS
    (reçues pour un propriétaire, effectuées pour un locataire)
========================== */

const reservationsContainer =
document.getElementById("reservations-container");

function afficherReservations(reservations, mode){

    if(!reservationsContainer) return;

    if(!reservations || reservations.length === 0){

        reservationsContainer.innerHTML =
        mode === "owner"
        ? `
        <div class="empty-state">
            <i class="ph ph-calendar-check"></i>
            <p>Vous n'avez encore reçu aucune demande de réservation.</p>
        </div>
        `
        : `
        <div class="empty-state">
            <i class="ph ph-calendar-check"></i>
            <p>Vous n'avez encore fait aucune réservation.</p>
            <a href="../rechercher/rechercher.html" class="btn-primary">Rechercher un logement</a>
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

                <p>📍 ${reservation.ville || ""}${mode === "owner" ? ` — demandé par ${reservation.locataire_nom}` : ""}</p>

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

/* ==========================
    TABLEAU RÉCAPITULATIF
    (annonces récentes si l'utilisateur en a, sinon réservations
    récentes pour un locataire sans annonce)
========================== */

function afficherTableRecente(logements, reservations, afficherAnnoncesRecentes){

    const table =
    document.getElementById("tableRecent");

    const titre =
    document.getElementById("recentSectionTitle");

    if(!table || !titre) return;

    if(afficherAnnoncesRecentes){

        titre.textContent = "Mes annonces récentes";

        const recents =
        logements.slice(0, 5);

        if(recents.length === 0){
            table.innerHTML = `<tr><td colspan="4" class="table-vide">Aucune annonce publiée pour le moment.</td></tr>`;
            return;
        }

        table.innerHTML = `
            <tr>
                <th>Logement</th>
                <th>Ville</th>
                <th>Prix</th>
                <th>Statut</th>
            </tr>
        ` + recents.map(l => `
            <tr>
                <td>${l.titre}</td>
                <td>${l.ville || ""}</td>
                <td>${Number(l.prix).toLocaleString("fr-FR")} F</td>
                <td><span class="status-badge ${l.statut === "disponible" ? "status-available" : "status-booked"}">${l.statut}</span></td>
            </tr>
        `).join("");

    }else{

        titre.textContent = "Mes réservations récentes";

        const recents =
        reservations.slice(0, 5);

        if(recents.length === 0){
            table.innerHTML = `<tr><td colspan="3" class="table-vide">Aucune réservation pour le moment.</td></tr>`;
            return;
        }

        const libellesStatut = {
            en_attente: "En attente",
            confirmee: "Confirmée",
            annulee: "Annulée"
        };

        table.innerHTML = `
            <tr>
                <th>Logement</th>
                <th>Ville</th>
                <th>Statut</th>
            </tr>
        ` + recents.map(r => `
            <tr>
                <td>${r.titre}</td>
                <td>${r.ville || ""}</td>
                <td><span class="status-badge status-available">${libellesStatut[r.statut] || r.statut}</span></td>
            </tr>
        `).join("");

    }

}
