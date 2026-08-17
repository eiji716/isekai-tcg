(()=>{
  const VERSION='Ver.0.5.2';
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const session=()=>({room:sessionStorage.tcg_room||'',token:sessionStorage.tcg_token||''});
  let latest=null, fetching=false, reactionBusy=false, reactionLockUntil=0, awakenBusy=false, lastAwakenSig='';

  const style=document.createElement('style');
  style.textContent=`
    .modal button[data-react]{pointer-events:auto!important;touch-action:manipulation!important;position:relative!important;z-index:100!important;min-height:72px!important;user-select:none;-webkit-user-select:none}
    .modal button[data-react=""]{border:2px solid #dbb760!important;background:#3b301b!important;box-shadow:0 0 0 1px #5b4724 inset!important}
    .modal button[data-react].rf-busy{opacity:.72!important;transform:scale(.98)!important}
    .reactionAid{margin:6px 0 10px;padding:8px 10px;border-radius:9px;background:#182235;border:1px solid #38537d;color:#cfe3ff;font-size:12px;line-height:1.35}
    #awakeningPanel{margin:6px 10px 8px;padding:8px 10px;border:1px solid #7b5bca;border-radius:12px;background:linear-gradient(90deg,#171126,#24163a);font-size:12px;color:#eee;display:flex;align-items:center;gap:8px}
    #awakeningPanel b{white-space:nowrap}#awakeningPanel .gauge{flex:1;height:9px;border-radius:999px;background:#090811;overflow:hidden;border:1px solid #50436a}
    #awakeningPanel .gauge i{display:block;height:100%;background:linear-gradient(90deg,#7c5cff,#ff5fb5)}
    #awakeningPanel button{padding:7px 10px;border-radius:9px;border:1px solid #b899ff;background:#6e48c9;color:#fff;font-weight:800}
    #awakeningPanel.used{opacity:.55}.awakenOverlay{position:fixed;z-index:10000;inset:0;background:#000c;display:flex;align-items:center;justify-content:center;padding:18px}
    .awakenBox{width:min(430px,100%);background:#111521;border:1px solid #7054b8;border-radius:18px;padding:16px;color:#fff;box-shadow:0 20px 60px #000}
    .awakenChoices{display:grid;gap:9px}.awakenChoices button{display:block;width:100%;text-align:left;padding:12px;border-radius:12px;border:1px solid #49405f;background:#1a1f2c;color:#fff}
    .awakenChoices button b{display:block;font-size:15px}.awakenChoices button small{display:block;margin-top:4px;color:#ccc;line-height:1.35}.awakenCancel{margin-top:10px;width:100%;padding:10px}
  `;
  document.head.appendChild(style);

  function markUI(){
    const p=document.querySelector('.lobby>p');
    if(p&&p.textContent!==VERSION)p.textContent=VERSION;
    const info=document.querySelector('.lobby .info');
    const html='初期手札6枚／毎ターン2枚ドロー<br>カード約307種類／MP上限15<br>3ターンごとの運命イベント／逆境覚醒システム';
    if(info&&info.innerHTML!==html)info.innerHTML=html;
    const modal=[...document.querySelectorAll('.modal')].find(m=>m.querySelector('button[data-react]'));
    if(modal&&!modal.querySelector('.reactionAid')){
      const n=document.createElement('div');
      n.className='reactionAid';
      n.textContent='🛡 防御・回避・反射・カウンター、または「受ける」を選択できます。防御補助MP2あり。';
      modal.querySelector('.choices')?.before(n);
    }
  }

  async function fetchState(force=false){
    const q=session();
    if(!q.room||!q.token||fetching)return latest;
    fetching=true;
    try{
      const r=await fetch(`/api/room?room=${encodeURIComponent(q.room)}&token=${encodeURIComponent(q.token)}&v=052&t=${force?Date.now():''}`,{cache:'no-store'});
      if(r.ok)latest=await r.json();
    }catch(_){
    }finally{fetching=false}
    return latest;
  }

  function renderAwakening(){
    const frame=document.querySelector('.screen .frame'),hand=document.querySelector('.handarea');
    if(!frame||!hand||!latest?.awakening)return;
    const a=latest.awakening,g=Math.max(0,Math.min(100,Number(a.gauge)||0));
    const sig=`${a.used?1:0}|${a.canUse?1:0}|${g}`;
    let p=document.getElementById('awakeningPanel');
    if(!p){p=document.createElement('div');p.id='awakeningPanel';frame.insertBefore(p,hand);lastAwakenSig=''}
    if(sig===lastAwakenSig)return;
    lastAwakenSig=sig;
    p.className=a.used?'used':'';
    p.innerHTML=`<b>🌌 逆境覚醒 ${a.used?'使用済み':g+'/100'}</b><span class="gauge"><i style="width:${a.used?100:g}%"></i></span>${a.canUse?'<button id="awakenOpen">覚醒</button>':''}`;
  }

  function setReactionButton(btn,text,done=false){
    if(!btn?.isConnected)return;
    btn.classList.toggle('rf-busy',!done);
    btn.innerHTML=done?'<span>✓</span><b>確定</b>':`<span>⏳</span><b>${text}</b>`;
  }

  async function sendReaction(iid,btn){
    if(reactionBusy)return;
    reactionBusy=true;
    reactionLockUntil=Date.now()+2500;
    const isAccept=!iid;
    const original=btn?.innerHTML||'';
    if(btn){btn.classList.add('rf-busy');btn.disabled=true;setReactionButton(btn,isAccept?'ダメージ確定中…':'リアクション処理中…')}
    const path=isAccept?'/api/accept':'/api/react';
    let lastError='';
    for(let attempt=0;attempt<2;attempt++){
      try{
        const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({...session(),...(iid?{iid}:{})})});
        const d=await r.json().catch(()=>({}));
        if(r.ok){
          latest=d.state||latest;
          setReactionButton(btn,'',true);
          await sleep(100);
          location.reload();
          return;
        }
        lastError=d.error||`HTTP ${r.status}`;
        if(r.status===409){await fetchState(true);location.reload();return}
      }catch(e){lastError=e?.message||'通信エラー'}
      await sleep(250);
    }
    reactionBusy=false;
    reactionLockUntil=0;
    if(btn?.isConnected){
      btn.disabled=false;btn.classList.remove('rf-busy');btn.innerHTML=original||'<span>✋</span><b>もう一度押す</b>';
      const s=document.createElement('small');s.textContent='送信失敗：'+lastError;s.style.cssText='display:block;color:#ffb3b3;margin-top:4px';btn.appendChild(s);
    }
  }

  function reactionButtonFromEvent(e){return e.target?.closest?.('button[data-react]')||null}

  document.addEventListener('pointerdown',e=>{
    const btn=reactionButtonFromEvent(e);if(!btn)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(reactionBusy)return;
    const iid=btn.getAttribute('data-react')||'';
    void sendReaction(iid,btn);
  },true);

  document.addEventListener('click',e=>{
    const btn=reactionButtonFromEvent(e);if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    if(Date.now()<reactionLockUntil||reactionBusy)return;
    const iid=btn.getAttribute('data-react')||'';
    void sendReaction(iid,btn);
  },true);

  function openAwaken(){
    if(document.querySelector('.awakenOverlay'))return;
    const el=document.createElement('div');el.className='awakenOverlay';
    el.innerHTML=`<div class="awakenBox"><h2>🌌 逆境覚醒</h2><p>1試合に1回だけ使えます。</p><div class="awakenChoices"><button data-awaken="rebirth"><b>✨ 再起の光</b><small>HP10回復＋2枚ドロー＋MP2回復</small></button><button data-awaken="uprising"><b>⚔️ 反攻の号令</b><small>味方全員ATK+2 / HP+2＋MP4回復</small></button><button data-awaken="destiny"><b>🌌 運命召喚</b><small>6/7 守護・疾走を召喚＋1枚ドロー</small></button></div><button class="awakenCancel">戻る</button></div>`;
    document.body.appendChild(el);
  }

  async function awaken(choice,btn){
    if(awakenBusy)return;awakenBusy=true;btn.disabled=true;
    const original=btn.innerHTML;btn.innerHTML='<b>覚醒発動中…</b>';
    try{
      const r=await fetch('/api/awaken',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({...session(),choice})});
      if(r.ok){await sleep(100);location.reload();return}
    }catch(_){ }
    awakenBusy=false;btn.disabled=false;btn.innerHTML=original;
  }

  document.addEventListener('click',e=>{
    if(e.target.closest?.('#awakenOpen')){e.preventDefault();openAwaken();return}
    if(e.target.closest?.('.awakenCancel')){e.preventDefault();document.querySelector('.awakenOverlay')?.remove();return}
    const aw=e.target.closest?.('[data-awaken]');if(aw){e.preventDefault();void awaken(aw.dataset.awaken,aw)}
  },true);

  async function sync(){markUI();await fetchState();renderAwakening()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else void sync();
  setInterval(sync,700);
})();
