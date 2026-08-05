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

    brancherContactProprietaire(logement.proprietaire_telephone);

}

/**
 * Branche "Appeler" et "WhatsApp" sur le vrai numéro du
 * propriétaire (liens tel: et wa.me). Si aucun numéro n'est
 * enregistré pour ce compte, affiche un message clair plutôt
 * qu'un lien cassé.
 */
function brancherContactProprietaire(telephone){

    const btnCall =
    document.querySelector(".btn-call");

    const btnWhatsapp =
    document.querySelector(".btn-whatsapp");

    if(!telephone){

        [btnCall, btnWhatsapp].forEach(btn => {

            if(!btn) return;

            btn.addEventListener("click", (e) => {

                e.preventDefault();

                showToast("Le propriétaire n'a pas renseigné de numéro de téléphone.", "error");

            });

        });

        return;
    }

    const numero =
    formaterNumeroInternational(telephone);

    if(btnCall) btnCall.href = "tel:+" + numero;
    if(btnWhatsapp) btnWhatsapp.href = "https://wa.me/" + numero;

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
    (message direct, logements similaires — appel et WhatsApp
    sont branchés sur le vrai numéro dans brancherContactProprietaire)
========================== */

const selecteurActionsEnAttente =
logementId
? ".btn-message, .similar-content a"
: ".reserve-btn, .btn-call, .btn-whatsapp, .btn-message, .similar-content a";

document.querySelectorAll(selecteurActionsEnAttente).forEach(el => {

    el.addEventListener("click", (e) => {

        e.preventDefault();

        showToast("Fonctionnalité bientôt disponible.");

    });

});
