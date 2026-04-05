// ─── Content Creation & Social Media Tools ──────────────────────────────────
// Phase 3: Blog posts, CMS editing, social media posting, content scheduling.

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

export function registerContentTools(): void {

  // ── Content Operations (10 tools) ────────────────────────────────────────

  toolRegistry.register(createContentTool({
    name: 'create_blog_post',
    description: 'Create a new blog post or article in a CMS (WordPress, Ghost, Medium, Substack, etc.).',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'title', type: 'string', description: 'Blog post title', required: true },
      { name: 'content', type: 'string', description: 'Post body content (Markdown or plain text)', required: true },
      { name: 'tags', type: 'string', description: 'Comma-separated tags', required: false },
      { name: 'category', type: 'string', description: 'Post category', required: false },
      { name: 'saveAsDraft', type: 'boolean', description: 'Save as draft instead of publishing (default: true)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'edit_content',
    description: 'Edit existing content on the current page — find a section by heading or selector and update its text.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the content element to edit', required: false },
      { name: 'heading', type: 'string', description: 'Heading text near the content to find', required: false },
      { name: 'newContent', type: 'string', description: 'Replacement content', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'publish_content',
    description: 'Publish or schedule a draft post/article. Requires confirmation.',
    category: 'content',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'publishNow', type: 'boolean', description: 'Publish immediately (true) or schedule (false, default: true)', required: false },
      { name: 'scheduledDate', type: 'string', description: 'Schedule date in YYYY-MM-DD HH:MM if not publishing immediately', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'schedule_post',
    description: 'Set a future publication date/time for a draft post.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'publishAt', type: 'string', description: 'Publication datetime in YYYY-MM-DD HH:MM format', required: true },
      { name: 'timezone', type: 'string', description: 'Timezone for the publication time (e.g. "America/New_York")', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'upload_image',
    description: 'Upload an image to a CMS media library or insert it into a content editor.',
    category: 'content',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'altText', type: 'string', description: 'Alt text for the uploaded image', required: false },
      { name: 'caption', type: 'string', description: 'Image caption', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'add_video',
    description: 'Embed a video into a content editor by URL (YouTube, Vimeo, etc.).',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'videoUrl', type: 'string', description: 'URL of the video to embed', required: true },
      { name: 'caption', type: 'string', description: 'Optional caption below the video', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'format_text',
    description: 'Apply text formatting (bold, italic, heading, list, etc.) to selected text in an editor.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'format', type: 'string', description: 'Formatting to apply: "bold", "italic", "underline", "h1"-"h6", "bullet-list", "numbered-list", "quote", "code"', required: true },
      { name: 'text', type: 'string', description: 'Text to find and format (if not already selected)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'create_headline',
    description: 'Generate and insert SEO-optimised headline options for a blog post or article.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'topic', type: 'string', description: 'Topic or brief description of the content', required: true },
      { name: 'count', type: 'number', description: 'Number of headline options to generate (default: 3)', required: false },
      { name: 'tone', type: 'string', description: 'Tone of the headline: "professional", "casual", "clickbait", "educational"', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'edit_for_tone',
    description: 'Rewrite selected text or the current editor content in a specified tone.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'tone', type: 'string', description: 'Target tone: "formal", "casual", "friendly", "authoritative", "empathetic"', required: true },
      { name: 'selector', type: 'string', description: 'CSS selector of the text to rewrite (default: main editor)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'check_grammar',
    description: 'Check the current text for grammar and spelling errors and report issues.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'selector', type: 'string', description: 'CSS selector of the text area to check (default: main content)', required: false },
      { name: 'autoFix', type: 'boolean', description: 'Automatically fix obvious errors (default: false — report only)', required: false },
    ],
  }));

  // ── Social Media (8 tools) ────────────────────────────────────────────────

  toolRegistry.register(createContentTool({
    name: 'create_social_post',
    description: 'Compose a new social media post on the current platform (LinkedIn, Twitter/X, Facebook, Instagram).',
    category: 'content',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'content', type: 'string', description: 'Post content/text', required: true },
      { name: 'hashtags', type: 'string', description: 'Space-separated hashtags to append, e.g. "#AI #Tech"', required: false },
      { name: 'postNow', type: 'boolean', description: 'Post immediately (true) or save as draft (false, default: false)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'schedule_tweet',
    description: 'Schedule a tweet or X post for a future date and time.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'content', type: 'string', description: 'Tweet text (max 280 characters)', required: true },
      { name: 'scheduledAt', type: 'string', description: 'Scheduled datetime in YYYY-MM-DD HH:MM', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'like_follow',
    description: 'Like a post or follow an account on the current social media platform.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'action', type: 'string', description: '"like" or "follow"', required: true, enum: ['like', 'follow'] },
      { name: 'target', type: 'string', description: 'Username or post URL to like/follow (default: current post/profile)', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'reply_to_comment',
    description: 'Reply to a comment or thread on a social media post.',
    category: 'content',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'commentText', type: 'string', description: 'Partial text of the comment to reply to', required: false },
      { name: 'reply', type: 'string', description: 'Your reply text', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'share_post',
    description: 'Share or repost a social media post to your timeline.',
    category: 'content',
    safetyLevel: 'confirm',
    parameters: [
      { name: 'commentary', type: 'string', description: 'Optional text to add when sharing', required: false },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'add_hashtags',
    description: 'Append relevant hashtags to text in the current social media composer.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'hashtags', type: 'string', description: 'Hashtags to add, e.g. "#AI #MachineLearning #Tech"', required: true },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'create_image_caption',
    description: 'Generate a caption for an image based on the image description or ALT text on the page.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'imageSelector', type: 'string', description: 'CSS selector of the image to caption', required: false },
      { name: 'style', type: 'string', description: 'Caption style: "professional", "casual", "funny", "poetic"', required: false, enum: ['professional', 'casual', 'funny', 'poetic'], default: 'professional' },
    ],
  }));

  toolRegistry.register(createContentTool({
    name: 'monitor_mentions',
    description: 'Search for mentions of a brand, keyword, or hashtag on the current social platform.',
    category: 'content',
    safetyLevel: 'safe',
    parameters: [
      { name: 'keyword', type: 'string', description: 'Brand name, keyword, or hashtag to search for', required: true },
      { name: 'limit', type: 'number', description: 'Maximum results to return (default: 10)', required: false },
    ],
  }));
}
