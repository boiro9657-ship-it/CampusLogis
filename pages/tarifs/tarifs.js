/* ==========================================================
   TARIFS.JS — page tarifs uniquement
   ========================================================== */

document.querySelectorAll("[data-plan]").forEach(btn => {

    btn.addEventListener("click", async () => {

        const plan = btn.dataset.plan;

        if(plan !== "Premium"){

            showToast(
                "Formule " + plan + " : contactez notre équipe pour en profiter.",
                "error"
            );

            return;
        }

        const texteOriginal = btn.textContent;

        btn.disabled = true;
        btn.textContent = "Redirection vers le paiement...";

        try{

            const donnees =
            await apiFetch("/paiements/creer", {
                method: "POST",
                body: JSON.stringify({ plan: "premium", origine: "tarifs" }),
            });

            window.location.href = donnees.invoice_url;

        }catch(error){

            if(error.status === 401){

                showToast("Connectez-vous d'abord pour passer au Premium.", "error");

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

    const messages = {
        succes:     ["Paiement confirmé ! Votre formule Premium est active.", "success"],
        echec:      ["Le paiement n'a pas abouti. Vous n'avez pas été débité.", "error"],
        annule:     ["Paiement annulé.", "error"],
        en_attente: ["Paiement en cours de traitement, cela peut prendre quelques instants.", "error"],
    };

    const [message, type] = messages[paiement] || [];

    if(message) showToast(message, type);

    // Nettoie l'URL pour ne pas redéclencher le toast au rechargement.
    params.delete("paiement");

    const nouvelleUrl =
    window.location.pathname + (params.toString() ? "?" + params.toString() : "");

    window.history.replaceState({}, "", nouvelleUrl);

})();
