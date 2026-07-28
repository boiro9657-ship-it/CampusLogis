const form =
document.querySelector(".search-page-box");

if(form){

    form.addEventListener("submit",(e)=>{

        e.preventDefault();

        console.log("Recherche lancée");

    });

}