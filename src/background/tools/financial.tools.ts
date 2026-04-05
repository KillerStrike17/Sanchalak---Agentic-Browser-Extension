// ─── Financial Tools ─────────────────────────────────────────────────────────
// Phase 4: Stock prices, crypto, portfolio tracking, expense management,
// invoice reading, currency conversion.
// IMPORTANT: All transaction-initiating tools are safetyLevel: 'block'.
// The extension NEVER executes real money movements.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';
import { createLogger } from '@shared/logger';

const log = createLogger('background');

function createReadOnlyFinancialTool(tool: Omit<Tool, 'execute'>): Tool {
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

export function registerFinancialTools(): void {

  // ── get_stock_price ────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'get_stock_price',
    description: 'Look up the current price and basic quote data for a stock symbol.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'symbol', type: 'string', description: 'Stock ticker symbol, e.g. "AAPL", "TSLA", "RELIANCE.BSE"', required: true },
      { name: 'exchange', type: 'string', description: 'Exchange (optional): "NASDAQ", "NYSE", "BSE", "NSE"', required: false },
    ],
    execute: async (params) => {
      const symbol = params.symbol as string;
      log.info('get_stock_price', { symbol });
      // Uses Yahoo Finance public JSON endpoint (no API key needed for basic quotes)
      try {
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`
        );
        if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
        const data = await response.json();
        const meta = data?.chart?.result?.[0]?.meta;
        if (!meta) return { success: false, error: 'No data returned for symbol' };
        return {
          success: true,
          data: {
            symbol: meta.symbol,
            currency: meta.currency,
            price: meta.regularMarketPrice,
            previousClose: meta.previousClose,
            change: +(meta.regularMarketPrice - meta.previousClose).toFixed(2),
            changePercent: +(((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100).toFixed(2),
            marketState: meta.marketState,
            exchange: meta.exchangeName,
          },
        };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── get_crypto_price ───────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'get_crypto_price',
    description: 'Get the current price and 24h change for a cryptocurrency.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'coin', type: 'string', description: 'Coin ID or symbol, e.g. "bitcoin", "ethereum", "BTC", "ETH"', required: true },
      { name: 'currency', type: 'string', description: 'Fiat currency for pricing, e.g. "usd", "inr", "eur" (default: "usd")', required: false },
    ],
    execute: async (params) => {
      const coin = (params.coin as string).toLowerCase();
      const currency = ((params.currency as string) || 'usd').toLowerCase();
      try {
        const response = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(coin)}&vs_currencies=${currency}&include_24hr_change=true&include_market_cap=true`
        );
        if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
        const data = await response.json();
        const coinData = data[coin];
        if (!coinData) return { success: false, error: `Coin "${coin}" not found. Try using the full CoinGecko ID (e.g. "bitcoin" not "BTC").` };
        return {
          success: true,
          data: {
            coin,
            currency,
            price: coinData[currency],
            change24h: coinData[`${currency}_24h_change`],
            marketCap: coinData[`${currency}_market_cap`],
          },
        };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── convert_currency ───────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'convert_currency',
    description: 'Convert an amount from one currency to another using live exchange rates.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'amount', type: 'number', description: 'Amount to convert', required: true },
      { name: 'from', type: 'string', description: 'Source currency code, e.g. "USD", "INR", "EUR"', required: true },
      { name: 'to', type: 'string', description: 'Target currency code', required: true },
    ],
    execute: async (params) => {
      const from = (params.from as string).toUpperCase();
      const to = (params.to as string).toUpperCase();
      const amount = params.amount as number;
      try {
        const response = await fetch(
          `https://api.frankfurter.app/latest?from=${from}&to=${to}`
        );
        if (!response.ok) return { success: false, error: `HTTP ${response.status}` };
        const data = await response.json();
        const rate = data.rates?.[to];
        if (!rate) return { success: false, error: `Rate not found for ${from} → ${to}` };
        return {
          success: true,
          data: {
            from,
            to,
            amount,
            rate,
            converted: +(amount * rate).toFixed(4),
            date: data.date,
          },
        };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── read_portfolio ─────────────────────────────────────────────────────────
  toolRegistry.register(createReadOnlyFinancialTool({
    name: 'read_portfolio',
    description: 'Read portfolio holdings and performance from the current brokerage page (Zerodha, Groww, Robinhood, Fidelity, etc.).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'includeDetails', type: 'boolean', description: 'Include individual position details (default: true)', required: false },
    ],
  }));

  // ── read_transaction_history ───────────────────────────────────────────────
  toolRegistry.register(createReadOnlyFinancialTool({
    name: 'read_transaction_history',
    description: 'Extract transaction history from the current banking or brokerage page.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'limit', type: 'number', description: 'Maximum transactions to return (default: 20)', required: false },
      { name: 'dateFrom', type: 'string', description: 'Filter from date YYYY-MM-DD', required: false },
      { name: 'dateTo', type: 'string', description: 'Filter to date YYYY-MM-DD', required: false },
    ],
  }));

  // ── read_invoice ───────────────────────────────────────────────────────────
  toolRegistry.register(createReadOnlyFinancialTool({
    name: 'read_invoice',
    description: 'Extract line items, totals, vendor info, and due dates from an invoice shown on the current page.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'format', type: 'string', description: 'Expected format hint: "standard", "gst", "us_invoice" (default: "standard")', required: false },
    ],
  }));

  // ── calculate_expenses ─────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'calculate_expenses',
    description: 'Compute expense totals, averages, or summaries from a list of transaction data.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'transactions', type: 'array', description: 'Array of transaction objects with {amount, category, date} fields', required: false },
      { name: 'groupBy', type: 'string', description: 'Group expenses by: "category", "month", "week" (default: "category")', required: false, enum: ['category', 'month', 'week'], default: 'category' },
      { name: 'currency', type: 'string', description: 'Currency symbol to display (default: "$")', required: false },
    ],
    execute: async (params) => {
      const transactions = (params.transactions as Array<{ amount: number; category?: string; date?: string }>) || [];
      const groupBy = (params.groupBy as string) || 'category';
      const currency = (params.currency as string) || '$';

      if (transactions.length === 0) {
        return { success: false, error: 'No transactions provided. Use read_transaction_history first to get data.' };
      }

      const groups: Record<string, number> = {};
      let total = 0;

      for (const tx of transactions) {
        const amount = Math.abs(tx.amount || 0);
        total += amount;
        let key = 'Uncategorised';
        if (groupBy === 'category') key = tx.category || 'Uncategorised';
        else if (groupBy === 'month' && tx.date) key = tx.date.substring(0, 7);
        else if (groupBy === 'week' && tx.date) {
          const d = new Date(tx.date);
          const weekStart = new Date(d);
          weekStart.setDate(d.getDate() - d.getDay());
          key = weekStart.toISOString().substring(0, 10);
        }
        groups[key] = (groups[key] || 0) + amount;
      }

      const sorted = Object.entries(groups)
        .sort(([, a], [, b]) => b - a)
        .map(([key, amount]) => ({ [groupBy]: key, amount: +amount.toFixed(2), percentage: +((amount / total) * 100).toFixed(1) }));

      return {
        success: true,
        data: {
          total: +total.toFixed(2),
          currency,
          count: transactions.length,
          average: +(total / transactions.length).toFixed(2),
          breakdown: sorted,
        },
      };
    },
  } as Tool);

  // ── BLOCKED TOOLS — never execute real financial transactions ─────────────

  const blockedTools: Array<{ name: string; description: string }> = [
    { name: 'execute_trade', description: 'Execute a buy or sell trade (BLOCKED — use your brokerage app directly).' },
    { name: 'transfer_funds', description: 'Transfer funds between accounts (BLOCKED — use your banking app directly).' },
  ];

  for (const blocked of blockedTools) {
    toolRegistry.register({
      name: blocked.name,
      description: blocked.description,
      category: 'data',
      safetyLevel: 'block',
      parameters: [],
      execute: async () => ({
        success: false,
        error: `⛔ ${blocked.name} is permanently blocked. Sanchalak never executes real financial transactions. Please use your financial platform directly.`,
      }),
    } as Tool);
  }
}
