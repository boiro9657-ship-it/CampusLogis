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

    document.querySelector(".price-card h3").textContent =
    prix + " FCFA";

    const chambresEl =
    document.querySelector(".property-features span");

    if(chambresEl){

        chambresEl.innerHTML =
        `<i class="ph ph-bed"></i> ${logement.chambres || 0} Chambre(s)`;

    }

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

    brancherContactProprietaire(logement);

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
    (logements similaires — appel, WhatsApp et message sont
    branchés sur les vraies coordonnées dans brancherContactProprietaire)
========================== */

const selecteurActionsEnAttente =
logementId
? ".similar-content a"
: ".reserve-btn, .btn-call, .btn-whatsapp, .btn-message, .similar-content a";

document.querySelectorAll(selecteurActionsEnAttente).forEach(el => {

    el.addEventListener("click", (e) => {

        e.preventDefault();

        showToast("Fonctionnalité bientôt disponible.");

    });

});
