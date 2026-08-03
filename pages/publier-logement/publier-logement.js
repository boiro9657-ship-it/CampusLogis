/* ==========================================================
   PUBLIER-LOGEMENT.JS — page de publication uniquement
   Enregistre l'annonce dans localStorage puis redirige
   vers le tableau de bord propriétaire.
   ========================================================== */

const publishForm =
document.getElementById("publishForm");

if(publishForm){

    publishForm.addEventListener(
        "submit",
        (e)=>{

            e.preventDefault();

            const titre =
            document.getElementById("titre").value;

            const ville =
            document.getElementById("ville").value;

            const prix =
            document.getElementById("prix").value;

            const chambres =
            document.getElementById("chambres").value;

            const description =
            document.getElementById("description").value;

            const photo =
            document.getElementById("photo");

            const fichiers =
            photo.files;

            if(!fichiers || fichiers.length === 0){

            alert(
                "Veuillez sélectionner une image."
            );

            return;

            }

            const reader =
            new FileReader();

            reader.onload =
            function(){

                const logement = {

                    id: Date.now(),

                    titre,
                    ville,
                    prix,
                    chambres,
                    description,

                   image: reader.result


                };

                let logements =
                JSON.parse(
                    localStorage.getItem(
                        "logements"
                    )
                ) || [];

                logements.push(
                    logement
                );

                localStorage.setItem(
                    "logements",
                    JSON.stringify(
                        logements
                    )
                );

                alert(
                    "Logement publié avec succès !"
                );

                window.location.href =
                "../dashboard-proprietaire/dashboard-proprietaire.html";

            };

            reader.readAsDataURL(
                fichiers[0]
            );

        }
    );

}
