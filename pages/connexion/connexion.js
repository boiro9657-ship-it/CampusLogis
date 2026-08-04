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
    FORMULAIRE DE CONNEXION
========================== */

const loginForm =
document.getElementById("loginForm");

if(loginForm){

    loginForm.addEventListener("submit",(e)=>{

        e.preventDefault();

        const email =
        document.getElementById("email").value.trim();

        const pass =
        document.getElementById("password").value;

        if(!email || !pass){

            showToast("Veuillez remplir tous les champs.");

            return;
        }

        showToast("Connexion au backend bientôt disponible.");

    });

}
