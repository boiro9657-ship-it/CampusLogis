const counters = document.querySelectorAll(".counter");

const startCounter = (counter) => {

    const target = +counter.dataset.target;

    let count = 0;

    const increment = target / 150;

    const update = () => {

        count += increment;

        if(count < target){

            counter.innerText = Math.floor(count);

            requestAnimationFrame(update);

        }else{

            counter.innerText = target.toLocaleString() + "+";

        }

    };

    update();

};

const observer = new IntersectionObserver((entries)=>{

    entries.forEach(entry=>{

        if(entry.isIntersecting){

            startCounter(entry.target);

            observer.unobserve(entry.target);

        }

    });

});

counters.forEach(counter=>{

    observer.observe(counter);

});

const questions = document.querySelectorAll(".faq-question");

questions.forEach(question => {

    question.addEventListener("click", () => {

        const answer = question.nextElementSibling;

        if(answer.style.maxHeight){

            answer.style.maxHeight = null;

            question.querySelector("span").innerHTML = "+";

        }else{

            answer.style.maxHeight = answer.scrollHeight + "px";

            question.querySelector("span").innerHTML = "−";

        }

    });

});

const togglePassword =
document.getElementById("togglePassword");

const password =
document.getElementById("password");

if(togglePassword && password){

    togglePassword.addEventListener("click",()=>{

        if(password.type==="password"){

            password.type="text";

            togglePassword.classList.replace(
                "fa-eye",
                "fa-eye-slash"
            );

        }else{

            password.type="password";

            togglePassword.classList.replace(
                "fa-eye-slash",
                "fa-eye"
            );

        }

    });

}


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

            console.log(photo);
            console.log(photo.files);
            console.log(photo.files.length);
            
             console.log(photo);
            console.log(fichiers);
            console.log(photo);
            console.log(photo.files);

            if(!fichiers){

            alert(
                "Veuillez sélectionner une image."
            );

            return;

            }
            let images = [];
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
                "dashboard-proprietaire.html";

            };

            reader.readAsDataURL(
                fichiers[0]
            );

        }
    );

}

const container =
document.getElementById(
    "annonces-container"
);

if(container){

    const logements =
    JSON.parse(
        localStorage.getItem(
            "logements"
        )
    ) || [];

    logements.forEach(
        logement => {

            container.innerHTML += `
            <div class="property-card">

                ${
                    logement.image
                    ?
                    `<img
                        src="${logement.image}"
                        class="property-image">`
                    :
                    ""
                }

                <div class="property-content">

                    <h3>${logement.titre}</h3>

                    <p>📍 ${logement.ville}</p>

                    <p>💰 ${logement.prix} FCFA</p>

                    <p>🛏 ${logement.chambres} chambre(s)</p>

                    <p>${logement.description}</p>

                    <button onclick="supprimerLogement(${logement.id})">
                    🗑 Supprimer
                    </button>

                    <button onclick="modifierLogement(${logement.id})">
                    ✏ Modifier
                    </button>

                </div>

            </div>
            `;

        }
    );

}

function supprimerLogement(id){

    let logements =
    JSON.parse(
        localStorage.getItem("logements")
    ) || [];

    logements = logements.filter(
        logement => logement.id !== id
    );

    localStorage.setItem(
        "logements",
        JSON.stringify(logements)
    );

    location.reload();
}

function modifierLogement(id){

    localStorage.setItem(
        "logementAModifier",
        id
    );

    window.location.href =
    "publier-logement.html";
}

const menuToggle =
document.querySelector(".menu-toggle");

const navLinks =
document.querySelector(".nav-links");

const navButtons =
document.querySelector(".nav-buttons");

if(menuToggle && navLinks){

    menuToggle.addEventListener("click",()=>{

        navLinks.classList.toggle("active");

    navButtons.classList.toggle("active");

    const icon =
    menuToggle.querySelector("i");

    if(navLinks.classList.contains("active")){

        icon.classList.replace(
            "fa-bars",
            "fa-xmark"
        );

    }else{

        icon.classList.replace(
            "fa-xmark",
            "fa-bars"
        );

    }

});
}

/* ==========================
       RETOUR EN HAUT
========================== */

const scrollTopBtn =
document.getElementById("scrollTop");

if(scrollTopBtn){

    window.addEventListener("scroll",()=>{

        if(window.scrollY > 300){

            scrollTopBtn.style.display =
            "block";

        }else{

            scrollTopBtn.style.display =
            "none";

        }

    });

    scrollTopBtn.addEventListener("click",()=>{

        window.scrollTo({

            top:0,

            behavior:"smooth"

        });

    });

}

function showToast(message){

    const toast =
    document.getElementById("toast");

    toast.innerHTML =
    "✅ " + message;

    toast.classList.add("show");

    setTimeout(()=>{

        toast.classList.remove("show");

    },3000);

}

// ==========================
//      GESTION DES FAVORIS
// ==========================

// Sélectionne tous les boutons favoris
const favorites =
document.querySelectorAll(".favorite");

// Récupère les favoris déjà enregistrés
let favoris =
JSON.parse(
    localStorage.getItem("favoris")
) || [];

// Parcourt chaque bouton favori
favorites.forEach(button=>{

    // Récupère l'identifiant du logement
    const id =
    button.dataset.id;

    // Si le logement est déjà dans les favoris,
    // le cœur devient rouge au chargement de la page
    if(favoris.includes(id)){

        button.classList.add("active");

    }

    // Action lors d'un clic sur le cœur
    button.addEventListener("click",()=>{

        // Vérifie si le logement est déjà en favori
        if(favoris.includes(id)){

            // Supprime le logement des favoris
            favoris =
            favoris.filter(
                favori =>
                favori !== id
            );

            // Retire la couleur rouge
            button.classList.remove("active");

        }else{

            // Ajoute le logement aux favoris
            favoris.push(id);

            // Colore le cœur en rouge
            button.classList.add("active");

        }

        // Sauvegarde les favoris dans LocalStorage
        localStorage.setItem(

            "favoris",

            JSON.stringify(favoris)

        );

    });

});

// ==========================
//      PAGE FAVORIS
// ==========================

// Sélectionne le conteneur qui va afficher les favoris
const favorisContainer =
document.getElementById(
    "favoris-container"
);

// Vérifie que l'on est bien sur la page favoris
if(favorisContainer){

    // Récupère les identifiants des logements favoris
    const favoris =
    JSON.parse(
        localStorage.getItem("favoris")
    ) || [];

    // Si aucun favori n'existe
if(favoris.length === 0){

    favorisContainer.innerHTML = `

        <h2>

            Vous n'avez encore
            aucun logement favori.

        </h2>

    `;

}else{
        // Parcourt chaque logement favori
        favoris.forEach(id=>{

            favorisContainer.innerHTML += `

            <div class="similar-card">

                <img
                src="images/logement${id}.jpg.png"
                alt="Logement">

                <div class="similar-content">

                    <h3>

                        Logement ${id}

                    </h3>

                    <p>

                        ❤️ Ajouté aux favoris

                    </p>

                    <a
                    href="details-logement.html">

                        Voir les détails

                    </a>

                </div>

            </div>

     `;

    });

}
}

