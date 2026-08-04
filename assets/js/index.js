/* ==========================================================
   INDEX.JS — page d'accueil uniquement
   Compteurs animés, accordéon FAQ, gestion des favoris.
   ========================================================== */

/* ==========================
    RÉVÉLATION AU SCROLL
========================== */

const revealElements =
document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver((entries) => {

    entries.forEach(entry => {

        if(entry.isIntersecting){

            entry.target.classList.add("revealed");

            revealObserver.unobserve(entry.target);

        }

    });

}, { threshold:.15 });

revealElements.forEach(el => revealObserver.observe(el));

/* ==========================
    ONGLETS DE LA CARTE DE RECHERCHE
========================== */

const searchTabs =
document.querySelectorAll(".search-tab");

const heroTypeInput =
document.getElementById("heroType");

searchTabs.forEach(tab => {

    tab.addEventListener("click", () => {

        searchTabs.forEach(t => t.classList.remove("active"));

        tab.classList.add("active");

        if(heroTypeInput){

            heroTypeInput.value = tab.dataset.type;

        }

    });

});

/* ==========================
    RECHERCHE DU HERO
========================== */

const heroSearchForm =
document.getElementById("heroSearchForm");

if(heroSearchForm){

    heroSearchForm.addEventListener("submit", (e) => {

        e.preventDefault();

        const ville =
        document.getElementById("heroVille").value.trim();

        const type =
        document.getElementById("heroType").value;

        const budget =
        document.getElementById("heroBudget").value;

        const params = new URLSearchParams();

        if(ville) params.set("ville", ville);
        if(type) params.set("type", type);
        if(budget) params.set("budget", budget);

        window.location.href =
        "pages/rechercher/rechercher.html" +
        (params.toString() ? "?" + params.toString() : "");

    });

}

/* ==========================
    COMPTEURS ANIMÉS
========================== */

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

/* ==========================
    ACCORDÉON FAQ
========================== */

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

/* ==========================
    GESTION DES FAVORIS
========================== */

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
