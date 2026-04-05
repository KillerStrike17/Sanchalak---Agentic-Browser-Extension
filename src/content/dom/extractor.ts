// ─── Content Script: DOM Extractor ─────────────────────────────────────────
// Extracts text, tables, links, images, emails, phones, prices from the page.

import { findElement } from '../element-selector';
import type { ElementDescriptor } from '@shared/types/dom';

/**
 * Extract all visible text from the page.
 */
export function extractAllText(): { text: string } {
  const text = document.body.innerText || '';
  return { text: text.trim() };
}

/**
 * Extract text from a specific element.
 */
export function extractElementText(descriptor: ElementDescriptor): { text: string; found: boolean } {
  const el = findElement(descriptor);
  if (!el) return { text: '', found: false };
  return { text: el.innerText?.trim() || '', found: true };
}

/**
 * Extract all URLs (links) from the page.
 */
export function extractUrls(): { urls: { text: string; href: string }[] } {
  const links = document.querySelectorAll('a[href]');
  const urls: { text: string; href: string }[] = [];

  for (const link of links) {
    const a = link as HTMLAnchorElement;
    const href = a.href;
    if (href && !href.startsWith('javascript:')) {
      urls.push({
        text: a.innerText?.trim() || a.title || '',
        href,
      });
    }
  }

  return { urls };
}

/**
 * Extract all images from the page.
 */
export function extractImages(): { images: { src: string; alt: string }[] } {
  const imgs = document.querySelectorAll('img');
  const images: { src: string; alt: string }[] = [];

  for (const img of imgs) {
    if (img.src) {
      images.push({
        src: img.src,
        alt: img.alt || '',
      });
    }
  }

  return { images };
}

/**
 * Extract table data from a specific table or the first table on the page.
 */
export function extractTableData(descriptor?: ElementDescriptor): {
  headers: string[];
  rows: string[][];
  found: boolean;
} {
  let table: HTMLTableElement | null = null;

  if (descriptor) {
    table = findElement(descriptor) as HTMLTableElement;
  } else {
    table = document.querySelector('table');
  }

  if (!table) return { headers: [], rows: [], found: false };

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

  return { headers, rows, found: true };
}

/**
 * Extract email addresses from the page.
 */
export function extractEmails(): { emails: string[] } {
  const text = document.body.innerText || '';
  const html = document.body.innerHTML || '';
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

  const fromText = text.match(emailRegex) || [];
  const fromHtml = html.match(emailRegex) || [];

  // Also check mailto links
  const mailtoLinks = document.querySelectorAll('a[href^="mailto:"]');
  const fromMailto: string[] = [];
  for (const link of mailtoLinks) {
    const href = (link as HTMLAnchorElement).href;
    const email = href.replace('mailto:', '').split('?')[0];
    if (email) fromMailto.push(email);
  }

  const unique = [...new Set([...fromText, ...fromHtml, ...fromMailto])];
  return { emails: unique };
}

/**
 * Extract phone numbers from the page.
 */
export function extractPhoneNumbers(): { phones: string[] } {
  const text = document.body.innerText || '';
  // Matches various phone formats
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  const unique = [...new Set(matches.map((p) => p.trim()))];
  return { phones: unique };
}

/**
 * Extract prices from the page.
 */
export function extractPrices(): { prices: { text: string; value: number; currency: string }[] } {
  const text = document.body.innerText || '';
  // Match common price formats: $XX.XX, €XX.XX, £XX.XX, ₹XX,XXX
  const priceRegex = /(?:[\$€£₹¥])\s*[\d,]+(?:\.\d{2})?|[\d,]+(?:\.\d{2})?\s*(?:USD|EUR|GBP|INR|JPY)/gi;
  const matches = text.match(priceRegex) || [];

  const prices: { text: string; value: number; currency: string }[] = [];
  for (const match of matches) {
    const currencyMap: Record<string, string> = {
      '$': 'USD', '€': 'EUR', '£': 'GBP', '₹': 'INR', '¥': 'JPY',
    };

    let currency = 'USD';
    for (const [symbol, code] of Object.entries(currencyMap)) {
      if (match.includes(symbol)) {
        currency = code;
        break;
      }
    }

    const numStr = match.replace(/[^\d.]/g, '');
    const value = parseFloat(numStr);
    if (!isNaN(value)) {
      prices.push({ text: match.trim(), value, currency });
    }
  }

  return { prices };
}

/**
 * Extract meta information.
 */
export function extractMeta(): { meta: Record<string, string> } {
  const meta: Record<string, string> = {};
  meta.title = document.title;
  meta.url = window.location.href;

  const metaTags = document.querySelectorAll('meta[name], meta[property]');
  for (const tag of metaTags) {
    const name = tag.getAttribute('name') || tag.getAttribute('property');
    const content = tag.getAttribute('content');
    if (name && content) {
      meta[name] = content;
    }
  }

  // Canonical URL
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    meta.canonical = (canonical as HTMLLinkElement).href;
  }

  return { meta };
}

/**
 * Extract structured data (JSON-LD).
 */
export function extractStructuredData(): { data: unknown[] } {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  const data: unknown[] = [];

  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent || '');
      data.push(parsed);
    } catch {
      // Invalid JSON-LD, skip
    }
  }

  return { data };
}
