// Ponte entre a página do cofre do Ajust ERP e a extensão. Roda só no domínio do ERP
// (manifest.json). A página avisa por window.postMessage; nada volta para a página além de
// "recebido" ou do motivo da recusa.
//
// Ao instalar ou atualizar, o background injeta esta ponte de novo nas abas do ERP já abertas.
// A ponte antiga (da versão anterior) fica desligada pelo navegador: ela percebe isso, sai de
// cena em silêncio e deixa a nova responder.
(() => {
  // Uma ponte só por aba: se já houver uma (reinjeção), ela é desligada antes.
  try {
    window.__ajustCofreBridgeStop?.();
  } catch {
    /* ponte antiga já desligada */
  }
  const CHANNEL = 'ajust-cofre';
  const VERSION = chrome.runtime.getManifest().version;
  const alive = () => {
    try {
      return !!chrome.runtime?.id;
    } catch {
      return false;
    }
  };
  document.documentElement.dataset.ajustCofre = VERSION;
  const announce = () =>
    window.postMessage({ channel: CHANNEL, type: 'ready', version: VERSION }, location.origin);
  const reply = (requestId, body) =>
    window.postMessage(
      { channel: CHANNEL, type: 'autofill-reply', requestId, ...body },
      location.origin,
    );
  function onMessage(event) {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL) return;
    if (!alive()) return window.removeEventListener('message', onMessage);
    if (data.type === 'ping') return announce();
    if (data.type !== 'autofill') return;
    let pending;
    try {
      pending = chrome.runtime.sendMessage({
        type: 'autofill',
        requestId: String(data.requestId || ''),
        payload: data.payload,
      });
    } catch {
      return window.removeEventListener('message', onMessage);
    }
    pending
      .then((body) => {
        if (body?.duplicate) return; // outra ponte já respondeu este pedido
        reply(data.requestId, body || { ok: false, error: 'Sem resposta.' });
      })
      .catch((error) => {
        if (!alive() || /context invalidated/i.test(String(error?.message)))
          return window.removeEventListener('message', onMessage);
        reply(data.requestId, { ok: false, error: String(error?.message || error) });
      });
  }
  window.addEventListener('message', onMessage);
  window.__ajustCofreBridgeStop = () => window.removeEventListener('message', onMessage);
  announce();
})();
