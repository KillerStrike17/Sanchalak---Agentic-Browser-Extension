// ─── Shared Type Definitions: DOM ──────────────────────────────────────────
// Structured representation of a page for the LLM to reason about.

export interface PageState {
  url: string;
  title: string;
  /** All interactive elements on the page, indexed for reference */
  interactiveElements: InteractiveElement[];
  /** Cleaned visible text from the page (truncated if too long) */
  visibleText: string;
  /** Detected forms and their fields */
  forms: FormInfo[];
  /** Parsed tables */
  tables: TableData[];
  /** Heading hierarchy (h1 → h6) */
  headings: HeadingInfo[];
  /** Images with src + alt text */
  images: ImageInfo[];
  /** Meta tags */
  meta: Record<string, string>;
  /** Timestamp of analysis */
  analyzedAt: number;
}

export interface InteractiveElement {
  /** Unique index for this element (used by LLM to reference it) */
  index: number;
  /** HTML tag name */
  tag: string;
  /** Input type if applicable */
  type?: string;
  /** Visible text content or label */
  text: string;
  /** ARIA label */
  ariaLabel?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Value (for inputs) */
  value?: string;
  /** CSS selector for targeting */
  selector: string;
  /** Whether element is visible in viewport */
  isVisible: boolean;
  /** Whether element is enabled (not disabled) */
  isEnabled: boolean;
  /** Bounding box */
  rect: { x: number; y: number; width: number; height: number };
  /** Element role (button, link, textbox, etc.) */
  role?: string;
  /** href for links */
  href?: string;
}

export interface FormInfo {
  /** CSS selector for the form */
  selector: string;
  /** Form action URL */
  action?: string;
  /** Form method */
  method?: string;
  /** All fields in this form */
  fields: FormField[];
}

export interface FormField {
  /** CSS selector */
  selector: string;
  /** Field type (text, email, password, select, textarea, etc.) */
  type: string;
  /** Field name attribute */
  name?: string;
  /** Label text */
  label?: string;
  /** Placeholder */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Whether field is required */
  required: boolean;
  /** For select/radio: available options */
  options?: { value: string; text: string }[];
}

export interface TableData {
  /** CSS selector for the table */
  selector: string;
  /** Column headers */
  headers: string[];
  /** Row data */
  rows: string[][];
}

export interface HeadingInfo {
  level: number; // 1-6
  text: string;
}

export interface ImageInfo {
  src: string;
  alt: string;
  width: number;
  height: number;
}

/** Descriptor for finding an element (multiple strategies) */
export interface ElementDescriptor {
  /** CSS selector */
  selector?: string;
  /** XPath expression */
  xpath?: string;
  /** Text content to match */
  text?: string;
  /** ARIA label to match */
  ariaLabel?: string;
  /** Interactive element index (from PageState) */
  elementIndex?: number;
  /** Tag name filter */
  tag?: string;
}
