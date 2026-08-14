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
    logements.map(carteFavoriHTML).join("");

    attacherBoutonsReservation(favorisContainer);
    demarrerCarrousels(favorisContainer);

    // Retirer un favori depuis cette page recharge simplement
    // la liste, pour ne pas laisser une carte "fantôme" active.
    favorisContainer.querySelectorAll(".favorite").forEach(btn => {

        btn.addEventListener("click", async () => {

            await toggleFavorite(btn);

            chargerFavoris();

        });

    });

}

// Même gabarit de carte que l'accueil/la recherche (carrousel,
// chips de caractéristiques, badge durée, boutons Visite/Détails),
// pour que "Favoris" ne soit pas une version appauvrie des autres
// pages — seul le cœur change (toujours actif, retire le favori).
function carteFavoriHTML(logement){

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

            <span class="badge-card ${estReserve ? "badge-card-reserve" : ""}">${estReserve ? "Déjà réservé" : "Disponible"}</span>

            ${estPro ? `<span class="badge-pro"><i class="ph ph-medal"></i> Pro</span>` : estPremium ? `<span class="badge-premium"><i class="ph ph-crown-simple"></i> Premium</span>` : ""}

            <button class="favorite active" data-id="${logement.id}" title="Retirer des favoris">❤</button>

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
            </div>

            <span class="badge-verifie"><i class="ph ph-shield-check"></i> Propriétaire vérifié</span>

            <div class="bottom-card">

                <button class="btn-reserver ${estReserve ? "btn-reserver-reserve" : ""}" data-id="${logement.id}" data-statut="${logement.statut || "disponible"}">
                    <i class="ph ph-calendar-check"></i> ${estReserve ? "Déjà réservé" : "Demander une visite"}
                </button>

                <a href="../details-logement/details-logement.html?id=${logement.id}" class="btn-details">
                    Voir les détails <i class="ph ph-arrow-right"></i>
                </a>

            </div>

        </div>

    </div>
    `;

}
