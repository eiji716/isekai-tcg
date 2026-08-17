(() => {
  const markVersion = () => {
    const p = document.querySelector('.lobby > p');
    if (p && /^Ver\.0\.4\.0/.test(p.textContent || '')) p.textContent = 'Ver.0.4.1';
  };
  new MutationObserver(markVersion).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markVersion);
  else markVersion();

  async function acceptAttack(button) {
    if (button.dataset.accepting === '1') return;
    button.dataset.accepting = '1';
    button.disabled = true;
    const old = button.innerHTML;
    button.innerHTML = '<span>✋</span><b>ダメージ確定中…</b>';
    const body = { room: sessionStorage.tcg_room || '', token: sessionStorage.tcg_token || '' };

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch('/api/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          cache: 'no-store',
          body: JSON.stringify(body)
        });
        if (r.ok) {
          button.innerHTML = '<span>✓</span><b>確定</b>';
          setTimeout(() => location.reload(), 120);
          return;
        }
        if (r.status === 409) {
          setTimeout(() => location.reload(), 120);
          return;
        }
      } catch (_) {}
      await new Promise(resolve => setTimeout(resolve, 250));
    }

    button.dataset.accepting = '0';
    button.disabled = false;
    button.innerHTML = old || '<span>✋</span><b>受ける</b>';
  }

  document.addEventListener('click', e => {
    const button = e.target.closest?.('button[data-react=""]');
    if (!button) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    acceptAttack(button);
  }, true);
})();
