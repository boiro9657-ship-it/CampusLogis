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

    // Un locataire qui a publié une annonce (rien ne l'en empêche)
    // doit pouvoir accepter/refuser les réservations reçues sur
    // cette annonce comme un vrai propriétaire — le rôle du compte
    // seul ne suffit pas à décider, sinon ces réservations
    // n'affichaient jamais les boutons Accepter/Refuser pour lui.
    const modeProprietaire =
    aDesAnnonces || estProprietaire;

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

    if(modeProprietaire){

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
    modeProprietaire ? "Réservations reçues" : "Réservations effectuées";

    document.getElementById("statTertiaire").textContent =
    nbEnAttente;

    afficherTableRecente(logements, reservations, modeProprietaire);

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
    reservations.map(reservation => {

        // La discussion se fait avec la personne, pas avec "cette
        // réservation précise" : sinon, réserver plusieurs fois
        // éclaterait la conversation en plusieurs fils séparés.
        const autreUserId =
        mode === "owner" ? reservation.locataire_id : reservation.owner_id;

        return `
        <div class="reservation-card">

            <div>

                <h3>${reservation.titre}</h3>

                <p>📍 ${reservation.ville || ""}${mode === "owner" ? ` — demandé par ${reservation.locataire_nom}` : ""}</p>

                ${
                    reservation.message
                    ? `<p>💬 ${reservation.message}</p>`
                    : ""
                }

                <div class="reservation-actions">

                    ${
                        mode === "owner" && reservation.statut === "en_attente"
                        ? `
                        <button class="btn-accepter-reservation" data-id="${reservation.id}">Accepter</button>
                        <button class="btn-refuser-reservation" data-id="${reservation.id}">Refuser</button>
                        `
                        : ""
                    }

                    <button class="btn-discuter" data-id="${autreUserId}">
                        <i class="ph ph-chat-circle-dots"></i> Discuter
                    </button>

                </div>

            </div>

            <span class="reservation-statut reservation-statut-${reservation.statut}">
                ${libellesStatut[reservation.statut] || reservation.statut}
            </span>

        </div>
        `;

    }).join("");

    if(mode === "owner"){

        reservationsContainer.querySelectorAll(".btn-accepter-reservation").forEach(btn => {

            btn.addEventListener("click", () => modifierStatutReservation(btn.dataset.id, "confirmee"));

        });

        reservationsContainer.querySelectorAll(".btn-refuser-reservation").forEach(btn => {

            btn.addEventListener("click", () => modifierStatutReservation(btn.dataset.id, "annulee"));

        });

    }

    reservationsContainer.querySelectorAll(".btn-discuter").forEach(btn => {

        btn.addEventListener("click", () => ouvrirChat(btn.dataset.id));

    });

}

async function modifierStatutReservation(id, statut){

    try{

        await apiFetch("/reservations/" + id, {

            method: "PUT",

            body: JSON.stringify({ statut })

        });

        showToast(statut === "confirmee" ? "Réservation acceptée." : "Réservation refusée.");

        initDashboard();

    }catch(error){

        showToast(error.message, "error");

    }

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

/* ==========================
    ESPACE DE DISCUSSION
    Une conversation par binôme d'utilisateurs (pas par réservation
    individuelle) : tous les messages entre un propriétaire et un
    locataire restent dans un seul fil, même s'il y a eu plusieurs
    réservations entre eux. Basé sur des requêtes répétées (pas de
    websocket disponible sur cet hébergement) : tant que la fenêtre
    est ouverte, on revérifie les nouveaux messages toutes les 4
    secondes. L'appel se fait via un vrai lien tel:/wa.me vers le
    numéro du correspondant — pas d'appel vocal directement dans le
    navigateur (non fiable sur cet hébergement partagé, on ne simule
    pas une fonctionnalité qui ne marcherait pas réellement).
========================== */

let chatAutreUserId = null;
let chatIntervalle = null;

const chatOverlay =
document.getElementById("chatModalOverlay");

async function ouvrirChat(autreUserId){

    chatAutreUserId = autreUserId;

    chatOverlay.classList.add("show");

    await rafraichirChat();

    apiFetch("/messagerie/" + autreUserId + "/lu", { method: "PUT" }).catch(()=>{});

    if(chatIntervalle) clearInterval(chatIntervalle);

    chatIntervalle = setInterval(rafraichirChat, 4000);

}

function fermerChat(){

    chatOverlay.classList.remove("show");

    chatAutreUserId = null;

    if(chatIntervalle){

        clearInterval(chatIntervalle);
        chatIntervalle = null;

    }

}

document.getElementById("chatCloseBtn").addEventListener("click", fermerChat);

chatOverlay.addEventListener("click", (e) => {

    if(e.target === chatOverlay) fermerChat();

});

async function rafraichirChat(){

    if(!chatAutreUserId) return;

    let donnees;

    try{

        donnees = await apiFetch("/messagerie/" + chatAutreUserId);

    }catch(error){

        return;
    }

    afficherParticipantChat(donnees.participant);
    afficherMessagesChat(donnees.messages);

}

function afficherParticipantChat(participant){

    const nomEl =
    document.getElementById("chatParticipantNom");

    const statutEl =
    document.getElementById("chatParticipantStatut");

    const avatarEl =
    document.getElementById("chatAvatar");

    const callBtn =
    document.getElementById("chatCallBtn");

    const whatsappBtn =
    document.getElementById("chatWhatsappBtn");

    if(!participant){

        if(nomEl) nomEl.textContent = "Discussion";
        if(statutEl) statutEl.textContent = "";

        return;
    }

    if(nomEl) nomEl.textContent = participant.nom_complet;

    if(statutEl){

        statutEl.innerHTML =
        participant.en_ligne
        ? `<span class="chat-dot chat-dot-en-ligne"></span> En ligne`
        : `<span class="chat-dot"></span> Hors ligne`;

    }

    if(avatarEl){

        avatarEl.innerHTML =
        participant.photo_url
        ? `<img src="${participant.photo_url}" alt="${participant.nom_complet}">`
        : `<i class="ph ph-user"></i>`;

    }

    const numero =
    participant.telephone ? formaterNumeroInternationalChat(participant.telephone) : null;

    if(callBtn){

        if(numero){
            callBtn.href = "tel:+" + numero;
            callBtn.classList.remove("chat-icon-btn-desactive");
        }else{
            callBtn.href = "#";
            callBtn.classList.add("chat-icon-btn-desactive");
        }

    }

    if(whatsappBtn){

        if(numero){
            whatsappBtn.href = "https://wa.me/" + numero;
            whatsappBtn.classList.remove("chat-icon-btn-desactive");
        }else{
            whatsappBtn.href = "#";
            whatsappBtn.classList.add("chat-icon-btn-desactive");
        }

    }

}

let dernierAffichageMessagesChat = "";

function afficherMessagesChat(messages){

    const container =
    document.getElementById("chatMessages");

    if(!container) return;

    // Évite de reconstruire/re-scroller le fil à chaque poll si
    // rien n'a changé depuis la dernière vérification.
    const signature =
    JSON.stringify(messages.map(m => m.id));

    if(signature === dernierAffichageMessagesChat) return;

    dernierAffichageMessagesChat = signature;

    if(messages.length === 0){

        container.innerHTML =
        `<p class="chat-vide">Aucun message pour l'instant. Lancez la discussion !</p>`;

        return;
    }

    container.innerHTML =
    messages.map(m => `
        <div class="chat-bulle ${m.est_moi ? "chat-bulle-moi" : "chat-bulle-autre"}">
            <p>${m.message}</p>
            <span>${new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
    `).join("");

    container.scrollTop = container.scrollHeight;

}

const chatForm =
document.getElementById("chatForm");

if(chatForm){

    chatForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const input =
        document.getElementById("chatInput");

        const message =
        input.value.trim();

        if(!message || !chatAutreUserId) return;

        input.value = "";

        try{

            await apiFetch("/messagerie/" + chatAutreUserId, {

                method: "POST",

                body: JSON.stringify({ message })

            });

            dernierAffichageMessagesChat = "";

            await rafraichirChat();

        }catch(error){

            showToast(error.message, "error");

        }

    });

}

function formaterNumeroInternationalChat(telephone){

    let chiffres =
    telephone.replace(/\D/g, "");

    if(chiffres.startsWith("00")){
        chiffres = chiffres.slice(2);
    }

    if(chiffres.startsWith("221")){
        return chiffres;
    }

    if(chiffres.startsWith("0")){
        chiffres = chiffres.slice(1);
    }

    return "221" + chiffres;

}
