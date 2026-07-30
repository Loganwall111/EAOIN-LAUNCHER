// EAOIN Full Accessibility System
export class AccessibilitySystem {
  applySettings(settings: any) {
    if (settings.colorblindMode) document.body.classList.add('colorblind-' + settings.colorblindMode);
    if (settings.uiScale) document.documentElement.style.setProperty('--ui-scale', settings.uiScale);
    console.log('[EAOIN] Accessibility settings applied');
  }
}
