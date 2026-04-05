// ─── Content Script: Page Analyzer ─────────────────────────────────────────
// Builds a structured PageState representation of the current page.

import type {
  PageState,
  InteractiveElement,
  FormInfo,
  FormField,
  TableData,
  HeadingInfo,
  ImageInfo,
} from '@shared/types/dom';
import { MAX_PAGE_TEXT_LENGTH, MAX_INTERACTIVE_ELEMENTS } from '@shared/constants';

/**
 * Analyze the current page and return a structured representation.
 */
export function analyzePage(): PageState {
  return {
    url: window.location.href,
    title: document.title,
    interactiveElements: extractInteractiveElements(),
    visibleText: extractVisibleText(),
    forms: extractForms(),
    tables: extractTables(),
    headings: extractHeadings(),
    images: extractImages(),
    meta: extractMeta(),
    analyzedAt: Date.now(),
  };
}

// ─── Interactive Elements ───────────────────────────────────────────────────

function extractInteractiveElements(): InteractiveElement[] {
  const selectors = [
    'a[href]',
    'button',
    'input',
    'select',
    'textarea',
    '[role="button"]',
    '[role="link"]',
    '[role="tab"]',
    '[role="menuitem"]',
    '[role="checkbox"]',
    '[role="radio"]',
    '[role="switch"]',
    '[onclick]',
    '[tabindex]',
  ];

  const seen = new Set<Element>();
  const elements: InteractiveElement[] = [];
  let index = 0;

  for (const selector of selectors) {
    const nodes = document.querySelectorAll(selector);
    for (const el of nodes) {
      if (seen.has(el)) continue;
      seen.add(el);

      const htmlEl = el as HTMLElement;
      if (!isElementVisible(htmlEl)) continue;

      const rect = htmlEl.getBoundingClientRect();
      const element: InteractiveElement = {
        index: index++,
        tag: htmlEl.tagName.toLowerCase(),
        type: (htmlEl as HTMLInputElement).type || undefined,
        text: getElementText(htmlEl),
        ariaLabel: htmlEl.getAttribute('aria-label') || undefined,
        placeholder: (htmlEl as HTMLInputElement).placeholder || undefined,
        value: (htmlEl as HTMLInputElement).value || undefined,
        selector: generateSelector(htmlEl),
        isVisible: true,
        isEnabled: !(htmlEl as HTMLInputElement).disabled,
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        role: htmlEl.getAttribute('role') || getImplicitRole(htmlEl) || undefined,
        href: (htmlEl as HTMLAnchorElement).href || undefined,
      };

      elements.push(element);
      if (elements.length >= MAX_INTERACTIVE_ELEMENTS) break;
    }
    if (elements.length >= MAX_INTERACTIVE_ELEMENTS) break;
  }

  return elements;
}

// ─── Visible Text ───────────────────────────────────────────────────────────

function extractVisibleText(): string {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (['script', 'style', 'noscript', 'svg'].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        if (!isElementVisible(parent)) return NodeFilter.FILTER_REJECT;
        const text = node.textContent?.trim();
        if (!text) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  const texts: string[] = [];
  let totalLength = 0;

  while (walker.nextNode()) {
    const text = walker.currentNode.textContent?.trim();
    if (text) {
      texts.push(text);
      totalLength += text.length;
      if (totalLength > MAX_PAGE_TEXT_LENGTH) break;
    }
  }

  return texts.join(' ').substring(0, MAX_PAGE_TEXT_LENGTH);
}

// ─── Forms ──────────────────────────────────────────────────────────────────

function extractForms(): FormInfo[] {
  const forms: FormInfo[] = [];
  const formElements = document.querySelectorAll('form');

  for (const form of formElements) {
    const fields: FormField[] = [];
    const inputs = form.querySelectorAll('input, select, textarea');

    for (const input of inputs) {
      const htmlInput = input as HTMLInputElement;
      const label = findLabel(htmlInput);

      const field: FormField = {
        selector: generateSelector(htmlInput),
        type: htmlInput.tagName.toLowerCase() === 'select'
          ? 'select'
          : htmlInput.tagName.toLowerCase() === 'textarea'
            ? 'textarea'
            : htmlInput.type || 'text',
        name: htmlInput.name || undefined,
        label: label || undefined,
        placeholder: htmlInput.placeholder || undefined,
        value: htmlInput.value || undefined,
        required: htmlInput.required,
      };

      if (htmlInput.tagName.toLowerCase() === 'select') {
        const select = htmlInput as unknown as HTMLSelectElement;
        field.options = Array.from(select.options).map((opt) => ({
          value: opt.value,
          text: opt.textContent || '',
        }));
      }

      fields.push(field);
    }

    forms.push({
      selector: generateSelector(form),
      action: form.action || undefined,
      method: form.method || undefined,
      fields,
    });
  }

  return forms;
}

// ─── Tables ─────────────────────────────────────────────────────────────────

function extractTables(): TableData[] {
  const tables: TableData[] = [];
  const tableElements = document.querySelectorAll('table');

  for (const table of tableElements) {
    const headers: string[] = [];
    const rows: string[][] = [];

    const headerCells = table.querySelectorAll('thead th, thead td, tr:first-child th');
    for (const cell of headerCells) {
      headers.push(cell.textContent?.trim() || '');
    }

    const bodyRows = table.querySelectorAll('tbody tr, tr');
    for (const row of bodyRows) {
      const cells = row.querySelectorAll('td');
      if (cells.length === 0) continue;
      const rowData: string[] = [];
      for (const cell of cells) {
        rowData.push(cell.textContent?.trim() || '');
      }
      rows.push(rowData);
    }

    if (rows.length > 0) {
      tables.push({
        selector: generateSelector(table),
        headers,
        rows: rows.slice(0, 50), // Limit rows
      });
    }
  }

  return tables;
}

// ─── Headings ───────────────────────────────────────────────────────────────

function extractHeadings(): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

  for (const h of headingElements) {
    const level = parseInt(h.tagName[1]);
    const text = h.textContent?.trim();
    if (text) {
      headings.push({ level, text });
    }
  }

  return headings;
}

// ─── Images ─────────────────────────────────────────────────────────────────

function extractImages(): ImageInfo[] {
  const images: ImageInfo[] = [];
  const imgElements = document.querySelectorAll('img');

  for (const img of imgElements) {
    if (!isElementVisible(img)) continue;
    images.push({
      src: img.src,
      alt: img.alt || '',
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
    });
  }

  return images.slice(0, 30); // Limit
}

// ─── Meta ───────────────────────────────────────────────────────────────────

function extractMeta(): Record<string, string> {
  const meta: Record<string, string> = {};
  meta.title = document.title;

  const metaTags = document.querySelectorAll('meta[name], meta[property]');
  for (const tag of metaTags) {
    const name = tag.getAttribute('name') || tag.getAttribute('property');
    const content = tag.getAttribute('content');
    if (name && content) {
      meta[name] = content;
    }
  }

  return meta;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function isElementVisible(el: HTMLElement): boolean {
  if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML') {
    return false;
  }
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function getElementText(el: HTMLElement): string {
  // Try aria-label first
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  // Try innerText (visible text only)
  const text = el.innerText?.trim();
  if (text && text.length < 200) return text;

  // Try title attribute
  const title = el.getAttribute('title');
  if (title) return title;

  // Try value for inputs
  const value = (el as HTMLInputElement).value;
  if (value) return `[value: ${value}]`;

  // Try placeholder
  const placeholder = (el as HTMLInputElement).placeholder;
  if (placeholder) return `[placeholder: ${placeholder}]`;

  return text?.substring(0, 100) || '[no text]';
}

function getImplicitRole(el: HTMLElement): string | null {
  const tag = el.tagName.toLowerCase();
  const roleMap: Record<string, string> = {
    a: 'link',
    button: 'button',
    input: 'textbox',
    select: 'combobox',
    textarea: 'textbox',
    img: 'img',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
  };
  return roleMap[tag] || null;
}

function findLabel(input: HTMLElement): string | null {
  // 1. Check for <label for="id">
  const id = input.getAttribute('id');
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) return label.textContent?.trim() || null;
  }

  // 2. Check parent <label>
  const parentLabel = input.closest('label');
  if (parentLabel) {
    const text = parentLabel.textContent?.trim();
    // Remove the input's own value from the label text
    const inputValue = (input as HTMLInputElement).value;
    if (text && inputValue) {
      return text.replace(inputValue, '').trim() || null;
    }
    return text || null;
  }

  // 3. Check aria-labelledby
  const labelledBy = input.getAttribute('aria-labelledby');
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.textContent?.trim() || null;
  }

  // 4. Check aria-label
  return input.getAttribute('aria-label');
}

/**
 * Generate a CSS selector that uniquely identifies an element.
 */
export function generateSelector(el: Element): string {
  // 1. Try ID
  if (el.id) return `#${CSS.escape(el.id)}`;

  // 2. Try data-testid
  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${CSS.escape(testId)}"]`;

  // 3. Build a path
  const path: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${CSS.escape(current.id)}`;
      path.unshift(selector);
      break;
    }

    // Add class names (first 2)
    const classes = Array.from(current.classList).slice(0, 2);
    if (classes.length > 0) {
      selector += classes.map((c) => `.${CSS.escape(c)}`).join('');
    }

    // Add nth-child if needed for uniqueness
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}
