/* ==========================================================
   REINITIALISER-MOT-DE-PASSE.JS — page dédiée uniquement
   Lit le token dans l'URL (?token=...) et envoie le nouveau
   mot de passe à l'API.
   ========================================================== */

const params =
new URLSearchParams(window.location.search);

const token =
params.get("token");

const resetForm =
document.getElementById("resetForm");

if(!token && resetForm){

    resetForm.innerHTML =
    `<p class="auth-message">⚠️ Ce lien de réinitialisation est invalide. Redemandez-en un depuis la page "Mot de passe oublié".</p>`;

}else if(resetForm){

    resetForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const password =
        document.getElementById("password").value;

        const confirmPassword =
        document.getElementById("confirmPassword").value;

        if(password.length < 8){

            showToast("Le mot de passe doit contenir au moins 8 caractères.", "error");

            return;
        }

        if(password !== confirmPassword){

            showToast("Les mots de passe ne correspondent pas.", "error");

            return;
        }

        const submitBtn =
        resetForm.querySelector(".login-btn");

        submitBtn.disabled = true;

        try{

            await apiFetch("/auth/reset-password", {

                method: "POST",

                body: JSON.stringify({ token, mot_de_passe: password })

            });

            resetForm.innerHTML =
            `<p class="auth-message">✅ Mot de passe mis à jour ! Vous pouvez maintenant vous connecter.</p>`;

            setTimeout(()=>{

                window.location.href =
                "../connexion/connexion.html";

            }, 2000);

        }catch(error){

            showToast(error.message, "error");

            submitBtn.disabled = false;

        }

    });

}
