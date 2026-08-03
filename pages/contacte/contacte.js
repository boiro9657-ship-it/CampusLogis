/* ==========================================================
   CONTACTE.JS — page contact uniquement
   ========================================================== */

const contactForm =
document.getElementById("contactForm");

if(contactForm){

    contactForm.addEventListener("submit",(e)=>{

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

            showToast("Veuillez remplir tous les champs.");

            return;
        }

        showToast("Message envoyé ! Nous vous répondrons rapidement.");

        contactForm.reset();

    });

}
