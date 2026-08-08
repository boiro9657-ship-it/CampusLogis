/* ==========================================================
   TARIFS.JS — page tarifs uniquement
   ========================================================== */

const PLANS_PAYANTS = ["Premium", "Pro"];

document.querySelectorAll("[data-plan]").forEach(btn => {

    btn.addEventListener("click", async () => {

        const plan = btn.dataset.plan;

        if(!PLANS_PAYANTS.includes(plan)){
            return;
        }

        const texteOriginal = btn.textContent;

        btn.disabled = true;
        btn.textContent = "Redirection vers le paiement...";

        try{

            const donnees =
            await apiFetch("/paiements/creer", {
                method: "POST",
                body: JSON.stringify({ plan: plan.toLowerCase(), origine: "tarifs" }),
            });

            window.location.href = donnees.invoice_url;

        }catch(error){

            if(error.status === 401){

                showToast("Connectez-vous d'abord pour passer au " + plan + ".", "error");

                setTimeout(() => {
                    window.location.href = "../connexion/connexion.html";
                }, 1500);

            }else{

                showToast(error.message || "Impossible de démarrer le paiement.", "error");

            }

            btn.disabled = false;
            btn.textContent = texteOriginal;

        }

    });

});

/* ==========================================================
   RETOUR DEPUIS PAYDUNYA (succès, échec, annulation, en attente)
   ========================================================== */

(() => {

    const params =
    new URLSearchParams(window.location.search);

    const paiement =
    params.get("paiement");

    if(!paiement) return;

    const planPaye =
    params.get("plan") === "pro" ? "Pro" : "Premium";

    const messages = {
        succes:     [`Paiement confirmé ! Votre formule ${planPaye} est active.`, "success"],
        echec:      ["Le paiement n'a pas abouti. Vous n'avez pas été débité.", "error"],
        annule:     ["Paiement annulé.", "error"],
        en_attente: ["Paiement en cours de traitement, cela peut prendre quelques instants.", "error"],
    };

    const [message, type] = messages[paiement] || [];

    if(message) showToast(message, type);

    // Nettoie l'URL pour ne pas redéclencher le toast au rechargement.
    params.delete("paiement");
    params.delete("plan");

    const nouvelleUrl =
    window.location.pathname + (params.toString() ? "?" + params.toString() : "");

    window.history.replaceState({}, "", nouvelleUrl);

})();
