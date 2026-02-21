// FILE: /js/site_nav.js
(function(){
  const nav = document.getElementById("topNav");
  if(!nav) return;

  const links = Array.from(nav.querySelectorAll(".navlink"));
  function setActive(el){
    links.forEach(a => a.classList.remove("active"));
    if(el) el.classList.add("active");
  }

  // click -> active
  links.forEach(a=>{
    a.addEventListener("click", ()=>{
      setActive(a);
    });
  });

  // scroll spy (isteğe bağlı ama çok iyi durur)
  const ids = links
    .map(a => (a.getAttribute("href")||"").replace("#",""))
    .filter(Boolean);

  const sections = ids
    .map(id => document.getElementById(id))
    .filter(Boolean);

  if(!sections.length) return;

  const obs = new IntersectionObserver((entries)=>{
    const hit = entries
      .filter(e=>e.isIntersecting)
      .sort((a,b)=>b.intersectionRatio - a.intersectionRatio)[0];
    if(!hit) return;

    const id = hit.target.id;
    const link = links.find(a => a.getAttribute("href") === "#"+id);
    if(link) setActive(link);
  }, { root:null, threshold:[0.25, 0.45, 0.6] });

  sections.forEach(s=>obs.observe(s));
})();
