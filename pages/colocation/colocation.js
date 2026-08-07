/* ==========================================================
   COLOCATION.JS — page colocation uniquement
   Publier/consulter des annonces de recherche de colocataire.
   ========================================================== */

let utilisateurConnecteId = null;

(async () => {

    try{

        const utilisateur =
        await apiFetch("/auth/me");

        utilisateurConnecteId = utilisateur.id;

    }catch(error){

        // Page consultable sans connexion ; seule la publication
        // d'une annonce exige un compte.

    }

    chargerColocations();

})();

/* ==========================
    AFFICHER / MASQUER LE FORMULAIRE
========================== */

const formSection =
document.getElementById("coloc-form-section");

document.getElementById("btnAfficherFormulaire").addEventListener("click", async () => {

    try{

        await apiFetch("/auth/me");

    }catch(error){

        showToast("Connectez-vous pour publier une annonce.", "error");

        setTimeout(() => {
            window.location.href = "../connexion/connexion.html";
        }, 1200);

        return;
    }

    const affichee =
    formSection.style.display !== "none";

    formSection.style.display = affichee ? "none" : "";

    if(!affichee){

        formSection.scrollIntoView({ behavior: "smooth", block: "start" });

    }

});

/* ==========================
    PUBLIER UNE ANNONCE
========================== */

const colocForm =
document.getElementById("colocForm");

colocForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const ville =
    document.getElementById("colocVille").value.trim();

    const description =
    document.getElementById("colocDescription").value.trim();

    if(!ville || !description){

        showToast("La ville et une description sont obligatoires.", "error");

        return;
    }

    const body = {
        ville,
        type_logement: document.getElementById("colocType").value,
        budget: document.getElementById("colocBudget").value,
        description,
        contact_telephone: document.getElementById("colocTelephone").value.trim(),
        contact_whatsapp: document.getElementById("colocWhatsapp").value.trim(),
    };

    const submitBtn =
    colocForm.querySelector("button[type=submit]");

    submitBtn.disabled = true;

    try{

        await apiFetch("/colocations", {

            method: "POST",

            body: JSON.stringify(body)

        });

        showToast("Annonce publiée avec succès !");

        colocForm.reset();

        formSection.style.display = "none";

        chargerColocations();

    }catch(error){

        showToast(error.message, "error");

    }finally{

        submitBtn.disabled = false;

    }

});

/* ==========================
    LISTE DES ANNONCES
========================== */

const colocGrid =
document.getElementById("colocGrid");

async function chargerColocations(){

    let colocations;

    try{

        colocations = await apiFetch("/colocations");

    }catch(error){

        colocGrid.innerHTML =
        '<p class="cards-empty">Impossible de charger les annonces pour le moment.</p>';

        return;
    }

    if(!colocations || colocations.length === 0){

        colocGrid.innerHTML =
        '<p class="cards-empty">Aucune annonce de colocation pour le moment. Soyez le premier à en publier une !</p>';

        return;
    }

    colocGrid.innerHTML =
    colocations.map(colocHTML).join("");

    colocGrid.querySelectorAll(".btn-supprimer-coloc").forEach(btn => {

        btn.addEventListener("click", async () => {

            if(!confirm("Supprimer cette annonce ?")) return;

            try{

                await apiFetch("/colocations/" + btn.dataset.id, { method: "DELETE" });

                chargerColocations();

            }catch(error){

                showToast("Suppression impossible.", "error");

            }

        });

    });

}

function colocHTML(c){

    const avatar =
    c.auteur_photo
    ? `<img src="${c.auteur_photo}" alt="${c.auteur_nom}">`
    : `<i class="ph ph-user"></i>`;

    const budgetTexte =
    c.budget ? `${Number(c.budget).toLocaleString("fr-FR")} FCFA max` : "Budget non précisé";

    const date =
    new Date(c.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

    const telephoneEffectif =
    c.contact_telephone || c.auteur_telephone;

    const whatsappEffectif =
    c.contact_whatsapp || c.contact_telephone || c.auteur_telephone;

    const estAuteur =
    utilisateurConnecteId && Number(c.user_id) === Number(utilisateurConnecteId);

    return `
    <div class="coloc-card">

        <div class="coloc-card-header">

            <div class="coloc-avatar">${avatar}</div>

            <div>
                <h4>${c.auteur_nom}</h4>
                <span>Publié le ${date}</span>
            </div>

        </div>

        <p class="coloc-meta">
            <i class="ph ph-map-pin"></i> ${c.ville}
            ${c.type_logement ? `<span class="coloc-tag">${c.type_logement}</span>` : ""}
        </p>

        <p class="coloc-budget"><i class="ph ph-wallet"></i> ${budgetTexte}</p>

        <p class="coloc-description">${c.description}</p>

        <div class="coloc-actions">

            ${
                telephoneEffectif
                ? `<a href="tel:+${formaterNumeroInternational(telephoneEffectif)}" class="btn-call"><i class="ph ph-phone"></i> Appeler</a>`
                : ""
            }

            ${
                whatsappEffectif
                ? `<a href="https://wa.me/${formaterNumeroInternational(whatsappEffectif)}" target="_blank" rel="noopener" class="btn-whatsapp"><i class="ph ph-whatsapp-logo"></i> WhatsApp</a>`
                : ""
            }

            ${
                estAuteur
                ? `<button class="btn-supprimer-coloc" data-id="${c.id}"><i class="ph ph-trash"></i> Supprimer</button>`
                : ""
            }

        </div>

    </div>
    `;

}

/**
 * Nettoie un numéro saisi sous différentes formes vers un format
 * international sans "+" (attendu par tel: et wa.me). Même logique
 * que sur la page détails logement.
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
