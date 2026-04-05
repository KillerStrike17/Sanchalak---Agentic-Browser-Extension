// ─── Accessibility DOM Helpers ───────────────────────────────────────────────
// Phase 4: Text-to-speech, contrast modes, font scaling, keyboard navigation.
// These run in the content script context so they have full DOM access.

// ── Text-to-Speech ────────────────────────────────────────────────────────────

let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakText(
  text: string,
  options: { rate?: number; pitch?: number; volume?: number; lang?: string } = {}
): { success: boolean; error?: string } {
  if (!('speechSynthesis' in window)) {
    return { success: false, error: 'Web Speech API not supported in this browser' };
  }

  // Stop any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = options.rate ?? 1.0;
  utterance.pitch = options.pitch ?? 1.0;
  utterance.volume = options.volume ?? 1.0;
  if (options.lang) utterance.lang = options.lang;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return { success: true };
}

export function stopSpeech(): { success: boolean } {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    currentUtterance = null;
  }
  return { success: true };
}

export function getSelectedOrMainText(): string {
  const selection = window.getSelection()?.toString().trim();
  if (selection) return selection;

  // Fall back to main content area
  const main =
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('article') ||
    document.body;
  return (main?.innerText || '').substring(0, 5000);
}

// ── Contrast Modes ────────────────────────────────────────────────────────────

const CONTRAST_STYLE_ID = 'sanchalak-contrast-style';

export function applyHighContrast(): { success: boolean } {
  removeContrastStyle();
  const style = document.createElement('style');
  style.id = CONTRAST_STYLE_ID;
  style.textContent = `
    * {
      background-color: #000000 !important;
      color: #FFFFFF !important;
      border-color: #FFFFFF !important;
    }
    a, a * { color: #FFFF00 !important; }
    button, [role="button"] { background-color: #000080 !important; color: #FFFFFF !important; border: 2px solid #FFFFFF !important; }
    img { filter: grayscale(100%) contrast(200%) !important; }
    input, textarea, select { background-color: #000000 !important; color: #FFFFFF !important; border: 1px solid #FFFFFF !important; }
  `;
  document.head.appendChild(style);
  return { success: true };
}

export function applyLowContrast(): { success: boolean } {
  removeContrastStyle();
  const style = document.createElement('style');
  style.id = CONTRAST_STYLE_ID;
  style.textContent = `
    * {
      filter: contrast(60%) brightness(110%) !important;
    }
  `;
  document.head.appendChild(style);
  return { success: true };
}

export function removeContrastStyle(): void {
  document.getElementById(CONTRAST_STYLE_ID)?.remove();
}

// ── Font Scaling ──────────────────────────────────────────────────────────────

const FONT_STYLE_ID = 'sanchalak-font-style';

export function applyLargeFont(scaleFactor: number = 1.4): { success: boolean } {
  document.getElementById(FONT_STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = `
    html { font-size: ${scaleFactor * 100}% !important; }
    * { line-height: 1.6 !important; }
  `;
  document.head.appendChild(style);
  return { success: true };
}

export function resetFont(): { success: boolean } {
  document.getElementById(FONT_STYLE_ID)?.remove();
  return { success: true };
}

// ── Keyboard Navigation ───────────────────────────────────────────────────────

const FOCUS_STYLE_ID = 'sanchalak-focus-style';

export function enhanceKeyboardNavigation(): { success: boolean } {
  document.getElementById(FOCUS_STYLE_ID)?.remove();
  const style = document.createElement('style');
  style.id = FOCUS_STYLE_ID;
  style.textContent = `
    :focus {
      outline: 3px solid #FF6B00 !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 5px rgba(255, 107, 0, 0.4) !important;
    }
    :focus:not(:focus-visible) { outline: none !important; box-shadow: none !important; }
    :focus-visible {
      outline: 3px solid #FF6B00 !important;
      outline-offset: 3px !important;
      box-shadow: 0 0 0 5px rgba(255, 107, 0, 0.4) !important;
    }
  `;
  document.head.appendChild(style);

  // Make non-interactive but logically navigable elements focusable
  const candidates = document.querySelectorAll<HTMLElement>(
    '[role="button"], [role="menuitem"], [role="tab"], [role="listitem"]'
  );
  candidates.forEach((el) => {
    if (!el.getAttribute('tabindex')) el.setAttribute('tabindex', '0');
  });

  return { success: true };
}

export function resetKeyboardNavigation(): { success: boolean } {
  document.getElementById(FOCUS_STYLE_ID)?.remove();
  return { success: true };
}

// ── Focus Management ──────────────────────────────────────────────────────────

export function focusNextInteractive(direction: 'next' | 'prev' = 'next'): { success: boolean; focused?: string } {
  const focusable = Array.from(
    document.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && (el.offsetWidth > 0 || el.offsetHeight > 0);
  });

  if (focusable.length === 0) return { success: false };

  const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
  const nextIndex =
    direction === 'next'
      ? (currentIndex + 1) % focusable.length
      : (currentIndex - 1 + focusable.length) % focusable.length;

  focusable[nextIndex].focus();
  return {
    success: true,
    focused: focusable[nextIndex].getAttribute('aria-label') || focusable[nextIndex].textContent?.trim().substring(0, 50) || focusable[nextIndex].tagName,
  };
}
