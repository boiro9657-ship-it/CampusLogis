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

            if(Number(prix) < 20000){

                showToast("Le prix minimum est de 20 000 FCFA.", "error");

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
 * Après publication, suggère le plan le mieux adapté en se
 * basant sur le vrai nombre d'annonces du propriétaire (pas une
 * estimation) : le plan Gratuit ne permet qu'1 annonce active,
 * Premium jusqu'à 5, Pro est illimité — cohérent avec tarifs.html.
 */
async function afficherSuggestionPlan(){

    let nbAnnonces = 1;

    try{

        const mesLogements =
        await apiFetch("/logements/mine");

        nbAnnonces = mesLogements.length;

    }catch(error){

        // Si le comptage échoue, on affiche quand même la
        // confirmation de publication sans recommandation précise.

    }

    const carte =
    document.getElementById("planSuggestionCard");

    if(nbAnnonces <= 1){

        carte.innerHTML = `
            <h3><i class="ph ph-check-circle"></i> Le plan Gratuit vous convient</h3>
            <p>Avec ${nbAnnonces} annonce active, vous êtes exactement dans les limites du plan Gratuit. Rien à faire de plus pour l'instant.</p>
        `;

    }else if(nbAnnonces <= 5){

        carte.innerHTML = `
            <h3><i class="ph ph-crown-simple"></i> Le plan Premium vous correspond mieux</h3>
            <p>Vous avez maintenant ${nbAnnonces} annonces — au-delà d'une seule, le plan Gratuit ne couvre plus vos besoins. Premium permet jusqu'à 5 annonces actives avec une meilleure visibilité.</p>
        `;

    }else{

        carte.innerHTML = `
            <h3><i class="ph ph-crown-simple"></i> Le plan Pro vous correspond mieux</h3>
            <p>Avec ${nbAnnonces} annonces, le plan Pro (annonces illimitées, position prioritaire) est le plus adapté à votre activité.</p>
        `;

    }

    publishForm.style.display = "none";

    document.getElementById("planSuggestion").style.display = "";

    window.scrollTo({ top: 0, behavior: "smooth" });

}
