// ─── Research & Data Gathering Tools ────────────────────────────────────────
// Phase 2: Web search, data collection, competitor research, monitoring.

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

export function registerResearchTools(): void {

  // ── Research Tools (11 tools) ─────────────────────────────────────────────

  toolRegistry.register(createContentTool({
    name: 'web_search',
    description: 'Navigate to a search engine and search for information on a topic.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'query', type: 'string', description: 'The search query', required: true },
      { name: 'engine', type: 'string', description: 'Search engine to use: "google" (default), "bing", "duckduckgo"', required: false, enum: ['google', 'bing', 'duckduckgo'], default: 'google' },
      { name: 'extractResults', type: 'boolean', description: 'Extract the top search results after searching (default: true)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'compare_options',
    description: 'Collect and compare data on multiple options from the current page or multiple URLs. Returns a structured comparison.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      {
        name: 'urls',
        type: 'array',
        description: 'List of URLs to visit and collect data from for comparison',
        required: false,
      },
      {
        name: 'attributes',
        type: 'array',
        description: 'Specific attributes to compare, e.g. ["price", "features", "reviews"]',
        required: false,
      },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'collect_data',
    description: 'Systematically collect specific data points from a page or a list of pages (e.g. product names, prices, contact info).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'dataType', type: 'string', description: 'Type of data to collect, e.g. "product listings", "job postings", "contact info", "prices"', required: true },
      { name: 'limit', type: 'number', description: 'Maximum number of items to collect (default: 20)', required: false },
      { name: 'scrollToLoadMore', type: 'boolean', description: 'Scroll down to load more items before collecting (default: false)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'monitor_information',
    description: 'Extract the current value of tracked information (price, stock status, score, etc.) for monitoring purposes.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'infoType', type: 'string', description: 'What to monitor, e.g. "product price", "stock availability", "article updates"', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector of the element containing the tracked value', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'extract_statistics',
    description: 'Extract numerical statistics, metrics, or data points from the current page (revenue figures, percentages, counts).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'keywords', type: 'string', description: 'Keywords to look for near the statistics, e.g. "revenue", "users", "growth"', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'find_competitors',
    description: 'Search for and list competitors of a company or product in a specific market.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'companyOrProduct', type: 'string', description: 'Company or product name to find competitors for', required: true },
      { name: 'industry', type: 'string', description: 'Industry or market sector', required: false },
      { name: 'limit', type: 'number', description: 'Number of competitors to find (default: 5)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'research_person',
    description: 'Find publicly available professional information about a person (job title, company, LinkedIn profile).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'name', type: 'string', description: 'Full name of the person', required: true },
      { name: 'company', type: 'string', description: 'Company they work at (helps narrow results)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'find_contact_info',
    description: 'Find publicly listed contact information (email, phone, address) for a person or company.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'target', type: 'string', description: 'Person or company name to find contact info for', required: true },
      { name: 'infoType', type: 'string', description: 'Type of contact info: "email", "phone", "address", or "all" (default: "all")', required: false, enum: ['email', 'phone', 'address', 'all'], default: 'all' },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'check_stock_price',
    description: 'Look up the current stock price and basic info for a company ticker symbol.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'ticker', type: 'string', description: 'Stock ticker symbol, e.g. "AAPL", "GOOGL", "MSFT"', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'find_job_listings',
    description: 'Search for open job positions matching criteria on job boards.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'jobTitle', type: 'string', description: 'Job title or keywords, e.g. "Senior Data Scientist"', required: true },
      { name: 'location', type: 'string', description: 'Location or "remote"', required: false },
      { name: 'site', type: 'string', description: 'Job board to search: "linkedin", "indeed", "glassdoor" (default: current page)', required: false },
      { name: 'limit', type: 'number', description: 'Number of listings to return (default: 10)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'compare_salary_data',
    description: 'Look up salary ranges for a job title and location from salary data sites.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'jobTitle', type: 'string', description: 'Job title to look up', required: true },
      { name: 'location', type: 'string', description: 'City and/or country for salary data', required: false },
      { name: 'experienceLevel', type: 'string', description: 'Experience level: "entry", "mid", "senior", "lead"', required: false },
    ],
  }));
}
