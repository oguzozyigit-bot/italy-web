import { mountShell } from "/js/ui_shell.js";
import { supabase } from "/js/supabase_client.js";
import { loadLangPool } from "/js/langpool.js";

mountShell({scroll:"none"});

const $ = id=>document.getElementById(id);

const SIZE = 10;
const GAME_TIME = 120;

let grid = [];
let words = [];
let found = new Set();
let selecting = [];
let score = 0;
let timer = GAME_TIME;
let userId = null;

async function init(){
  const { data:{session} } = await supabase.auth.getSession();
  if(!session) location.href="/pages/login.html";
  userId = session.user.id;

  const { data:prof } = await supabase.from("profiles").select("wordsearch_best").eq("id",userId).single();
  $("best").textContent = prof?.wordsearch_best || 0;

  const pool = await loadLangPool("en");
  words = pool.items.slice(0,8).map(x=>x.w.toUpperCase());
  $("trWord").textContent = pool.items[0]?.tr || "";

  buildGrid();
  renderGrid();
  renderWordList();
  startTimer();
}

function buildGrid(){
  grid = Array(SIZE).fill().map(()=>Array(SIZE).fill(""));

  words.forEach(word=>{
    let placed=false;
    while(!placed){
      let r = Math.floor(Math.random()*SIZE);
      let c = Math.floor(Math.random()*SIZE);
      let dir = Math.random()>.5 ? 1:0; // 1=horizontal
      if(dir && c+word.length<=SIZE){
        for(let i=0;i<word.length;i++) grid[r][c+i]=word[i];
        placed=true;
      }
      if(!dir && r+word.length<=SIZE){
        for(let i=0;i<word.length;i++) grid[r+i][c]=word[i];
        placed=true;
      }
    }
  });

  const ABC="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      if(!grid[r][c]) grid[r][c]=ABC[Math.floor(Math.random()*26)];
    }
  }
}

function renderGrid(){
  const g=$("grid");
  g.innerHTML="";
  for(let r=0;r<SIZE;r++){
    for(let c=0;c<SIZE;c++){
      const div=document.createElement("div");
      div.className="cell";
      div.textContent=grid[r][c];
      div.dataset.r=r;
      div.dataset.c=c;

      div.onmousedown=()=>startSelect(r,c);
      div.onmouseenter=()=>extendSelect(r,c);
      div.onmouseup=finishSelect;

      g.appendChild(div);
    }
  }
}

function renderWordList(){
  $("wordList").innerHTML = words.map(w=>{
    return `<span class="${found.has(w)?"done":""}">${w}</span>`;
  }).join("");
}

function startSelect(r,c){
  selecting=[{r,c}];
  highlight();
}

function extendSelect(r,c){
  if(selecting.length){
    selecting.push({r,c});
    highlight();
  }
}

function highlight(){
  document.querySelectorAll(".cell").forEach(x=>x.classList.remove("sel"));
  selecting.forEach(s=>{
    document.querySelector(`.cell[data-r="${s.r}"][data-c="${s.c}"]`).classList.add("sel");
  });
}

function finishSelect(){
  const word = selecting.map(s=>grid[s.r][s.c]).join("");
  if(words.includes(word) && !found.has(word)){
    found.add(word);
    score += word.length*20;
    selecting.forEach(s=>{
      document.querySelector(`.cell[data-r="${s.r}"][data-c="${s.c}"]`).classList.add("found");
    });
  }
  selecting=[];
  renderWordList();
}

function startTimer(){
  const t = setInterval(()=>{
    timer--;
    $("timer").textContent=timer;
    if(timer<=0){
      clearInterval(t);
      endGame();
    }
  },1000);
}

async function endGame(){
  const { data:prof } = await supabase.from("profiles").select("wordsearch_best").eq("id",userId).single();
  if(score > (prof?.wordsearch_best||0)){
    await supabase.from("profiles").update({wordsearch_best:score}).eq("id",userId);
  }
  alert("Süre doldu! Skor: "+score);
  location.reload();
}

init();
