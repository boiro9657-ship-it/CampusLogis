/* ==========================================================
   DETAILS-LOGEMENT.JS — page détails logement uniquement
   Si un ?id=... est présent dans l'URL, charge le vrai logement
   depuis l'API et branche "Contacter le propriétaire" sur une
   vraie demande de réservation. Sans id (accès direct à la
   page), le contenu de démonstration reste affiché tel quel.
   ========================================================== */

const params =
new URLSearchParams(window.location.search);

const logementId =
params.get("id");

if(logementId){

    chargerLogement(logementId);

}

async function chargerLogement(id){

    let logement;

    try{

        logement = await apiFetch("/logements/" + id);

    }catch(error){

        showToast("Logement introuvable.");

        return;
    }

    const prix =
    Number(logement.prix).toLocaleString("fr-FR");

    document.querySelector("#details-hero h1").textContent =
    logement.titre;

    document.querySelector(".property-info h2").textContent =
    logement.titre;

    document.querySelector(".property-info .location").innerHTML =
    `<i class="ph ph-map-pin"></i> ${logement.ville || ""}`;

    document.querySelector(".property-info .description").textContent =
    logement.description || "";

    document.querySelector(".price-card h3").textContent =
    prix + " FCFA";

    const chambresEl =
    document.querySelector(".property-features span");

    if(chambresEl){

        chambresEl.innerHTML =
        `<i class="ph ph-bed"></i> ${logement.chambres || 0} Chambre(s)`;

    }

    if(logement.image_url){

        document.querySelector(".gallery-main img").src =
        logement.image_url;

    }

    const contactBtn =
    document.getElementById("contactOwnerBtn");

    if(contactBtn){

        contactBtn.textContent =
        "Réserver ce logement";

        contactBtn.addEventListener("click", (e) => {

            e.preventDefault();

            reserverLogement(id);

        });

    }

}

/* ==========================
    ACTIONS PAS ENCORE DISPONIBLES
    (appel, WhatsApp, message direct, logements similaires —
    pas de numéro/messagerie propriétaire dans cette version)
========================== */

const selecteurActionsEnAttente =
logementId
? ".btn-call, .btn-whatsapp, .btn-message, .similar-content a"
: ".reserve-btn, .btn-call, .btn-whatsapp, .btn-message, .similar-content a";

document.querySelectorAll(selecteurActionsEnAttente).forEach(el => {

    el.addEventListener("click", (e) => {

        e.preventDefault();

        showToast("Fonctionnalité bientôt disponible.");

    });

});
