const visualizer = document.getElementById('visualizer');
const shuffleBtn = document.getElementById('shuffle');
const sortBtn = document.getElementById('sort');
const algorithmSelect = document.getElementById('algorithm');
const speedRange = document.getElementById('speed');
const soundToggle = document.getElementById('soundToggle');
const volumeRange = document.getElementById('volume');

let array = [];
let bars = [];
let isSorting = false;
let isPaused = false;
let ctx = null;
let masterGain = null;

function initAudio(){
  if(!ctx){
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = (volumeRange?.value ?? 60)/100;
    masterGain.connect(ctx.destination);
  }
}

function createArray(n=40){
  array = [];
  for(let i=0;i<n;i++) array.push(Math.random());
  render();
}

function render(){
  visualizer.innerHTML = '';
  bars = [];
  const n = array.length;
  for(let i=0;i<n;i++){
    const el = document.createElement('div');
    el.className = 'bar';
    const h = Math.max(4, Math.round(array[i]*100));
    el.style.height = (h*2.8) + 'px';
    el.dataset.index = i;
    el.title = (Math.round(array[i]*100));
    el.addEventListener('click', ()=>{ if(soundToggle.checked){ playIndex(i) } });
    visualizer.appendChild(el);
    bars.push(el);
  }
}

async function sleep(ms){
  const start = Date.now();
  while(Date.now() - start < ms){
    if(isPaused){
      // wait until resumed
      await new Promise(res=>{
        const check = setInterval(()=>{ if(!isPaused){ clearInterval(check); res(); } }, 60);
      });
    }
    const remain = ms - (Date.now() - start);
    await new Promise(r=>setTimeout(r, Math.min(60, Math.max(0, remain))));
  }
}

function freqForValue(v){
  const min = 150, max = 1200; // 上限を下げて高域を控えめに
  return min + v*(max-min);
}

function playTone(freq, duration=0.16){
  if(!ctx || !masterGain) return;
  const now = ctx.currentTime;

  // メイン: スクエア波で機械的な音色に
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(freq * 1.06, now);
  o.frequency.exponentialRampToValueAtTime(freq, now + 0.02);

  const g = ctx.createGain();
  const attack = 0.002;
  const sustain = 0.22;
  const release = 0.035;
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(sustain, now + attack);
  g.gain.setValueAtTime(sustain, now + attack);
  g.gain.setValueAtTime(sustain, now + duration);
  g.gain.exponentialRampToValueAtTime(0.0001, now + duration + release);

  // ややローパスで高域を抑えて聞きやすく
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = Math.max(700, Math.min(1200, freq * 1.15));
  lp.Q.value = 0.6;

  o.connect(g);
  g.connect(lp);
  lp.connect(masterGain);

  // 短いノイズバーストで機械的な打鍵感を追加（バンドパスで色付け）
  const noiseLen = Math.floor(ctx.sampleRate * 0.03);
  const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for(let i=0;i<noiseLen;i++) d[i] = (Math.random()*2 - 1) * 0.5;
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.max(1200, freq * 2.0);
  bp.Q.value = 6;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, now);
  ng.gain.exponentialRampToValueAtTime(0.12, now + 0.002);
  ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);
  noise.connect(bp);
  bp.connect(ng);
  ng.connect(masterGain);

  o.start(now); o.stop(now + duration + release + 0.02);
  noise.start(now); noise.stop(now + 0.03);
}

function playIndex(i){
  initAudio();
  const f = freqForValue(array[i]);
  playTone(f, 0.14);
}

async function bubbleSort(){
  const n = array.length;
  for(let i=0;i<n-1;i++){
    for(let j=0;j<n-1-i;j++){
      highlight(j,j+1,true);
      if(soundToggle.checked) playTone(freqForValue((array[j]+array[j+1])/2), 0.08);
      await sleep(Math.max(6, 300 - speedRange.value));
      if(array[j] > array[j+1]){
        [array[j], array[j+1]] = [array[j+1], array[j]];
        updateBars(j,j+1);
        if(soundToggle.checked) playTone(freqForValue((array[j]+array[j+1])/2), 0.12);
        await sleep(Math.max(6, 180 - speedRange.value));
      }
      highlight(j,j+1,false);
    }
  }
}

async function selectionSort(){
  const n = array.length;
  for(let i=0;i<n-1;i++){
    let minIdx = i;
    for(let j=i+1;j<n;j++){
      highlight(minIdx,j,true);
      if(soundToggle.checked) playTone(freqForValue((array[minIdx]+array[j])/2), 0.07);
      await sleep(Math.max(6, 300 - speedRange.value));
      if(array[j] < array[minIdx]){
        highlight(minIdx,j,false);
        minIdx = j;
        highlight(minIdx,j,true);
      }
      highlight(minIdx,j,false);
    }
    if(minIdx !== i){
      [array[i], array[minIdx]] = [array[minIdx], array[i]];
      updateBars(i,minIdx);
      if(soundToggle.checked) playTone(freqForValue((array[i]+array[minIdx])/2), 0.14);
      await sleep(Math.max(6, 150 - (speedRange.value/2)));
    }
  }
}

function updateBars(i,j){
  const hi = Math.max(4, Math.round(array[i]*100));
  const hj = Math.max(4, Math.round(array[j]*100));
  bars[i].style.height = (hi*2.8)+'px';
  bars[j].style.height = (hj*2.8)+'px';
}

function highlight(i,j,on){
  bars[i]?.classList.toggle('compare', on);
  bars[j]?.classList.toggle('compare', on);
}

async function startSort(){
  if(isSorting) return;
  isSorting = true;
  shuffleBtn.disabled = true; sortBtn.disabled = true; algorithmSelect.disabled = true;
  pauseResumeBtn.disabled = false; pauseResumeBtn.textContent = '一時停止';
  initAudio();
  const alg = algorithmSelect.value;
  if(alg==='bubble') await bubbleSort();
  else if(alg==='selection') await selectionSort();
  shuffleBtn.disabled = false; sortBtn.disabled = false; algorithmSelect.disabled = false;
  pauseResumeBtn.disabled = true; pauseResumeBtn.textContent = '一時停止';
  isSorting = false;
}

shuffleBtn.addEventListener('click', ()=>{ if(isSorting) return; createArray(array.length); });
sortBtn.addEventListener('click', ()=>{ startSort(); });
window.addEventListener('resize', ()=>{ render(); });

volumeRange?.addEventListener('input', ()=>{
  if(masterGain) masterGain.gain.value = volumeRange.value/100;
});

// Pause / Resume handling
const pauseResumeBtn = document.getElementById('pauseResume');
pauseResumeBtn?.addEventListener('click', ()=>{
  if(!isSorting) return;
  isPaused = !isPaused;
  pauseResumeBtn.textContent = isPaused ? '再開' : '一時停止';
});

// init
createArray(48);
