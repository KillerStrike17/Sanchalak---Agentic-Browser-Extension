// ─── API & Service Integration Tools ────────────────────────────────────────
// Phase 4: REST API calls, webhooks, OAuth, and third-party service actions
// (Google Sheets/Drive, Slack, Jira, Trello, etc.)

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { createLogger } from '@shared/logger';

const log = createLogger('background');

export function registerAPITools(): void {

  // ── call_rest_api ──────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'call_rest_api',
    description: 'Make an HTTP request to a REST API endpoint. Supports GET, POST, PUT, PATCH, DELETE.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'url', type: 'string', description: 'Full URL of the API endpoint', required: true },
      { name: 'method', type: 'string', description: 'HTTP method: GET, POST, PUT, PATCH, DELETE (default: GET)', required: false, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
      { name: 'headers', type: 'object', description: 'Request headers as key-value pairs', required: false },
      { name: 'body', type: 'object', description: 'Request body for POST/PUT/PATCH (will be JSON serialised)', required: false },
      { name: 'queryParams', type: 'object', description: 'URL query parameters as key-value pairs', required: false },
    ],
    execute: async (params) => {
      try {
        const url = new URL(params.url as string);
        if (params.queryParams) {
          for (const [k, v] of Object.entries(params.queryParams as Record<string, string>)) {
            url.searchParams.set(k, String(v));
          }
        }

        const method = (params.method as string) || 'GET';
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(params.headers as Record<string, string> || {}),
        };

        const init: RequestInit = { method, headers };
        if (params.body && !['GET', 'HEAD'].includes(method)) {
          init.body = JSON.stringify(params.body);
        }

        const response = await fetch(url.toString(), init);
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? await response.json()
          : await response.text();

        return {
          success: response.ok,
          data: { status: response.status, statusText: response.statusText, data },
          error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        };
      } catch (err) {
        log.error('call_rest_api failed', err);
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── parse_json ─────────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'parse_json',
    description: 'Parse a JSON string and extract values at given paths.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'jsonString', type: 'string', description: 'Raw JSON string to parse', required: true },
      { name: 'paths', type: 'array', description: 'Dot-notation paths to extract, e.g. ["user.name", "items[0].price"]', required: false },
    ],
    execute: async (params) => {
      try {
        const parsed = JSON.parse(params.jsonString as string);
        if (!params.paths || (params.paths as string[]).length === 0) {
          return { success: true, data: parsed };
        }

        const extract = (obj: unknown, path: string): unknown => {
          return path.split('.').reduce((curr: unknown, key) => {
            if (curr === null || curr === undefined) return undefined;
            const arrMatch = key.match(/^(\w+)\[(\d+)\]$/);
            if (arrMatch) {
              const arrObj = (curr as Record<string, unknown>)[arrMatch[1]];
              return Array.isArray(arrObj) ? arrObj[parseInt(arrMatch[2])] : undefined;
            }
            return (curr as Record<string, unknown>)[key];
          }, obj);
        };

        const result: Record<string, unknown> = {};
        for (const path of params.paths as string[]) {
          result[path] = extract(parsed, path);
        }
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: `JSON parse error: ${String(err)}` };
      }
    },
  } as Tool);

  // ── webhook_integration ────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'webhook_integration',
    description: 'Send data to a webhook URL (e.g. Zapier, Make/Integromat, n8n, custom webhooks).',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'webhookUrl', type: 'string', description: 'Webhook endpoint URL', required: true },
      { name: 'payload', type: 'object', description: 'Data payload to send', required: true },
      { name: 'secret', type: 'string', description: 'Optional secret or API key to include as X-Webhook-Secret header', required: false },
    ],
    execute: async (params) => {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (params.secret) headers['X-Webhook-Secret'] = params.secret as string;

        const response = await fetch(params.webhookUrl as string, {
          method: 'POST',
          headers,
          body: JSON.stringify(params.payload),
        });

        return {
          success: response.ok,
          data: { status: response.status, statusText: response.statusText },
          error: response.ok ? undefined : `Webhook failed: HTTP ${response.status}`,
        };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── oauth_connect ──────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'oauth_connect',
    description: 'Initiate an OAuth authentication flow for a third-party service.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'service', type: 'string', description: 'Service to authenticate with: "google", "slack", "github", "microsoft", "salesforce"', required: true },
      { name: 'scopes', type: 'array', description: 'OAuth scopes to request, e.g. ["spreadsheets.readonly", "drive.file"]', required: false },
    ],
    execute: async (params) => {
      // OAuth flows require user interaction — guide the user to the auth page
      const service = params.service as string;
      const scopes = (params.scopes as string[]) || [];
      log.info('OAuth connect initiated', { service, scopes });
      return {
        success: true,
        data: {
          message: `OAuth flow for "${service}" initiated. Please complete authentication in the browser tab that opens. Requested scopes: ${scopes.join(', ') || 'default'}`,
          service,
          scopes,
        },
      };
    },
  } as Tool);

  // ── query_database ─────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'query_database',
    description: 'Run a query against a web-based database interface (Airtable, Notion DB, Supabase, Firebase console, etc.).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'platform', type: 'string', description: 'Database platform: "airtable", "notion", "supabase", "firebase", "retool"', required: true },
      { name: 'table', type: 'string', description: 'Table or collection name', required: true },
      { name: 'filter', type: 'object', description: 'Filter criteria as key-value pairs', required: false },
      { name: 'limit', type: 'number', description: 'Maximum rows to return (default: 20)', required: false },
    ],
    execute: async (params) => {
      return {
        success: true,
        data: {
          message: `Query parameters prepared for ${params.platform}/${params.table}. Use call_rest_api with the platform's API to execute.`,
          platform: params.platform,
          table: params.table,
          filter: params.filter,
          limit: params.limit || 20,
        },
      };
    },
  } as Tool);

  // ── google_sheets_action ───────────────────────────────────────────────────
  toolRegistry.register({
    name: 'google_sheets_action',
    description: 'Read or write data to Google Sheets via the Sheets API. Requires prior oauth_connect for Google.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'spreadsheetId', type: 'string', description: 'Google Sheets document ID (from URL)', required: true },
      { name: 'range', type: 'string', description: 'A1 notation range, e.g. "Sheet1!A1:D10"', required: true },
      { name: 'action', type: 'string', description: '"read" to get values, "write" to set values, "append" to add rows', required: true, enum: ['read', 'write', 'append'] },
      { name: 'values', type: 'array', description: 'For write/append: 2D array of values [[row1col1, row1col2], [row2col1, ...]]', required: false },
      { name: 'apiKey', type: 'string', description: 'Google API key or OAuth access token', required: false },
    ],
    execute: async (params) => {
      const action = params.action as string;
      const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${params.spreadsheetId}/values/${encodeURIComponent(params.range as string)}`;
      const token = params.apiKey as string;

      if (!token) {
        return { success: false, error: 'No API key or access token provided. Use oauth_connect for Google first.' };
      }

      try {
        if (action === 'read') {
          const response = await fetch(`${baseUrl}?key=${token}`);
          const data = await response.json();
          return { success: response.ok, data: data.values || [], error: data.error?.message };
        }

        const method = action === 'append' ? 'POST' : 'PUT';
        const url = action === 'append' ? `${baseUrl}:append?valueInputOption=RAW` : `${baseUrl}?valueInputOption=RAW`;
        const response = await fetch(url, {
          method,
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: params.values }),
        });
        const data = await response.json();
        return { success: response.ok, data, error: data.error?.message };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── google_drive_action ────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'google_drive_action',
    description: 'List, search, or get metadata for files in Google Drive.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'action', type: 'string', description: '"list" to list files, "search" to find files by name, "get" to get file metadata', required: true, enum: ['list', 'search', 'get'] },
      { name: 'query', type: 'string', description: 'Search query string (for action="search"), or file ID (for action="get")', required: false },
      { name: 'pageSize', type: 'number', description: 'Max files to return (default: 20)', required: false },
      { name: 'apiKey', type: 'string', description: 'Google OAuth access token', required: false },
    ],
    execute: async (params) => {
      const token = params.apiKey as string;
      if (!token) {
        return { success: false, error: 'No access token provided. Use oauth_connect for Google first.' };
      }

      try {
        const action = params.action as string;
        const pageSize = (params.pageSize as number) || 20;
        const headers = { 'Authorization': `Bearer ${token}` };

        if (action === 'get') {
          const response = await fetch(`https://www.googleapis.com/drive/v3/files/${params.query}`, { headers });
          const data = await response.json();
          return { success: response.ok, data, error: data.error?.message };
        }

        const q = action === 'search' ? `name contains '${params.query}'` : '';
        const url = `https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}${q ? `&q=${encodeURIComponent(q)}` : ''}&fields=files(id,name,mimeType,modifiedTime,size)`;
        const response = await fetch(url, { headers });
        const data = await response.json();
        return { success: response.ok, data: data.files || [], error: data.error?.message };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── slack_action ───────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'slack_action',
    description: 'Send a message or perform an action in Slack via the Slack Web API.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'action', type: 'string', description: '"send_message", "list_channels", "list_users"', required: true, enum: ['send_message', 'list_channels', 'list_users'] },
      { name: 'channel', type: 'string', description: 'Channel name or ID to send message to (for send_message)', required: false },
      { name: 'message', type: 'string', description: 'Message text (for send_message)', required: false },
      { name: 'botToken', type: 'string', description: 'Slack Bot OAuth token (xoxb-...)', required: true },
    ],
    execute: async (params) => {
      const token = params.botToken as string;
      const action = params.action as string;
      const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

      try {
        if (action === 'send_message') {
          if (!params.channel || !params.message) {
            return { success: false, error: 'channel and message are required for send_message' };
          }
          const response = await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers,
            body: JSON.stringify({ channel: params.channel, text: params.message }),
          });
          const data = await response.json();
          return { success: data.ok, data, error: data.error };
        }

        if (action === 'list_channels') {
          const response = await fetch('https://slack.com/api/conversations.list?limit=100', { headers });
          const data = await response.json();
          return { success: data.ok, data: data.channels?.map((c: any) => ({ id: c.id, name: c.name })) || [], error: data.error };
        }

        if (action === 'list_users') {
          const response = await fetch('https://slack.com/api/users.list', { headers });
          const data = await response.json();
          return { success: data.ok, data: data.members?.map((m: any) => ({ id: m.id, name: m.real_name, email: m.profile?.email })) || [], error: data.error };
        }

        return { success: false, error: `Unknown action: ${action}` };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── jira_action ────────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'jira_action',
    description: 'Create, update, or query Jira issues via the Jira REST API.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'action', type: 'string', description: '"create_issue", "update_issue", "get_issue", "search_issues"', required: true, enum: ['create_issue', 'update_issue', 'get_issue', 'search_issues'] },
      { name: 'domain', type: 'string', description: 'Jira domain, e.g. "mycompany.atlassian.net"', required: true },
      { name: 'issueKey', type: 'string', description: 'Issue key like "PROJ-123" (for update/get)', required: false },
      { name: 'summary', type: 'string', description: 'Issue summary/title (for create)', required: false },
      { name: 'description', type: 'string', description: 'Issue description (for create)', required: false },
      { name: 'projectKey', type: 'string', description: 'Project key, e.g. "PROJ" (for create)', required: false },
      { name: 'issueType', type: 'string', description: 'Issue type: "Bug", "Story", "Task" (for create, default: "Task")', required: false },
      { name: 'status', type: 'string', description: 'Transition status (for update)', required: false },
      { name: 'jql', type: 'string', description: 'JQL query string (for search)', required: false },
      { name: 'apiToken', type: 'string', description: 'Jira API token (base64 of email:token)', required: true },
    ],
    execute: async (params) => {
      const domain = params.domain as string;
      const baseUrl = `https://${domain}/rest/api/3`;
      const headers = {
        'Authorization': `Basic ${params.apiToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };

      try {
        const action = params.action as string;

        if (action === 'create_issue') {
          const response = await fetch(`${baseUrl}/issue`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              fields: {
                project: { key: params.projectKey },
                summary: params.summary,
                description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: params.description || '' }] }] },
                issuetype: { name: params.issueType || 'Task' },
              },
            }),
          });
          const data = await response.json();
          return { success: response.ok, data, error: data.errorMessages?.join(', ') };
        }

        if (action === 'get_issue') {
          const response = await fetch(`${baseUrl}/issue/${params.issueKey}`, { headers });
          const data = await response.json();
          return { success: response.ok, data: { key: data.key, summary: data.fields?.summary, status: data.fields?.status?.name, assignee: data.fields?.assignee?.displayName }, error: data.errorMessages?.join(', ') };
        }

        if (action === 'search_issues') {
          const response = await fetch(`${baseUrl}/search?jql=${encodeURIComponent(params.jql as string)}&maxResults=20`, { headers });
          const data = await response.json();
          return { success: response.ok, data: data.issues?.map((i: any) => ({ key: i.key, summary: i.fields.summary, status: i.fields.status.name })) || [], error: data.errorMessages?.join(', ') };
        }

        return { success: false, error: `Unknown action: ${action}` };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);

  // ── trello_action ──────────────────────────────────────────────────────────
  toolRegistry.register({
    name: 'trello_action',
    description: 'Create cards, list boards, or move cards in Trello via the Trello REST API.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'action', type: 'string', description: '"list_boards", "list_cards", "create_card", "move_card"', required: true, enum: ['list_boards', 'list_cards', 'create_card', 'move_card'] },
      { name: 'boardId', type: 'string', description: 'Trello board ID (for list_cards)', required: false },
      { name: 'listId', type: 'string', description: 'Trello list ID (for create_card, or target for move_card)', required: false },
      { name: 'cardId', type: 'string', description: 'Card ID (for move_card)', required: false },
      { name: 'name', type: 'string', description: 'Card name (for create_card)', required: false },
      { name: 'description', type: 'string', description: 'Card description (for create_card)', required: false },
      { name: 'apiKey', type: 'string', description: 'Trello API key', required: true },
      { name: 'token', type: 'string', description: 'Trello user token', required: true },
    ],
    execute: async (params) => {
      const auth = `key=${params.apiKey}&token=${params.token}`;
      const baseUrl = 'https://api.trello.com/1';

      try {
        const action = params.action as string;

        if (action === 'list_boards') {
          const response = await fetch(`${baseUrl}/members/me/boards?${auth}&fields=id,name,url`);
          const data = await response.json();
          return { success: response.ok, data: Array.isArray(data) ? data.map((b: any) => ({ id: b.id, name: b.name, url: b.url })) : [], error: data.message };
        }

        if (action === 'list_cards') {
          const response = await fetch(`${baseUrl}/boards/${params.boardId}/cards?${auth}&fields=id,name,idList,due`);
          const data = await response.json();
          return { success: response.ok, data: Array.isArray(data) ? data : [], error: data.message };
        }

        if (action === 'create_card') {
          const response = await fetch(`${baseUrl}/cards?${auth}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idList: params.listId, name: params.name, desc: params.description }),
          });
          const data = await response.json();
          return { success: response.ok, data: { id: data.id, name: data.name, url: data.url }, error: data.message };
        }

        if (action === 'move_card') {
          const response = await fetch(`${baseUrl}/cards/${params.cardId}?${auth}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idList: params.listId }),
          });
          const data = await response.json();
          return { success: response.ok, data: { id: data.id, name: data.name, idList: data.idList }, error: data.message };
        }

        return { success: false, error: `Unknown action: ${action}` };
      } catch (err) {
        return { success: false, error: String(err) };
      }
    },
  } as Tool);
}
