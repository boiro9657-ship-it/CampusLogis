/* ==========================================================
   MOT-DE-PASSE-OUBLIE.JS — page mot de passe oublié uniquement
   Demande l'envoi d'un email de réinitialisation.
   ========================================================== */

const forgotForm =
document.getElementById("forgotForm");

if(forgotForm){

    forgotForm.addEventListener("submit", async (e) => {

        e.preventDefault();

        const email =
        document.getElementById("email").value.trim();

        if(!email){

            showToast("Veuillez indiquer votre email.", "error");

            return;
        }

        const submitBtn =
        forgotForm.querySelector(".login-btn");

        submitBtn.disabled = true;

        try{

            await apiFetch("/auth/forgot-password", {

                method: "POST",

                body: JSON.stringify({ email })

            });

            forgotForm.innerHTML =
            `<p class="auth-message">✅ Si cet email correspond à un compte, un lien de réinitialisation vient d'être envoyé. Vérifiez votre boîte mail (et vos spams).</p>`;

        }catch(error){

            showToast(error.message, "error");

            submitBtn.disabled = false;

        }

    });

}
