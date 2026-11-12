// Ponte entre a página do cofre do Ajust ERP e a extensão. Roda só no domínio do ERP
// (manifest.json). A página avisa por window.postMessage; nada volta para a página além de
// "recebido" ou do motivo da recusa.
(() => {
  const CHANNEL = 'ajust-cofre';
  const VERSION = chrome.runtime.getManifest().version;
  document.documentElement.dataset.ajustCofre = VERSION;
  const announce = () =>
    window.postMessage({ channel: CHANNEL, type: 'ready', version: VERSION }, location.origin);
  announce();
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data;
    if (!data || data.channel !== CHANNEL) return;
    if (data.type === 'ping') return announce();
    if (data.type !== 'autofill') return;
    chrome.runtime
      .sendMessage({ type: 'autofill', payload: data.payload })
      .then((reply) =>
        window.postMessage(
          { channel: CHANNEL, type: 'autofill-reply', requestId: data.requestId, ...reply },
          location.origin,
        ),
      )
      .catch((error) =>
        window.postMessage(
          {
            channel: CHANNEL,
            type: 'autofill-reply',
            requestId: data.requestId,
            ok: false,
            error: String(error?.message || error),
          },
          location.origin,
        ),
      );
  });
})();
