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

    document.querySelector(".property-info .description").textContent =
    logement.description || "";

    const descriptionCompleteEl =
    document.getElementById("descriptionComplete");

    if(descriptionCompleteEl){

        descriptionCompleteEl.textContent =
        logement.description || "Aucune description fournie par le propriétaire.";

    }

    document.querySelector(".price-card h3").textContent =
    prix + " FCFA";

    afficherCaracteristiques(logement);

    afficherGalerie(logement.medias || []);

    afficherEquipements(logement);

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

    const ownerNomEl =
    document.querySelector(".owner-info h2");

    if(ownerNomEl){

        ownerNomEl.textContent =
        logement.proprietaire_nom || "Propriétaire";

    }

    afficherInfosProprietaire(logement);

    brancherContactProprietaire(logement);

    chargerLogementsSimilaires(logement);

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

                <h4>${Number(l.prix).toLocaleString("fr-FR")} FCFA / mois</h4>

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
 * Reconstruit les badges rapides (chambres + wifi/parking si
 * présents) à partir des vraies données du logement. Le nombre
 * de chambres est toujours affiché ; les autres badges
 * n'apparaissent que si l'équipement correspondant est coché.
 */
function afficherCaracteristiques(logement){

    const container =
    document.getElementById("propertyFeatures");

    if(!container) return;

    const badges = [
        `<span><i class="ph ph-bed"></i> ${logement.chambres || 0} Chambre(s)</span>`
    ];

    if(Number(logement.equip_wifi) === 1){
        badges.push(`<span><i class="ph ph-wifi-high"></i> Wi-Fi</span>`);
    }

    if(Number(logement.equip_parking) === 1){
        badges.push(`<span><i class="ph ph-car"></i> Parking</span>`);
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
