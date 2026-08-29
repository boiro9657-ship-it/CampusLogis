/* ==========================================================
   CONNEXION.JS — page de connexion uniquement
   Affichage/masquage du mot de passe.
   ========================================================== */

const togglePassword =
document.getElementById("togglePassword");

const password =
document.getElementById("password");

if(togglePassword && password){

    togglePassword.addEventListener("click",()=>{

        if(password.type==="password"){

            password.type="text";

            togglePassword.classList.replace(
                "ph-eye",
                "ph-eye-slash"
            );

        }else{

            password.type="password";

            togglePassword.classList.replace(
                "ph-eye-slash",
                "ph-eye"
            );

        }

    });

}

/* ==========================
    ERREUR GOOGLE (redirection depuis le callback OAuth)
========================== */

if(new URLSearchParams(window.location.search).get("erreur") === "google"){

    showToast("La connexion avec Google a échoué. Réessayez ou utilisez votre email.", "error");

}

/* ==========================
    FORMULAIRE DE CONNEXION
========================== */

const loginForm =
document.getElementById("loginForm");

if(loginForm){

    loginForm.addEventListener("submit", async (e)=>{

        e.preventDefault();

        const email =
        document.getElementById("email").value.trim();

        const pass =
        document.getElementById("password").value;

        if(!email || !pass){

            showToast("Veuillez remplir tous les champs.", "error");

            return;
        }

        const submitBtn =
        loginForm.querySelector(".login-btn");

        submitBtn.disabled = true;

        try{

            await apiFetch("/auth/login", {

                method: "POST",

                body: JSON.stringify({
                    email,
                    mot_de_passe: pass
                })

            });

            const redirect =
            new URLSearchParams(window.location.search).get("redirect");

            window.location.href =
            redirect || "../../index.html";

        }catch(error){

            showToast("Email ou mot de passe incorrect.", "error");

            submitBtn.disabled = false;

        }

    });

}
