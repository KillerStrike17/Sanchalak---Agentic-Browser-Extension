// ─── Document Management Tools ───────────────────────────────────────────────
// Phase 4: PDF interaction, spreadsheets, presentations, word processors,
// file downloads, and document annotation.

import type { Tool } from '@shared/types/tools';
import { toolRegistry } from './tool-registry';
import { sendToTab, getActiveTab, ensureContentScript } from '@shared/messaging';

function createDocTool(tool: Omit<Tool, 'execute'>): Tool {
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

export function registerDocumentTools(): void {

  // ── PDF Tools ─────────────────────────────────────────────────────────────

  toolRegistry.register(createDocTool({
    name: 'read_pdf',
    description: 'Extract text and metadata from a PDF open in the browser (Chrome PDF viewer or embedded PDF).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'pages', type: 'string', description: 'Page range to extract, e.g. "1-5" or "all" (default: "all")', required: false },
      { name: 'includeMetadata', type: 'boolean', description: 'Also return document metadata (title, author, date)', required: false },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'annotate_pdf',
    description: 'Add a text annotation or highlight to a specific location in an open PDF.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'text', type: 'string', description: 'Annotation text to add', required: true },
      { name: 'page', type: 'number', description: 'Page number to annotate (1-indexed)', required: true },
      { name: 'type', type: 'string', description: '"comment", "highlight", "underline" (default: "comment")', required: false, enum: ['comment', 'highlight', 'underline'], default: 'comment' },
      { name: 'searchText', type: 'string', description: 'Text on the page to anchor the annotation to', required: false },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'download_document',
    description: 'Download or save the current document / file to disk.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'filename', type: 'string', description: 'Filename to save as (default: uses page title or URL filename)', required: false },
      { name: 'format', type: 'string', description: 'Download format: "pdf", "docx", "csv", "original" (default: "original")', required: false, enum: ['pdf', 'docx', 'csv', 'original'], default: 'original' },
    ],
  }));

  // ── Spreadsheet Tools ─────────────────────────────────────────────────────

  toolRegistry.register(createDocTool({
    name: 'read_spreadsheet',
    description: 'Read cell values and formulas from a spreadsheet open in the browser (Google Sheets, Excel Online, etc.).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'range', type: 'string', description: 'Cell range in A1 notation, e.g. "A1:D10" or "Sheet2!B2:E20"', required: false },
      { name: 'sheet', type: 'string', description: 'Sheet/tab name (default: active sheet)', required: false },
      { name: 'includeFormulas', type: 'boolean', description: 'Return cell formulas instead of computed values (default: false)', required: false },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'write_to_spreadsheet',
    description: 'Write or update cell values in a spreadsheet open in the browser.',
    category: 'data',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'range', type: 'string', description: 'Starting cell in A1 notation, e.g. "B2"', required: true },
      { name: 'values', type: 'array', description: '2D array of values to write, e.g. [["Name", "Score"], ["Alice", 95]]', required: true },
      { name: 'sheet', type: 'string', description: 'Sheet/tab name (default: active sheet)', required: false },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'add_spreadsheet_formula',
    description: 'Insert a formula into a specific cell in the current spreadsheet.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'cell', type: 'string', description: 'Target cell in A1 notation, e.g. "C5"', required: true },
      { name: 'formula', type: 'string', description: 'Formula to enter, e.g. "=SUM(A1:A10)"', required: true },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'create_chart',
    description: 'Create a chart from a data range in the current spreadsheet.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'dataRange', type: 'string', description: 'Data range for the chart in A1 notation', required: true },
      { name: 'chartType', type: 'string', description: 'Chart type: "bar", "line", "pie", "scatter", "area" (default: "bar")', required: false, enum: ['bar', 'line', 'pie', 'scatter', 'area'], default: 'bar' },
      { name: 'title', type: 'string', description: 'Chart title', required: false },
    ],
  }));

  // ── Word Processor Tools ──────────────────────────────────────────────────

  toolRegistry.register(createDocTool({
    name: 'read_document',
    description: 'Extract the full text content from a document open in a web editor (Google Docs, Office Online, Notion, etc.).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'includeComments', type: 'boolean', description: 'Also extract inline comments/suggestions (default: false)', required: false },
      { name: 'section', type: 'string', description: 'Extract only a named section/heading (default: full document)', required: false },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'insert_text_in_document',
    description: 'Insert or replace text at a specific location in the current document editor.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'text', type: 'string', description: 'Text to insert', required: true },
      { name: 'afterHeading', type: 'string', description: 'Insert after this heading text (locates insertion point)', required: false },
      { name: 'replaceText', type: 'string', description: 'Existing text to replace (if set, replaces first occurrence)', required: false },
      { name: 'position', type: 'string', description: '"start" or "end" of document (default: cursor position)', required: false, enum: ['start', 'end'] },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'add_comment_to_document',
    description: 'Add a comment or suggestion to a document in a collaborative editor.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'comment', type: 'string', description: 'Comment text', required: true },
      { name: 'anchorText', type: 'string', description: 'Text in the document to anchor the comment to', required: false },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'export_document',
    description: 'Export the current document to a specified format (PDF, DOCX, TXT, etc.).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'format', type: 'string', description: 'Export format: "pdf", "docx", "txt", "html", "odt" (default: "pdf")', required: false, enum: ['pdf', 'docx', 'txt', 'html', 'odt'], default: 'pdf' },
      { name: 'filename', type: 'string', description: 'Filename for the exported file (optional)', required: false },
    ],
  }));

  // ── Presentation Tools ────────────────────────────────────────────────────

  toolRegistry.register(createDocTool({
    name: 'read_presentation',
    description: 'Extract text content from slides in the current presentation (Google Slides, PowerPoint Online).',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'slideRange', type: 'string', description: 'Slide range, e.g. "1-5" or "all" (default: "all")', required: false },
      { name: 'includeSpeakerNotes', type: 'boolean', description: 'Also extract speaker notes (default: false)', required: false },
    ],
  }));

  toolRegistry.register(createDocTool({
    name: 'add_slide',
    description: 'Add a new slide to the current presentation with optional title and content.',
    category: 'data',
    safetyLevel: 'safe',
    parameters: [
      { name: 'title', type: 'string', description: 'Slide title', required: false },
      { name: 'content', type: 'string', description: 'Slide body text or bullet points (newline-separated)', required: false },
      { name: 'position', type: 'string', description: '"after_current", "end", or slide number (default: "end")', required: false },
      { name: 'layout', type: 'string', description: 'Slide layout: "blank", "title", "title_content", "two_column" (default: "title_content")', required: false },
    ],
  }));
}
