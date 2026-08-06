/* ==========================================================
   PROFIL.JS — page profil uniquement
   Page protégée : charge les vraies infos du compte connecté,
   permet de les modifier et de changer la photo de profil.
   ========================================================== */

(async () => {

    let utilisateur;

    try{

        utilisateur = await apiFetch("/auth/me");

    }catch(error){

        window.location.href =
        "../connexion/connexion.html";

        return;
    }

    document.getElementById("nom_complet").value =
    utilisateur.nom_complet || "";

    document.getElementById("telephone").value =
    utilisateur.telephone || "";

    document.getElementById("email").value =
    utilisateur.email || "";

    afficherAvatar(utilisateur.photo_url);

    const notifCheckbox =
    document.getElementById("notificationsActives");

    if(notifCheckbox){

        notifCheckbox.checked =
        Number(utilisateur.notifications_actives) !== 0;

        notifCheckbox.addEventListener("change", async () => {

            try{

                await apiFetch("/auth/notifications", {

                    method: "PUT",

                    body: JSON.stringify({ actives: notifCheckbox.checked })

                });

                showToast(
                    notifCheckbox.checked
                    ? "Notifications activées."
                    : "Notifications désactivées."
                );

            }catch(error){

                notifCheckbox.checked = !notifCheckbox.checked;

                showToast("Impossible de modifier cette préférence.", "error");

            }

        });

    }

})();

function afficherAvatar(photoUrl){

    const avatar =
    document.getElementById("profilAvatar");

    if(!avatar) return;

    if(photoUrl){

        avatar.innerHTML =
        `<img src="${photoUrl}" alt="Photo de profil">`;

    }else{

        avatar.innerHTML =
        `<i class="ph ph-user"></i>`;

    }

}

/* ==========================
    MODIFIER LES COORDONNÉES
========================== */

const profilForm =
document.getElementById("profilForm");

if(profilForm){

    profilForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const nom_complet =
        document.getElementById("nom_complet").value.trim();

        const telephone =
        document.getElementById("telephone").value.trim();

        const email =
        document.getElementById("email").value.trim();

        if(!nom_complet || !email){

            showToast("Le nom et l'email sont obligatoires.", "error");

            return;
        }

        const submitBtn =
        profilForm.querySelector(".btn-primary");

        submitBtn.disabled = true;

        try{

            await apiFetch("/auth/profil", {

                method: "PUT",

                body: JSON.stringify({ nom_complet, telephone, email })

            });

            showToast("Profil mis à jour avec succès.");

        }catch(error){

            showToast(error.message, "error");

        }finally{

            submitBtn.disabled = false;

        }

    });

}

/* ==========================
    CHANGER LA PHOTO DE PROFIL
========================== */

const photoInput =
document.getElementById("photoInput");

if(photoInput){

    photoInput.addEventListener("change", async () => {

        const fichier =
        photoInput.files[0];

        if(!fichier) return;

        const formData =
        new FormData();

        formData.append("photo", fichier);

        try{

            const resultat =
            await apiFetch("/auth/profil/photo", {

                method: "POST",

                body: formData

            });

            afficherAvatar(resultat.photo_url);

            showToast("Photo de profil mise à jour.");

        }catch(error){

            showToast(error.message, "error");

        }

    });

}
