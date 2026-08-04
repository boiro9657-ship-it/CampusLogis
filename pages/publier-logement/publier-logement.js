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

            const photo =
            document.getElementById("photo");

            const fichiers =
            photo.files;

            if(!titre || !ville || !prix){

                showToast("Veuillez remplir tous les champs obligatoires.", "error");

                return;
            }

            if(!fichiers || fichiers.length === 0){

                showToast("Veuillez sélectionner une image.", "error");

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
            formData.append("photo", fichiers[0]);

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
