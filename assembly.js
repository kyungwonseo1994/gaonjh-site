/* The static drawing loads first. Only the hero's canvas responds to scrolling. */
(() => {
  "use strict";
  const figure = document.querySelector(".drawing");
  const hero = document.querySelector(".hero");
  const art = figure.querySelector(".artwork");
  const image = figure.querySelector(".part-image");
  const guides = figure.querySelector(".guides");
  const canvas = figure.querySelector("canvas");
  const controls = figure.querySelector(".view-switch");
  const buttons = [...controls.querySelectorAll("button")];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const ctx = canvas.getContext("2d");
  if (!ctx || !window.gaonPointMap) return;

  const width = 790, height = 660;
  const packed = atob(window.gaonPointMap.points);
  const count = packed.length / 3;
  const sourceX = new Float32Array(count), sourceY = new Float32Array(count);
  const targetX = new Float32Array(count), targetY = new Float32Array(count);
  const phase = new Float32Array(count), delay = new Float32Array(count);
  const bands = window.gaonPointMap.colors.map(() => []);
  const tones = window.gaonPointMap.colors;
  const metals = tones.map(hex => {
    const start = [1,3,5].map(k=>parseInt(hex.slice(k,k+2),16));
    const [r,g,b] = start;
    const bright = r-g>9 && r-b>15 ? [255,185,134] : [220,233,241];
    const tint = .83+.17*(r+g+b)/(3*255);
    return {start, end:bright.map(v=>Math.round(v*tint))};
  });
  let letterMask;
  for (let i=0; i<count; i++) {
    sourceX[i]=packed.charCodeAt(i*3)*width/255;
    sourceY[i]=packed.charCodeAt(i*3+1)*height/255;
    bands[packed.charCodeAt(i*3+2)].push(i);
    // Irrational sequences give the same trajectory after reversing the scroll.
    phase[i]=(i*.61803398875%1)*Math.PI*2;
    delay[i]=.14*(i*.7548776662%1);
  }
  function makeLetters() {
    const mask=document.createElement("canvas");
    mask.width=width;mask.height=height;
    const brush=mask.getContext("2d",{willReadFrequently:true});
    brush.textAlign="center";brush.textBaseline="alphabetic";
    brush.font='700 286px "Gaon Site", "Malgun Gothic", sans-serif';
    const text="B팀", metrics=brush.measureText(text);
    const baseline=(height+metrics.actualBoundingBoxAscent-metrics.actualBoundingBoxDescent)/2;
    brush.fillStyle="#dae9ef";
    brush.fillText(text,width*.50,baseline);
    letterMask=mask;
    const pixels=brush.getImageData(0,0,width,height).data, candidates=[];
    for(let y=2;y<height-2;y+=2)for(let x=2;x<width-2;x+=2){
      const a=(y*width+x)*4+3;
      // Leave a narrow inset so the final dot footprints keep Korean counters open.
      if(pixels[a]>210 && pixels[a-8]>160 && pixels[a+8]>160 &&
          pixels[a-width*8]>160 && pixels[a+width*8]>160)candidates.push(y*width+x);
    }
    if(!candidates.length)return false;
    for(let i=0;i<count;i++){
      const sample=candidates[Math.floor((i*.61803398875%1)*candidates.length)];
      targetX[i]=sample%width;targetY[i]=Math.floor(sample/width);
    }
    return true;
  }
  const clamp=v=>Math.max(0,Math.min(1,v));
  const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
  let position=0, target=0, manualAt=null, active=true, frame=0, previous=0;
  let initialized=false, paintKey=-1, lastShape="";
  const partDescription=image.alt;
  function paint(p) {
    if(paintKey===p)return;
    paintKey=p;
    ctx.setTransform(canvas.width/width,0,0,canvas.height/height,0,0);
    ctx.clearRect(0,0,width,height);
    const dissolve=ease(p/.21);
    image.style.opacity=1-dissolve;guides.style.opacity=1-ease(p/.19);
    if(dissolve>0){
      const settle=ease((p-.57)/.39);
      if(settle>0){
        ctx.globalAlpha=.14*settle;
        ctx.drawImage(letterMask,0,0);
      }
      ctx.globalAlpha=dissolve;
      for(let b=0;b<bands.length;b++){
        const {start,end}=metals[b];
        ctx.fillStyle=settle===0 ? tones[b] :
          "rgb("+start.map((v,j)=>Math.round(v+(end[j]-v)*settle)).join(",")+")";
        for(const i of bands[b]){
          const u=ease((p-delay[i])/(1-delay[i])), spread=Math.sin(Math.PI*u);
          const x=sourceX[i]+(targetX[i]-sourceX[i])*u+spread*85*Math.sin(phase[i]+u*4);
          const y=sourceY[i]+(targetY[i]-sourceY[i])*u+spread*78*Math.cos(phase[i]+u*3);
          const size=2.4+.75*Math.sin(phase[i])+.42*u;
          ctx.fillRect(x-size*.5,y-size*.5,size,size);
        }
      }
      ctx.globalAlpha=1;
    }
    const shape=p>=.5?"type":"part";
    if(shape!==lastShape){
      lastShape=shape;figure.dataset.view=shape;
      image.alt=shape==="part"?partDescription:"같은 로봇 팔 입자가 모여 이룬 ‘B팀’ 글자";
      buttons.forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.shape===shape)));
    }
  }
  function tick(now) {
    frame=0;
    if(!initialized || !active)return;
    const dt=previous?Math.min(64,now-previous):16.7;
    previous=now;
    position=motion.matches?target:position+(target-position)*(1-Math.exp(-dt/110));
    if(Math.abs(target-position)<.001)position=target;
    paint(position);
    if(position!==target)frame=requestAnimationFrame(tick);else previous=0;
  }
  function schedule(){if(!frame && active && initialized)frame=requestAnimationFrame(tick)}
  function followScroll(){
    if(manualAt!==null && Math.abs(scrollY-manualAt)<24)return;
    manualAt=null;
    const rect=hero.getBoundingClientRect();
    const top=document.querySelector(".mast").getBoundingClientRect().height;
    target=motion.matches?0:ease((top-rect.top-8)/Math.max(1,rect.height*.59));
    schedule();
  }
  function resize(){
    const ratio=Math.min(devicePixelRatio||1,2),r=art.getBoundingClientRect();
    canvas.width=Math.max(1,Math.round(r.width*ratio));canvas.height=Math.max(1,Math.round(r.height*ratio));
    paintKey=-1;followScroll();schedule();
  }
  buttons.forEach(b=>b.addEventListener("click",()=>{
    manualAt=scrollY;target=b.dataset.shape==="type"?1:0;schedule();
  }));
  motion.addEventListener("change",()=>{manualAt=null;followScroll()});
  addEventListener("scroll",followScroll,{passive:true});
  new ResizeObserver(resize).observe(art);
  new IntersectionObserver(entries=>{
    active=entries[0].isIntersecting;if(active){followScroll();schedule()}
  }).observe(figure);
  document.fonts.load('700 80px "Gaon Site"',"B팀").catch(()=>{}).then(()=>{
    initialized=makeLetters();
    if(initialized){controls.hidden=false;resize()}
  });
})();
