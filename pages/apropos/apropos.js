/* ==========================================================
   APROPOS.JS — page à propos uniquement
   Charge les vraies statistiques de la plateforme (jamais de
   chiffres inventés).
   ========================================================== */

(async () => {

    let stats;

    try{

        stats = await apiFetch("/logements/stats");

    }catch(error){

        return;
    }

    const statLogements = document.getElementById("aboutStatLogements");
    const statProprietaires = document.getElementById("aboutStatProprietaires");
    const statVilles = document.getElementById("aboutStatVilles");

    if(statLogements) statLogements.textContent = stats.logements;
    if(statProprietaires) statProprietaires.textContent = stats.proprietaires;
    if(statVilles) statVilles.textContent = stats.villes;

})();
