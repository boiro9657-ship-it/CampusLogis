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