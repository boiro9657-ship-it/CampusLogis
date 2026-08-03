/* ==========================================================
   RECHERCHER.JS — page de recherche uniquement
   ========================================================== */

/* ==========================
    FORMULAIRE DE RECHERCHE
========================== */

const form =
document.querySelector(".search-page-box");

if(form){

    // Pré-remplit le formulaire à partir des paramètres
    // transmis depuis la recherche du hero (accueil).
    const params = new URLSearchParams(window.location.search);

    const villeInput = document.getElementById("searchVille");
    const typeSelect = document.getElementById("searchType");

    if(params.get("ville") && villeInput){

        villeInput.value = params.get("ville");

    }

    if(params.get("type") && typeSelect){

        typeSelect.value = params.get("type");

    }

    form.addEventListener("submit",(e)=>{

        e.preventDefault();

        console.log("Recherche lancée");

    });

}

/* ==========================
    GESTION DES FAVORIS
========================== */

const favorites =
document.querySelectorAll(".favorite");

let favoris =
JSON.parse(
    localStorage.getItem("favoris")
) || [];

favorites.forEach(button=>{

    const id =
    button.dataset.id;

    if(favoris.includes(id)){

        button.classList.add("active");

    }

    button.addEventListener("click",()=>{

        if(favoris.includes(id)){

            favoris =
            favoris.filter(
                favori =>
                favori !== id
            );

            button.classList.remove("active");

        }else{

            favoris.push(id);

            button.classList.add("active");

        }

        localStorage.setItem(

            "favoris",

            JSON.stringify(favoris)

        );

    });

});
