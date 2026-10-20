/**
 * Copia texto para a área de transferência. Em HTTP puro (ex.: acesso por IP na rede interna)
 * `navigator.clipboard` não existe, então usa a cópia por seleção como alternativa.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Cai para a cópia por seleção.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  area.style.top = '0';
  document.body.appendChild(area);
  area.focus();
  area.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    area.remove();
  }
}
