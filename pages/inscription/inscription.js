/* ==========================================================
   INSCRIPTION.JS — page d'inscription uniquement
   ========================================================== */

const registerForm =
document.getElementById("registerForm");

if(registerForm){

    registerForm.addEventListener("submit",(e)=>{

        e.preventDefault();

        const password =
        document.getElementById("password").value;

        const confirmPassword =
        document.getElementById("confirmPassword").value;

        if(password !== confirmPassword){

            alert("Les mots de passe ne correspondent pas.");

            return;
        }

        alert("Compte créé avec succès !");
    });

}
