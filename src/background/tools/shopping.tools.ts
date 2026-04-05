// ─── Shopping & E-commerce Tools ────────────────────────────────────────────
// Phase 2: Product browsing, cart management, checkout, pricing, and filtering.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';

function createContentTool(tool: Omit<Tool, 'execute'>): Tool {
  return {
    ...tool,
    execute: async (params) => {
      const tab = await getActiveTab();
      if (!tab.id) throw new Error('No active tab');
      await ensureContentScript(tab.id);
      const response = await sendToTab<{ result: { success: boolean; data?: unknown; error?: string } }>(
        tab.id,
        { type: 'EXECUTE_TOOL', tool: tool.name, params, requestId: `tool_${Date.now()}` }
      );
      return response?.result || { success: false, error: 'No response from content script' };
    },
  };
}

export function registerShoppingTools(): void {

  // ── Product Browsing (9 tools) ───────────────────────────────────────���────

  toolRegistry.register(createContentTool({
    name: 'search_products',
    description: 'Search for products on the current e-commerce site by typing in the search box.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'query', type: 'string', description: 'The search query, e.g. "blue running shoes size 10"', required: true },
      { name: 'submitSearch', type: 'boolean', description: 'Press Enter / click search button after typing (default: true)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'filter_results',
    description: 'Apply a filter to search results or product listings (price, brand, size, color, rating, category, etc.).',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'filterType', type: 'string', description: 'The type of filter to apply, e.g. "price", "brand", "rating", "size", "color", "category"', required: true },
      { name: 'filterValue', type: 'string', description: 'The filter value to select, e.g. "Under $50", "Nike", "4 stars & up"', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'sort_products',
    description: 'Sort product listings or search results by a specified criteria.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      {
        name: 'sortBy',
        type: 'string',
        description: 'Sort criteria, e.g. "price low to high", "price high to low", "best rating", "most reviews", "newest"',
        required: true,
      },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'view_product_details',
    description: 'Click into a product to open its detail page. Can target by product name or its position in the listing.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'productName', type: 'string', description: 'Product name or partial name to click', required: false },
      { name: 'position', type: 'number', description: 'Position of the product in the listing (1-based)', required: false },
      { name: 'selector', type: 'string', description: 'CSS selector of the product link', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'read_reviews',
    description: 'Extract customer reviews from the current product page, optionally filtered by star rating.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'starFilter', type: 'number', description: 'Only return reviews with this star rating (1-5). Omit for all reviews.', required: false },
      { name: 'limit', type: 'number', description: 'Maximum number of reviews to extract (default: 10)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'compare_products',
    description: 'Extract key specs/prices from multiple product pages or a comparison table to compare products side-by-side.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      {
        name: 'attributes',
        type: 'array',
        description: 'List of attributes to compare, e.g. ["price", "rating", "storage", "battery"]',
        required: false,
      },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'check_stock',
    description: 'Check whether the current product is in stock and its availability status.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'variant', type: 'string', description: 'Specific variant to check, e.g. "Size: Large, Color: Blue"', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'get_pricing',
    description: 'Extract the current price, sale price, and any discounts for the product on the page.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'track_price',
    description: 'Extract the current price and product name for price tracking or comparison. Returns structured price data.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'productName', type: 'string', description: 'Name of the product being tracked', required: false },
    ],
  }));

  // ── Cart & Checkout (11 tools) ────────────────────────────────────────────

  toolRegistry.register(createContentTool({
    name: 'add_to_cart',
    description: 'Click the "Add to Cart", "Add to Bag", or "Buy Now" button on the current product page.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'quantity', type: 'number', description: 'Quantity to add (set in qty selector first if > 1). Default: 1', required: false },
      { name: 'selector', type: 'string', description: 'CSS selector of the add-to-cart button (auto-detected if omitted)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'remove_from_cart',
    description: 'Remove a specific item from the shopping cart.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'productName', type: 'string', description: 'Product name (partial match) to remove', required: false },
      { name: 'selector', type: 'string', description: 'CSS selector of the remove button', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'update_quantity',
    description: 'Update the quantity of an item in the shopping cart.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'productName', type: 'string', description: 'Product name to update', required: false },
      { name: 'quantity', type: 'number', description: 'New quantity value', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector of the quantity input', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'view_cart',
    description: 'Extract the full contents of the shopping cart: product names, quantities, prices, and totals.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [],
  }));

  toolRegistry.register(createContentTool({
    name: 'apply_coupon',
    description: 'Find the coupon/promo code input field, enter the discount code, and apply it.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'code', type: 'string', description: 'The coupon or promo code to apply', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'calculate_shipping',
    description: 'Enter a destination and calculate the shipping cost estimate for the cart.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'zipCode', type: 'string', description: 'ZIP/postal code for shipping estimate', required: false },
      { name: 'country', type: 'string', description: 'Country for shipping estimate', required: false },
      { name: 'state', type: 'string', description: 'State/province for shipping estimate', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'select_shipping_method',
    description: 'Choose a shipping option (standard, expedited, overnight, etc.) during checkout.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'method', type: 'string', description: 'Shipping method to select, e.g. "Standard (5-7 days)", "Express", "Free shipping"', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'add_billing_address',
    description: 'Fill in the billing address fields during checkout.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [
      { name: 'firstName', type: 'string', description: 'First name', required: false },
      { name: 'lastName', type: 'string', description: 'Last name', required: false },
      { name: 'address1', type: 'string', description: 'Street address line 1', required: false },
      { name: 'address2', type: 'string', description: 'Street address line 2 (apt, suite, etc.)', required: false },
      { name: 'city', type: 'string', description: 'City', required: false },
      { name: 'state', type: 'string', description: 'State or province', required: false },
      { name: 'zipCode', type: 'string', description: 'ZIP or postal code', required: false },
      { name: 'country', type: 'string', description: 'Country', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'review_order',
    description: 'Extract the full order summary before checkout — items, quantities, prices, shipping, taxes, and total.',
    category: 'shopping',
    safetyLevel: 'safe',
    parameters: [],
  }));

  // Payment method selection requires user confirmation
  toolRegistry.register(createContentTool({
    name: 'select_payment_method',
    description: 'Select a payment method type (credit card, PayPal, etc.) during checkout. Does NOT enter card details.',
    category: 'shopping',
    safetyLevel: 'confirm',
    parameters: [
      {
        name: 'method',
        type: 'string',
        description: 'Payment method to select, e.g. "Credit Card", "PayPal", "Apple Pay", "Google Pay"',
        required: true,
      },
    ],
  }));

  // Complete purchase is blocked — user must do it themselves
  toolRegistry.register({
    name: 'complete_purchase',
    description: 'BLOCKED for safety — the agent cannot complete purchases autonomously. Ask the user to review the order and click Place Order themselves.',
    category: 'shopping',
    safetyLevel: 'block',
    parameters: [],
    execute: async () => ({
      success: false,
      error: 'complete_purchase is blocked for safety. Ask the user to review the order and confirm the purchase themselves.',
    }),
  });
}
