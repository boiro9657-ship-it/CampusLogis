/* ==========================================================
   DETAILS-LOGEMENT.JS — page détails logement uniquement
   Si un ?id=... est présent dans l'URL, charge le vrai logement
   depuis l'API et branche "Contacter le propriétaire" sur une
   vraie demande de réservation. Sans id (accès direct à la
   page), le contenu de démonstration reste affiché tel quel.
   ========================================================== */

// Pour "3_mois", "6_mois" et "1_an", le prix reste un loyer MENSUEL
// (voir le formulaire de publication : "3 mois (minimum)", "6 mois
// (minimum)") — seul l'engagement de location est plus long, pas la
// fréquence de paiement. La durée d'engagement est affichée à part,
// voir LIBELLES_ENGAGEMENT plus bas.
const LIBELLES_DUREE = {
    "24h": "pour 24 heures",
    nuit: "par nuitée",
    journee: "par jour",
    semaine: "par semaine",
    "1_mois": "par mois",
    "3_mois": "par mois",
    "6_mois": "par mois",
    "1_an": "par mois"
};

const LIBELLES_ENGAGEMENT = {
    "3_mois": "Engagement 3 mois",
    "6_mois": "Engagement 6 mois",
    "1_an": "Engagement 1 an"
};

/* ==========================
    BOUTON "CONTACTER LE PROPRIÉTAIRE" EN HAUT
    Descend directement vers les vraies coordonnées de contact
    (appel, WhatsApp, message) tout en bas de la page, au lieu de
    forcer le locataire à faire défiler pour les trouver.
========================== */

document.getElementById("contactTopBtn")?.addEventListener("click", (e) => {

    e.preventDefault();

    document.getElementById("owner-section")?.scrollIntoView({ behavior: "smooth", block: "start" });

});

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

        showToast("Logement introuvable.", "error");

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

    const descriptionCompleteEl =
    document.getElementById("descriptionComplete");

    if(descriptionCompleteEl){

        descriptionCompleteEl.textContent =
        logement.description || "Aucune description fournie par le propriétaire.";

    }

    document.querySelector(".price-card h3").textContent =
    prix + " FCFA";

    const periodeEl =
    document.querySelector(".price-card p");

    if(periodeEl){

        const engagement =
        logement.duree_location === "autre"
        ? (logement.duree_location_autre ? "Engagement " + logement.duree_location_autre : null)
        : LIBELLES_ENGAGEMENT[logement.duree_location];

        periodeEl.textContent =
        (LIBELLES_DUREE[logement.duree_location] || "par mois") +
        (engagement ? " · " + engagement : "");

    }

    afficherCaution(logement.caution);

    afficherLocalisation(logement.ville);

    afficherCaracteristiques(logement);

    afficherGalerie(logement.medias || []);

    afficherEquipements(logement);

    afficherProfilRecherche(logement);

    afficherAudio(logement.audio_url);

    const contactBtn =
    document.getElementById("contactOwnerBtn");

    const estReserve =
    logement.statut === "reserve";

    if(contactBtn){

        contactBtn.textContent =
        estReserve ? "Déjà réservé" : "Demander une visite";

        contactBtn.classList.toggle("reserve-btn-indisponible", estReserve);

        contactBtn.addEventListener("click", (e) => {

            e.preventDefault();

            if(estReserve){

                showToast("Ce logement est déjà réservé.", "error");

                return;
            }

            reserverLogement(id);

        });

    }

    const ownerNomEl =
    document.querySelector(".owner-info h2");

    if(ownerNomEl){

        ownerNomEl.textContent =
        logement.proprietaire_nom || "Propriétaire";

    }

    afficherInfosProprietaire(logement);

    brancherContactProprietaire(logement);

    chargerLogementsSimilaires(logement);

    chargerCommentaires(id);

}

/* ==========================
    COMMENTAIRES
========================== */

async function chargerCommentaires(logementId){

    const section =
    document.getElementById("comments-section");

    const carousel =
    document.getElementById("commentsCarousel");

    if(!section || !carousel) return;

    section.style.display = "";

    let commentaires;

    try{

        commentaires = await apiFetch("/logements/" + logementId + "/commentaires");

    }catch(error){

        return;
    }

    document.getElementById("commentsCount").textContent =
    commentaires.length > 0 ? commentaires.length : "";

    if(commentaires.length === 0){

        carousel.innerHTML =
        `<p class="comments-empty">Aucun commentaire pour l'instant. Soyez le premier à en laisser un !</p>`;

    }else{

        carousel.innerHTML =
        commentaires.map(commentaireHTML).join("");

    }

    brancherFormulaireCommentaire(logementId);

}

function commentaireHTML(commentaire){

    const date =
    new Date(commentaire.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const avatar =
    commentaire.auteur_photo
    ? `<img src="${commentaire.auteur_photo}" alt="${commentaire.auteur_nom}">`
    : `<i class="ph ph-user"></i>`;

    return `
    <div class="comment-card">

        <div class="comment-card-author">

            <div class="comment-avatar">${avatar}</div>

            <div>
                <h4>${commentaire.auteur_nom}</h4>
                <span>${date}</span>
            </div>

        </div>

        <p>${commentaire.message}</p>

    </div>
    `;

}

async function brancherFormulaireCommentaire(logementId){

    const form =
    document.getElementById("commentForm");

    const connexionRequise =
    document.getElementById("commentConnexionRequise");

    if(!form) return;

    let connecte = true;

    try{

        await apiFetch("/auth/me");

    }catch(error){

        connecte = false;

    }

    form.style.display = connecte ? "" : "none";

    if(connexionRequise){

        connexionRequise.style.display = connecte ? "none" : "";

    }

    if(!connecte || form.dataset.branche) return;

    form.dataset.branche = "1";

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const messageEl =
        document.getElementById("commentMessage");

        const message =
        messageEl.value.trim();

        if(!message){

            showToast("Le commentaire ne peut pas être vide.", "error");

            return;
        }

        const submitBtn =
        form.querySelector(".btn-primary");

        submitBtn.disabled = true;

        try{

            await apiFetch("/logements/" + logementId + "/commentaires", {

                method: "POST",

                body: JSON.stringify({ message })

            });

            messageEl.value = "";

            showToast("Commentaire publié.");

            chargerCommentaires(logementId);

        }catch(error){

            showToast(error.message, "error");

        }finally{

            submitBtn.disabled = false;

        }

    });

}

/**
 * Affiche les vraies informations du propriétaire (date
 * d'inscription réelle, nombre réel d'annonces approuvées) —
 * plus de note ni de "propriétaire vérifié" fictifs.
 */
function afficherInfosProprietaire(logement){

    const membreDepuisEl =
    document.getElementById("ownerMembreDepuis");

    if(membreDepuisEl && logement.proprietaire_membre_depuis){

        const annee =
        new Date(logement.proprietaire_membre_depuis).getFullYear();

        membreDepuisEl.textContent =
        `Membre depuis ${annee}`;

    }

    const nbAnnoncesEl =
    document.getElementById("ownerNbAnnonces");

    if(nbAnnoncesEl){

        const nb =
        Number(logement.proprietaire_nb_annonces || 0);

        nbAnnoncesEl.textContent =
        `${nb} annonce${nb > 1 ? "s" : ""} publiée${nb > 1 ? "s" : ""}`;

    }

    const avatarEl =
    document.querySelector(".owner-avatar-placeholder");

    if(avatarEl && logement.proprietaire_photo){

        avatarEl.innerHTML =
        `<img src="${logement.proprietaire_photo}" alt="${logement.proprietaire_nom || "Propriétaire"}">`;

    }

}

/**
 * Charge de vraies annonces similaires (même ville, hors
 * l'annonce actuelle) via l'API. Masque toute la section si
 * aucune autre annonce n'est disponible dans la même ville.
 */
async function chargerLogementsSimilaires(logement){

    const section =
    document.getElementById("similar-properties");

    const grid =
    document.getElementById("similarGrid");

    if(!section || !grid || !logement.ville) return;

    let logements;

    try{

        logements = await apiFetch("/logements?ville=" + encodeURIComponent(logement.ville));

    }catch(error){

        return;
    }

    const similaires =
    (logements || [])
    .filter(l => String(l.id) !== String(logement.id))
    .slice(0, 3);

    if(similaires.length === 0) return;

    grid.innerHTML =
    similaires.map(l => `
        <div class="similar-card">

            <img src="${l.image_url || ""}" loading="lazy" alt="${l.titre}">

            <div class="similar-content">

                <h3>${l.titre}</h3>

                <p>📍 ${l.ville || ""}</p>

                <h4>${Number(l.prix).toLocaleString("fr-FR")} FCFA${libelleCourtDuree(l.duree_location)}</h4>

                <a href="details-logement.html?id=${l.id}">Voir les détails</a>

            </div>

        </div>
    `).join("");

    section.style.display = "";

}

/**
 * Branche "Appeler", "WhatsApp" et "Envoyer un message" sur les
 * vraies coordonnées de contact de l'annonce (liens tel:, wa.me
 * et mailto:). Les coordonnées propres à l'annonce priment sur
 * celles du compte propriétaire ; sans numéro/email disponible,
 * affiche un message clair plutôt qu'un lien cassé.
 */
function brancherContactProprietaire(logement){

    const btnCall =
    document.querySelector(".btn-call");

    const btnWhatsapp =
    document.querySelector(".btn-whatsapp");

    const btnMessage =
    document.querySelector(".btn-message");

    const telephoneEffectif =
    logement.contact_telephone || logement.proprietaire_telephone;

    const whatsappEffectif =
    logement.contact_whatsapp || logement.contact_telephone || logement.proprietaire_telephone;

    brancherBoutonContact(btnCall, telephoneEffectif, (numero) => "tel:+" + numero, "Le propriétaire n'a pas renseigné de numéro de téléphone.");
    brancherBoutonContact(btnWhatsapp, whatsappEffectif, (numero) => "https://wa.me/" + numero, "Le propriétaire n'a pas renseigné de numéro WhatsApp.");

    if(btnMessage){

        if(logement.contact_email){

            btnMessage.href = "mailto:" + logement.contact_email;

        }else{

            btnMessage.addEventListener("click", (e) => {

                e.preventDefault();

                showToast("Le propriétaire n'a pas renseigné d'email de contact.", "error");

            });

        }

    }

}

/**
 * Branche un bouton de contact (Appeler/WhatsApp) sur un numéro
 * s'il est disponible, ou sur un message d'erreur clair sinon.
 */
function brancherBoutonContact(btn, telephone, construireHref, messageErreur){

    if(!btn) return;

    if(!telephone){

        btn.addEventListener("click", (e) => {

            e.preventDefault();

            showToast(messageErreur, "error");

        });

        return;
    }

    btn.href = construireHref(formaterNumeroInternational(telephone));

}

/**
 * Affiche une carte (Google Maps, sans clé API) et un lien
 * "Itinéraire" pointant sur la ville/quartier réel du logement.
 * Masque toute la section si aucune ville n'est renseignée.
 */
function afficherLocalisation(ville){

    const section =
    document.getElementById("property-location");

    if(!section) return;

    if(!ville){

        section.style.display = "none";

        return;
    }

    section.style.display = "";

    const requete =
    encodeURIComponent(ville + ", Sénégal");

    document.getElementById("locationVille").innerHTML =
    `<i class="ph ph-map-pin"></i> ${ville}`;

    document.getElementById("mapEmbed").src =
    `https://www.google.com/maps?q=${requete}&output=embed`;

    document.getElementById("itineraireBtn").href =
    `https://www.google.com/maps/dir/?api=1&destination=${requete}`;

}

/**
 * Affiche le montant de la caution demandée par le propriétaire,
 * si renseigné. Masque la ligne si aucune caution n'est exigée.
 */
function afficherCaution(caution){

    const cautionEl =
    document.getElementById("cautionInfo");

    if(!cautionEl) return;

    if(caution === null || caution === undefined || caution === ""){

        cautionEl.style.display = "none";

        return;
    }

    cautionEl.textContent =
    "Caution : " + Number(caution).toLocaleString("fr-FR") + " FCFA";

    cautionEl.style.display = "";

}

const LIBELLES_NIVEAU_ETAGE = {
    rdc: "Rez-de-chaussée",
    "1": "1er étage",
    "2": "2e étage",
    "3": "3e étage",
    "4_plus": "4e étage et plus"
};

/**
 * Affiche le lecteur de publicité vocale (plans Premium/Pro
 * uniquement), si le propriétaire en a ajouté une.
 */
function afficherAudio(audioUrl){

    const audioCard =
    document.getElementById("audioCard");

    const audioPlayer =
    document.getElementById("audioPlayer");

    if(!audioCard || !audioPlayer) return;

    if(!audioUrl){

        audioCard.style.display = "none";

        return;
    }

    audioPlayer.src = audioUrl;
    audioCard.style.display = "";

}

/**
 * Reconstruit les badges rapides (chambres, capacité, étage) à
 * partir des vraies données du logement. Les équipements (dont
 * Wi-Fi) ne sont volontairement pas répétés ici : ils n'apparaissent
 * que dans la section "Équipements" plus bas, pour éviter le doublon.
 */
function afficherCaracteristiques(logement){

    const container =
    document.getElementById("propertyFeatures");

    if(!container) return;

    const badges = [
        `<span><i class="ph ${iconeTypeLogement(logement.type)}"></i> ${logement.type || ""}</span>`
    ];

    if(Number(logement.chambres) > 0){
        badges.push(`<span><i class="ph ph-bed"></i> ${logement.chambres} ${libeleUnitePieces(logement.type)}(s)</span>`);
    }

    if(logement.nombre_personnes){
        badges.push(`<span><i class="ph ph-users-three"></i> ${logement.nombre_personnes} personne(s)</span>`);
    }

    if(logement.type === "Immeuble" && logement.nombre_etages){
        badges.push(`<span><i class="ph ph-buildings"></i> ${logement.nombre_etages} étage(s)</span>`);
    }else if(logement.niveau_etage && LIBELLES_NIVEAU_ETAGE[logement.niveau_etage]){
        badges.push(`<span><i class="ph ph-stairs"></i> ${LIBELLES_NIVEAU_ETAGE[logement.niveau_etage]}</span>`);
    }

    container.innerHTML =
    badges.join("");

}

/**
 * Affiche uniquement les équipements réellement cochés par le
 * propriétaire (equip_wifi, equip_parking, ...). Masque toute la
 * section si aucun équipement n'est renseigné, plutôt que
 * d'afficher une liste vide.
 */
function afficherEquipements(logement){

    const equipementsDisponibles = [
        { cle: "equip_wifi", icone: "ph-wifi-high", libelle: "Wifi" },
        { cle: "equip_parking", icone: "ph-car", libelle: "Parking" },
        { cle: "equip_cuisine", icone: "ph-fork-knife", libelle: "Cuisine équipée" },
        { cle: "equip_douche", icone: "ph-drop", libelle: "Douche" },
        { cle: "equip_salon", icone: "ph-armchair", libelle: "Salon" },
        { cle: "equip_balcon", icone: "ph-door-open", libelle: "Balcon" },
        { cle: "equip_eau", icone: "ph-drop-half-bottom", libelle: "Eau" },
        { cle: "equip_electricite", icone: "ph-lightning", libelle: "Électricité" },
        { cle: "equip_climatisation", icone: "ph-snowflake", libelle: "Climatisation" },
    ];

    const equipementsActifs =
    equipementsDisponibles.filter(e => Number(logement[e.cle]) === 1);

    const equipmentCard =
    document.querySelector(".equipment-card");

    const equipmentGrid =
    document.querySelector(".equipment-grid");

    if(!equipmentCard || !equipmentGrid) return;

    if(equipementsActifs.length === 0){

        equipmentCard.style.display = "none";

        return;
    }

    equipmentGrid.innerHTML =
    equipementsActifs.map(e => `
        <span><i class="ph ${e.icone}"></i> ${e.libelle}</span>
    `).join("");

}

/**
 * Affiche le profil de locataire recherché par le propriétaire
 * (célibataire, marié, étudiant...), si renseigné. Masque toute la
 * section si aucun profil n'a été coché.
 */
function afficherProfilRecherche(logement){

    const profilsDisponibles = [
        { cle: "profil_celibataire", icone: "ph-user", libelle: "Célibataire" },
        { cle: "profil_marie", icone: "ph-users", libelle: "Marié(e)" },
        { cle: "profil_etudiant", icone: "ph-graduation-cap", libelle: "Étudiant(e)" },
        { cle: "profil_travailleur", icone: "ph-briefcase", libelle: "Travailleur(se)" },
        { cle: "profil_senegalais", icone: "ph-flag", libelle: "Sénégalais(e)" },
        { cle: "profil_etranger", icone: "ph-globe", libelle: "Étranger(ère)" },
    ];

    const profilsActifs =
    profilsDisponibles.filter(p => Number(logement[p.cle]) === 1);

    const profilCard =
    document.getElementById("profilCard");

    const profilGrid =
    document.getElementById("profilGrid");

    if(!profilCard || !profilGrid) return;

    if(profilsActifs.length === 0){

        profilCard.style.display = "none";

        return;
    }

    profilGrid.innerHTML =
    profilsActifs.map(p => `
        <span><i class="ph ${p.icone}"></i> ${p.libelle}</span>
    `).join("");

    profilCard.style.display = "";

}

/**
 * Nettoie un numéro saisi sous différentes formes (+221 77 ...,
 * 00221 77 ..., 077 ...) vers un format international sans "+"
 * (attendu par tel: et wa.me). Le préfixe 221 (Sénégal) est
 * ajouté par défaut, la plateforme étant nationale.
 */
function formaterNumeroInternational(telephone){

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

/**
 * Reconstruit la galerie (#details-gallery) à partir des vrais
 * médias du logement : la première image en grand, le reste
 * (images et vidéos) en vignettes. Ne touche à rien si le
 * logement n'a aucun média (garde le contenu de démonstration).
 */
function afficherGalerie(medias){

    if(!medias || medias.length === 0) return;

    const images =
    medias.filter(m => m.type === "image");

    const reste =
    medias.filter((m, i) => i !== medias.indexOf(images[0]));

    const galleryMain =
    document.querySelector(".gallery-main");

    const gallerySide =
    document.querySelector(".gallery-side");

    if(galleryMain && images[0]){

        galleryMain.innerHTML =
        `<img src="${images[0].url}" alt="Photo du logement">`;

    }

    if(gallerySide){

        gallerySide.innerHTML =
        reste.map(media => {

            if(media.type === "video"){

                return `<video src="${media.url}" controls></video>`;

            }

            return `<img src="${media.url}" loading="lazy" alt="Photo du logement">`;

        }).join("");

    }

}

/* ==========================
    ACTIONS PAS ENCORE DISPONIBLES
    (uniquement en accès direct sans ?id= — appel, WhatsApp,
    message et logements similaires sont tous réels dès qu'un
    vrai logement est chargé)
========================== */

const selecteurActionsEnAttente =
logementId
? null
: ".reserve-btn, .btn-call, .btn-whatsapp, .btn-message";

if(selecteurActionsEnAttente){

document.querySelectorAll(selecteurActionsEnAttente).forEach(el => {

    el.addEventListener("click", (e) => {

        e.preventDefault();

        showToast("Fonctionnalité bientôt disponible.");

    });

});

}
