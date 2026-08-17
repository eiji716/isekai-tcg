(()=>{
  const VERSION='Ver.0.5.3';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const sess=()=>({room:sessionStorage.tcg_room||'',token:sessionStorage.tcg_token||''});
  let reactionBusy=false, latest=null, stateBusy=false, awakenBusy=false, reactionStart=0;

  const style=document.createElement('style');
  style.textContent=`
    button[data-react][data-v053="1"]{pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:999!important;min-height:64px!important;opacity:1!important;user-select:none!important;-webkit-user-select:none!important}
    button[data-react=""][data-v053="1"]{border:2px solid #e1bd67!important;background:#43361d!important;color:#fff7df!important;box-shadow:0 0 0 1px #745d2e inset!important}
    button[data-react][data-v053="1"].sending053{filter:brightness(1.15);transform:scale(.98)}
    #awakeningMini{margin-left:2px;padding:2px 4px!important;min-height:0!important;height:18px!important;line-height:1!important;border-radius:6px!important;font-size:7px!important;white-space:nowrap;background:#21172f!important;border:1px solid #594276!important;color:#d9c8ff!important}
    #awakeningMini.ready{background:#56348a!important;border-color:#a985e6!important;color:white!important;box-shadow:0 0 8px #8e5fe466}
    #awakeningMini:disabled{opacity:.72!important;cursor:default!important}
    .awakenOverlay053{position:fixed;z-index:10000;inset:0;background:#000d;display:flex;align-items:center;justify-content:center;padding:16px}
    .awakenBox053{width:min(420px,100%);background:#111521;border:1px solid #7054b8;border-radius:16px;padding:14px;color:#fff}
    .awakenBox053 h2{margin:0 0 6px;font-size:18px}.awakenBox053 p{margin:0 0 10px;color:#bbb;font-size:11px}
    .awakenChoices053{display:grid;gap:7px}.awakenChoices053 button{width:100%;text-align:left;padding:10px}.awakenChoices053 b{display:block}.awakenChoices053 small{display:block;margin-top:3px;color:#ccc}
    .awakenCancel053{width:100%;margin-top:8px}
  `;
  document.head.appendChild(style);

  function markVersion(){
    const p=document.querySelector('.lobby>p');
    if(p&&p.textContent!==VERSION)p.textContent=VERSION;
    const info=document.querySelector('.lobby .info');
    const html='初期手札6枚／毎ターン2枚ドロー<br>カード約307種類／MP上限15<br>3ターンごとの運命イベント／逆境覚醒';
    if(info&&info.innerHTML!==html)info.innerHTML=html;
  }

  function showButtonError(btn,msg){
    if(!btn?.isConnected)return;
    btn.disabled=false;btn.classList.remove('sending053');
    btn.innerHTML=`<span>⚠️</span><b>もう一度押す</b><small style="display:block;color:#ffbcbc;margin-top:3px">${String(msg||'通信エラー').slice(0,40)}</small>`;
  }

  async function sendReaction(btn){
    if(reactionBusy||!btn?.isConnected)return;
    reactionBusy=true;
    const iid=btn.getAttribute('data-react')||'';
    const path=iid?'/api/react':'/api/accept';
    btn.disabled=true;btn.classList.add('sending053');
    btn.innerHTML=iid?'<span>⏳</span><b>リアクション処理中…</b>':'<span>⏳</span><b>ダメージ確定中…</b>';
    let last='通信エラー';
    for(let n=0;n<3;n++){
      try{
        const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({...sess(),...(iid?{iid}:{})})});
        const d=await r.json().catch(()=>({}));
        if(r.ok){
          btn.innerHTML='<span>✓</span><b>確定</b>';
          await sleep(80);location.reload();return;
        }
        last=d.error||`HTTP ${r.status}`;
        if(r.status===400||r.status===409){await sleep(80);location.reload();return;}
      }catch(e){last=e?.message||'通信エラー'}
      await sleep(180);
    }
    reactionBusy=false;showButtonError(btn,last);
  }

  function armReactionButtons(){
    const any=document.querySelector('button[data-react]');
    if(any&&!reactionStart)reactionStart=Date.now();
    if(!any)reactionStart=0;
    document.querySelectorAll('button[data-react]:not([data-v053])').forEach(old=>{
      const btn=old.cloneNode(true);
      btn.setAttribute('data-v053','1');
      btn.removeAttribute('onclick');
      old.replaceWith(btn);
      let fired=false;
      const go=e=>{
        if(fired)return;
        if(e?.type==='pointerup'&&e.pointerType==='mouse'&&e.button!==0)return;
        fired=true;
        e?.preventDefault?.();e?.stopPropagation?.();e?.stopImmediatePropagation?.();
        void sendReaction(btn).finally(()=>{if(btn?.isConnected&&!btn.disabled)fired=false});
      };
      btn.addEventListener('pointerup',go,{capture:true});
      btn.addEventListener('touchend',go,{capture:true,passive:false});
      btn.addEventListener('click',go,{capture:true});
    });
  }

  async function fetchState(){
    const q=sess();if(!q.room||!q.token||stateBusy)return latest;
    stateBusy=true;
    try{const r=await fetch(`/api/room?room=${encodeURIComponent(q.room)}&token=${encodeURIComponent(q.token)}&v=053`,{cache:'no-store'});if(r.ok)latest=await r.json()}catch(_){}finally{stateBusy=false}
    return latest;
  }

  function renderAwakeningMini(){
    const ps=[...document.querySelectorAll('.player')];
    const me=ps.at(-1);if(!me||!latest?.awakening)return;
    const a=latest.awakening,g=Math.max(0,Math.min(100,Math.floor(Number(a.gauge)||0)));
    let b=document.getElementById('awakeningMini');
    if(!b){b=document.createElement('button');b.id='awakeningMini';me.appendChild(b)}
    b.className=a.canUse?'ready':'';
    b.disabled=!a.canUse;
    b.textContent=a.used?'🌌済':`🌌${g}`;
    b.title=a.used?'逆境覚醒 使用済み':`逆境覚醒 ${g}/100`;
  }

  function openAwaken(){
    if(!latest?.awakening?.canUse||document.querySelector('.awakenOverlay053'))return;
    const el=document.createElement('div');el.className='awakenOverlay053';
    el.innerHTML=`<div class="awakenBox053"><h2>🌌 逆境覚醒</h2><p>1試合に1回だけ使えます。</p><div class="awakenChoices053"><button data-awaken053="rebirth"><b>✨ 再起の光</b><small>HP10回復＋2枚ドロー＋MP2回復</small></button><button data-awaken053="uprising"><b>⚔️ 反攻の号令</b><small>味方全員ATK+2 / HP+2＋MP4回復</small></button><button data-awaken053="destiny"><b>🌌 運命召喚</b><small>6/7 守護・疾走を召喚＋1枚ドロー</small></button></div><button class="awakenCancel053">戻る</button></div>`;
    document.body.appendChild(el);
  }

  async function awaken(choice,btn){
    if(awakenBusy)return;awakenBusy=true;btn.disabled=true;const old=btn.innerHTML;btn.innerHTML='<b>発動中…</b>';
    try{const r=await fetch('/api/awaken',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({...sess(),choice})});if(r.ok){await sleep(80);location.reload();return}}catch(_){}
    awakenBusy=false;btn.disabled=false;btn.innerHTML=old;
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#awakeningMini')){e.preventDefault();openAwaken();return}
    if(e.target.closest?.('.awakenCancel053')){e.preventDefault();document.querySelector('.awakenOverlay053')?.remove();return}
    const b=e.target.closest?.('[data-awaken053]');if(b){e.preventDefault();void awaken(b.dataset.awaken053,b)}
  },true);

  async function tick(){markVersion();armReactionButtons();if(reactionStart&&!reactionBusy&&Date.now()-reactionStart>=12000){const a=document.querySelector('button[data-react=""][data-v053="1"]');if(a){reactionStart=0;void sendReaction(a)}}await fetchState();renderAwakeningMini()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void tick(),{once:true});else void tick();
  setInterval(()=>void tick(),250);
})();
