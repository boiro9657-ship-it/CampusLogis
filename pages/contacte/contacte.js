/* ==========================================================
   CONTACTE.JS — page contact uniquement
   ========================================================== */

const contactForm =
document.getElementById("contactForm");

if(contactForm){

    contactForm.addEventListener("submit", async (e)=>{

        e.preventDefault();

        const nom =
        document.getElementById("nom").value.trim();

        const email =
        document.getElementById("email").value.trim();

        const sujet =
        document.getElementById("sujet").value.trim();

        const message =
        document.getElementById("message").value.trim();

        if(!nom || !email || !sujet || !message){

            showToast("Veuillez remplir tous les champs.", "error");

            return;
        }

        const submitBtn =
        contactForm.querySelector("button[type='submit']");

        submitBtn.disabled = true;

        try{

            await apiFetch("/contact", {

                method: "POST",

                body: JSON.stringify({ nom, email, sujet, message })

            });

            showToast("Message envoyé ! Nous vous répondrons rapidement.");

            contactForm.reset();

        }catch(error){

            showToast("Impossible d'envoyer le message pour le moment.", "error");

        }finally{

            submitBtn.disabled = false;

        }

    });

}
