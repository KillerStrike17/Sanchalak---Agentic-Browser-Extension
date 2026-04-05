// ─── Tool Registry ─────────────────────────────────────────────────────────
// Central registry of all available browser tools/actions.

import type { Tool, ToolDescription } from '@shared/types/tools';
import { toolToDescription } from '@shared/types/tools';

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  getDescriptions(): ToolDescription[] {
    return this.getAll().map(toolToDescription);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  getByCategory(category: string): Tool[] {
    return this.getAll().filter((t) => t.category === category);
  }
}

export const toolRegistry = new ToolRegistry();
