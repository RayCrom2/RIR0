let deferredPrompt = null;

export function capturePwaPrompt(e) {
  e.preventDefault();
  deferredPrompt = e;
}

export function hasPwaPrompt() {
  return !!deferredPrompt;
}

export async function triggerPwaInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export function isPwaStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isPwaIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export const PWA_PROMPT_KEY = 'rir0_pwa_prompted';
