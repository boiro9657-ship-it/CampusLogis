/* ==========================================================
   PUBLICITE.JS — page publicité/sponsoring uniquement
   Sélection d'une annonce, d'une offre, d'un objectif et d'une
   durée, puis paiement via le même circuit PayDunya que les
   abonnements Premium/Pro (voir paiements.php côté serveur).
   ========================================================== */

let offreSelectionnee = null;
let offresChargees = [];
let mesAnnonces = [];

(async () => {

    try{

        await apiFetch("/auth/me");

    }catch(error){

        window.location.href =
        "../connexion/connexion.html";

        return;
    }

    await Promise.all([
        chargerOffres(),
        chargerMesAnnonces(),
    ]);

    chargerMesCampagnes();

    gererRetourPaiement();

    document.getElementById("pubObjectif")?.addEventListener("change", mettreAJourBudget);
    document.getElementById("pubDuree")?.addEventListener("change", mettreAJourBudget);

    document.getElementById("pubLancerBtn")?.addEventListener("click", lancerCampagne);

})();

/* ==========================
    OFFRES
========================== */

async function chargerOffres(){

    try{

        offresChargees = await apiFetch("/campagnes/offres");

    }catch(error){

        showToast("Impossible de charger les offres publicitaires.", "error");

        return;
    }

    const grid =
    document.getElementById("pubOffresGrid");

    grid.innerHTML =
    offresChargees.map(offreCarteHTML).join("");

    grid.querySelectorAll(".pub-offre-card").forEach(carte => {

        carte.addEventListener("click", () => {

            grid.querySelectorAll(".pub-offre-card").forEach(c => c.classList.remove("selected"));
            carte.classList.add("selected");

            offreSelectionnee = carte.dataset.offre;

            mettreAJourBudget();

        });

    });

    // Présélectionne l'offre du milieu (meilleur rapport
    // visibilité/prix) pour ne pas laisser l'écran vide.
    if(offresChargees[1]){
        grid.children[1]?.click();
    }

}

function offreCarteHTML(offre){

    return `
    <div class="pub-offre-card" data-offre="${offre.id}" data-prix="${offre.prix_jour}">

        <h3>${offre.nom}</h3>

        <p>${offre.description}</p>

        <div class="pub-offre-prix">
            ${Number(offre.prix_jour).toLocaleString("fr-FR")} FCFA
            <span>/ jour</span>
        </div>

        <ul class="pub-offre-emplacements">
            ${offre.emplacements.map(e => `<li><i class="ph ph-check-circle"></i> ${libelleEmplacement(e)}</li>`).join("")}
        </ul>

    </div>
    `;

}

function libelleEmplacement(emplacement){

    return {
        accueil: "Page d'accueil",
        recherche: "Résultats de recherche",
        categories: "Pages catégories",
    }[emplacement] || emplacement;

}

function mettreAJourBudget(){

    if(!offreSelectionnee) return;

    const offre =
    offresChargees.find(o => o.id === offreSelectionnee);

    if(!offre) return;

    const duree =
    Number(document.getElementById("pubDuree").value);

    const total =
    offre.prix_jour * duree;

    document.getElementById("pubBudgetTotal").textContent =
    total.toLocaleString("fr-FR") + " FCFA";

}

/* ==========================
    MES ANNONCES (SÉLECTION)
========================== */

async function chargerMesAnnonces(){

    try{

        mesAnnonces = await apiFetch("/logements/mine");

    }catch(error){

        mesAnnonces = [];
    }

    mesAnnonces =
    mesAnnonces.filter(l => l.statut_validation === "approuve");

    const select =
    document.getElementById("pubLogement");

    const aucuneMsg =
    document.getElementById("pubAucuneAnnonce");

    if(mesAnnonces.length === 0){

        select.innerHTML = `<option value="">Aucune annonce disponible</option>`;
        select.disabled = true;

        if(aucuneMsg) aucuneMsg.style.display = "";

        return;
    }

    select.disabled = false;

    select.innerHTML =
    mesAnnonces.map(l => `<option value="${l.id}">${l.titre} — ${l.ville || ""}</option>`).join("");

}

/* ==========================
    LANCEMENT DE LA CAMPAGNE
========================== */

async function lancerCampagne(){

    const logementId =
    document.getElementById("pubLogement").value;

    if(!logementId){

        showToast("Choisissez une annonce à promouvoir.", "error");

        return;
    }

    if(!offreSelectionnee){

        showToast("Choisissez une offre.", "error");

        return;
    }

    const objectif =
    document.getElementById("pubObjectif").value;

    const dureeJours =
    Number(document.getElementById("pubDuree").value);

    const zoneCiblee =
    document.getElementById("pubZone").value.trim();

    const btn =
    document.getElementById("pubLancerBtn");

    btn.disabled = true;
    btn.innerHTML = `<i class="ph ph-spinner-gap"></i> Création de la campagne...`;

    try{

        const campagne =
        await apiFetch("/campagnes", {

            method: "POST",

            body: JSON.stringify({
                logement_id: Number(logementId),
                offre: offreSelectionnee,
                objectif,
                duree_jours: dureeJours,
                zone_ciblee: zoneCiblee,
            })

        });

        btn.innerHTML = `<i class="ph ph-spinner-gap"></i> Redirection vers le paiement...`;

        const paiement =
        await apiFetch("/paiements/creer", {

            method: "POST",

            body: JSON.stringify({
                type: "campagne",
                campagne_id: campagne.id,
                origine: "publicite",
            })

        });

        window.location.href =
        paiement.invoice_url;

    }catch(error){

        showToast(error.message, "error");

        btn.disabled = false;
        btn.innerHTML = `<i class="ph ph-rocket-launch"></i> Lancer ma campagne`;

    }

}

/* ==========================
    RETOUR DE PAIEMENT
========================== */

function gererRetourPaiement(){

    const params =
    new URLSearchParams(window.location.search);

    const paiement =
    params.get("paiement");

    if(!paiement) return;

    const messages = {
        succes: { texte: "Votre campagne est maintenant active. Merci !", type: "success" },
        echec: { texte: "Le paiement a échoué. Vous pouvez réessayer.", type: "error" },
        annule: { texte: "Paiement annulé.", type: "error" },
        en_attente: { texte: "Paiement en attente de confirmation.", type: "error" },
    };

    const message =
    messages[paiement];

    if(message) showToast(message.texte, message.type === "error" ? "error" : undefined);

    // Nettoie l'URL pour ne pas réafficher le message si la page est
    // rechargée ou partagée.
    window.history.replaceState({}, "", window.location.pathname);

    chargerMesCampagnes();

}

/* ==========================
    MES CAMPAGNES
========================== */

const LIBELLES_STATUT_CAMPAGNE = {
    en_attente_paiement: { texte: "En attente de paiement", classe: "campagne-statut-attente" },
    active: { texte: "Active", classe: "campagne-statut-active" },
    en_pause: { texte: "En pause", classe: "campagne-statut-pause" },
    terminee: { texte: "Terminée", classe: "campagne-statut-terminee" },
    rejetee: { texte: "Rejetée", classe: "campagne-statut-rejetee" },
};

const LIBELLES_OFFRE = {
    mise_en_avant: "Mise en avant",
    sponsorisee: "Annonce sponsorisée",
    pack_premium: "Pack Premium",
};

async function chargerMesCampagnes(){

    const container =
    document.getElementById("pubCampagnesContainer");

    if(!container) return;

    let campagnes;

    try{

        campagnes = await apiFetch("/campagnes/mine");

    }catch(error){

        container.innerHTML = '<p class="form-hint">Impossible de charger vos campagnes.</p>';

        return;
    }

    if(!campagnes || campagnes.length === 0){

        container.innerHTML = '<p class="form-hint">Vous n\'avez pas encore lancé de campagne.</p>';

        return;
    }

    container.innerHTML =
    campagnes.map(campagneCarteHTML).join("");

}

function campagneCarteHTML(c){

    const statut =
    LIBELLES_STATUT_CAMPAGNE[c.statut] || { texte: c.statut, classe: "" };

    return `
    <div class="campagne-card">

        <img src="${c.logement_image || '../../images/logement1.jpg'}" alt="${c.logement_titre}">

        <div class="campagne-card-body">

            <div class="campagne-card-top">
                <h3>${c.logement_titre}</h3>
                <span class="campagne-statut ${statut.classe}">${statut.texte}</span>
            </div>

            <p class="campagne-offre">${LIBELLES_OFFRE[c.offre] || c.offre} · ${c.duree_jours} jours</p>

            <div class="campagne-stats">

                <div>
                    <strong>${Number(c.impressions).toLocaleString("fr-FR")}</strong>
                    <span>Impressions</span>
                </div>

                <div>
                    <strong>${Number(c.clics).toLocaleString("fr-FR")}</strong>
                    <span>Clics</span>
                </div>

                <div>
                    <strong>${Number(c.clics_whatsapp).toLocaleString("fr-FR")}</strong>
                    <span>Contacts WhatsApp</span>
                </div>

                <div>
                    <strong>${Number(c.budget_depense).toLocaleString("fr-FR")} F</strong>
                    <span>Dépensé / ${Number(c.budget).toLocaleString("fr-FR")} F</span>
                </div>

            </div>

        </div>

    </div>
    `;

}
