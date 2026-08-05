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

                setTimeout(()=>{

                    window.location.href =
                    "../dashboard-proprietaire/dashboard-proprietaire.html";

                }, 1200);

            }catch(error){

                showToast(error.message, "error");

                submitBtn.disabled = false;

            }

        }
    );

}
