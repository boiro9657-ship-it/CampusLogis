/* ==========================================================
   PUBLIER-LOGEMENT.JS — page de publication uniquement
   Page protégée : envoie le formulaire (dont la photo) en
   multipart/form-data à l'API, puis redirige vers le tableau
   de bord propriétaire.
   ========================================================== */

(async () => {

    try{

        await apiFetch("/auth/me");

    }catch(error){

        window.location.href =
        "../connexion/connexion.html";

    }

})();

const publishForm =
document.getElementById("publishForm");

/* ==========================
    CHOIX DE LA FORMULE
    Affichée avant le formulaire : le propriétaire peut l'ignorer
    et publier gratuitement (limité à 2 annonces/jour), ou être
    informé que Premium/Pro arrivent bientôt (paiement pas encore
    branché).
========================== */

const planChoice =
document.getElementById("planChoice");

function afficherFormulairePublication(){

    if(planChoice) planChoice.style.display = "none";

    if(publishForm) publishForm.style.display = "";

    window.scrollTo({ top: 0, behavior: "smooth" });

}

document.getElementById("btnContinuerGratuit")?.addEventListener(
    "click",
    afficherFormulairePublication
);

document.getElementById("lienIgnorerPlan")?.addEventListener(
    "click",
    (e) => {

        e.preventDefault();

        afficherFormulairePublication();

    }
);

document.querySelectorAll("#planChoice [data-plan]").forEach(btn => {

    btn.addEventListener("click", () => {

        showToast(
            "Formule " + btn.dataset.plan + " bientôt disponible — " +
            "paiement Wave / Orange Money en cours d'intégration."
        );

    });

});

if(publishForm){

    publishForm.addEventListener(
        "submit",
        async (e)=>{

            e.preventDefault();

            const titre =
            document.getElementById("titre").value.trim();

            const ville =
            document.getElementById("ville").value.trim();

            const type =
            document.getElementById("type").value;

            const prix =
            document.getElementById("prix").value;

            const chambres =
            document.getElementById("chambres").value;

            const dureeLocation =
            document.getElementById("duree_location").value;

            const caution =
            document.getElementById("caution").value;

            const description =
            document.getElementById("description").value.trim();

            const photosInput =
            document.getElementById("photos");

            const videosInput =
            document.getElementById("videos");

            const photos =
            photosInput.files;

            const videos =
            videosInput.files;

            if(!titre || !ville || !prix){

                showToast("Veuillez remplir tous les champs obligatoires.", "error");

                return;
            }

            if(Number(prix) < 10000){

                showToast("Le prix minimum est de 10 000 FCFA.", "error");

                return;
            }

            if(!photos || photos.length === 0){

                showToast("Veuillez sélectionner au moins une photo.", "error");

                return;
            }

            if(photos.length > 8){

                showToast("8 photos maximum par annonce.", "error");

                return;
            }

            if(videos.length > 2){

                showToast("2 vidéos maximum par annonce.", "error");

                return;
            }

            const submitBtn =
            publishForm.querySelector(".publish-btn");

            submitBtn.disabled = true;

            const formData =
            new FormData();

            formData.append("titre", titre);
            formData.append("ville", ville);
            formData.append("type", type);
            formData.append("prix", prix);
            formData.append("chambres", chambres);
            formData.append("duree_location", dureeLocation);
            formData.append("caution", caution);
            formData.append("description", description);

            const contactTelephone = document.getElementById("contact_telephone").value.trim();
            const contactWhatsapp = document.getElementById("contact_whatsapp").value.trim();
            const contactEmail = document.getElementById("contact_email").value.trim();

            formData.append("contact_telephone", contactTelephone);
            formData.append("contact_whatsapp", contactWhatsapp);
            formData.append("contact_email", contactEmail);

            document.querySelectorAll('input[name="equipements[]"]:checked').forEach(checkbox => {

                formData.append("equipements[]", checkbox.value);

            });

            for(const fichier of photos){

                formData.append("photos[]", fichier);

            }

            for(const fichier of videos){

                formData.append("videos[]", fichier);

            }

            try{

                await apiFetch("/logements", {

                    method: "POST",

                    body: formData

                });

                showToast("Logement publié avec succès !");

                await afficherSuggestionPlan();

            }catch(error){

                showToast(error.message, "error");

                submitBtn.disabled = false;

            }

        }
    );

}

/**
 * Après publication, indique où en est le propriétaire par rapport
 * à la limite quotidienne du plan Gratuit (2 annonces/jour, la
 * même limite que celle appliquée côté serveur) — pas une
 * estimation sur le total d'annonces, mais sur celles du jour.
 */
async function afficherSuggestionPlan(){

    const LIMITE_GRATUIT_PAR_JOUR = 2;

    let nbAujourdhui = 1;

    try{

        const mesLogements =
        await apiFetch("/logements/mine");

        const aujourdhui =
        new Date().toDateString();

        nbAujourdhui =
        mesLogements.filter(l => new Date(l.created_at).toDateString() === aujourdhui).length;

    }catch(error){

        // Si le comptage échoue, on affiche quand même la
        // confirmation de publication sans recommandation précise.

    }

    const carte =
    document.getElementById("planSuggestionCard");

    if(nbAujourdhui < LIMITE_GRATUIT_PAR_JOUR){

        carte.innerHTML = `
            <h3><i class="ph ph-check-circle"></i> Le plan Gratuit vous convient</h3>
            <p>${nbAujourdhui} annonce${nbAujourdhui > 1 ? "s" : ""} publiée${nbAujourdhui > 1 ? "s" : ""} aujourd'hui sur ${LIMITE_GRATUIT_PAR_JOUR} possibles avec le plan Gratuit.</p>
        `;

    }else{

        carte.innerHTML = `
            <h3><i class="ph ph-crown-simple"></i> Limite quotidienne atteinte</h3>
            <p>Vous avez publié ${nbAujourdhui} annonces aujourd'hui, la limite du plan Gratuit. Passez au Premium ou au Pro pour publier davantage dès aujourd'hui, ou revenez demain.</p>
        `;

    }

    publishForm.style.display = "none";

    document.getElementById("planSuggestion").style.display = "";

    window.scrollTo({ top: 0, behavior: "smooth" });

}
