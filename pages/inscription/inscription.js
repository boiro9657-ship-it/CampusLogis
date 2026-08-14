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

            showToast("Veuillez remplir tous les champs.", "error");

            return;
        }

        if(password !== confirmPassword){

            showToast("Les mots de passe ne correspondent pas.", "error");

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

        }catch(error){

            showToast(error.message, "error");

            submitBtn.disabled = false;

            return;
        }

        // Connexion automatique juste après l'inscription, pour
        // enchaîner directement sur l'animation de bienvenue puis le
        // tableau de bord — sans repasser par l'écran de connexion.
        try{

            await apiFetch("/auth/login", {

                method: "POST",

                body: JSON.stringify({ email, mot_de_passe: password })

            });

            afficherAnimationBienvenue(role);

        }catch(error){

            // Cas limite (compte créé mais connexion auto impossible) :
            // on retombe sur l'ancien comportement plutôt que de
            // bloquer l'utilisateur.
            showToast("Compte créé avec succès ! Vous pouvez vous connecter.");

            setTimeout(()=>{

                window.location.href =
                "../connexion/connexion.html";

            }, 1500);

        }

    });

}

/* ==========================
    ANIMATION DE BIENVENUE
========================== */

const MESSAGES_BIENVENUE = {

    locataire: [
        "🎉 Félicitations ! Votre inscription est confirmée.",
        "🏠 Votre prochain chez-vous vous attend peut-être déjà sur TerangaHome.",
        "🔎 Explorez les logements disponibles et trouvez celui qui vous correspond."
    ],

    proprietaire: [
        "🎉 Félicitations ! Votre compte propriétaire est prêt.",
        "🏠 Votre logement mérite d'être découvert par ceux qui le recherchent.",
        "🚀 Publiez votre première annonce et donnez-lui de la visibilité sur TerangaHome."
    ]

};

const DUREE_AFFICHAGE_MESSAGE = 2200;
const DUREE_TRANSITION_MESSAGE = 400;

function attendre(ms){

    return new Promise(resolve => setTimeout(resolve, ms));

}

async function afficherAnimationBienvenue(role){

    const overlay = document.getElementById("welcomeOverlay");
    const texte = document.getElementById("welcomeMessage");
    const dots = document.querySelectorAll("#welcomeDots .welcome-dot");
    const cta = document.getElementById("welcomeCta");

    if(!overlay || !texte) return;

    const messages =
    MESSAGES_BIENVENUE[role] || MESSAGES_BIENVENUE.locataire;

    overlay.classList.add("show");

    await attendre(400);

    for(let i = 0; i < messages.length; i++){

        dots.forEach((dot, index) => dot.classList.toggle("active", index === i));

        texte.classList.remove("visible");

        if(i > 0) await attendre(DUREE_TRANSITION_MESSAGE);

        texte.textContent = messages[i];

        // Force le navigateur à reconnaître le nouvel état avant de
        // rajouter la classe, sinon la transition ne se rejoue pas.
        void texte.offsetWidth;

        texte.classList.add("visible");

        await attendre(DUREE_AFFICHAGE_MESSAGE);

    }

    if(role === "proprietaire"){

        cta?.classList.add("show");

        return;
    }

    texte.classList.remove("visible");

    await attendre(DUREE_TRANSITION_MESSAGE);

    overlay.classList.remove("show");

    await attendre(400);

    window.location.href =
    "../dashboard-proprietaire/dashboard-proprietaire.html";

}
