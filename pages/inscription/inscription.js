/* ==========================================================
   INSCRIPTION.JS — page d'inscription uniquement
   Crée le compte via l'API (backend/api/auth/register).
   ========================================================== */

const registerForm =
document.getElementById("registerForm");

if(registerForm){

    registerForm.addEventListener("submit", async (e)=>{

        e.preventDefault();

        const nom =
        document.getElementById("nom").value.trim();

        const email =
        document.getElementById("email").value.trim();

        const telephone =
        document.getElementById("telephone").value.trim();

        const role =
        document.getElementById("role").value;

        const password =
        document.getElementById("password").value;

        const confirmPassword =
        document.getElementById("confirmPassword").value;

        if(!nom || !email || !role || !password){

            showToast("Veuillez remplir tous les champs.");

            return;
        }

        if(password !== confirmPassword){

            showToast("Les mots de passe ne correspondent pas.");

            return;
        }

        const submitBtn =
        registerForm.querySelector(".login-btn");

        submitBtn.disabled = true;

        try{

            await apiFetch("/auth/register", {

                method: "POST",

                body: JSON.stringify({
                    nom_complet: nom,
                    email,
                    telephone,
                    mot_de_passe: password,
                    role
                })

            });

            showToast("Compte créé avec succès ! Vous pouvez vous connecter.");

            setTimeout(()=>{

                window.location.href =
                "../connexion/connexion.html";

            }, 1500);

        }catch(error){

            showToast(error.message);

        }finally{

            submitBtn.disabled = false;

        }

    });

}
