# Sanchalak — Comprehensive Testing Plan

## Overview

This document covers end-to-end testing for all four implementation phases of the Sanchalak Agentic Browser Extension. Tests are grouped by feature area. Each test includes prerequisites, steps, expected results, and what to watch for.

---

## Setup

### Extension Installation

1. Run `npx vite build` in the project root — verify zero errors, output in `dist/`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** → select the `dist/` folder.
4. Verify the Sanchalak icon appears in the toolbar.
5. Open the side panel via the toolbar icon or right-click → "Ask Sanchalak".
6. Open Chrome DevTools → **Service Worker** → inspect background logs.

### API Keys (required for some Phase 4 tests)

- Set your LLM API key in the extension Options page (`chrome-extension://<id>/options.html`).
- For Google Sheets/Drive tests: obtain a Google OAuth access token.
- For Slack tests: create a Slack bot and obtain an `xoxb-` token.
- For Jira tests: generate an API token from `id.atlassian.com`.

---

## Phase 1 — Navigation & Extraction

### 1.1 Page Navigation

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1.1.1 | Navigate to URL | Type: "Open https://example.com" | Page loads; agent confirms navigation |
| 1.1.2 | Go Back / Forward | Navigate to two pages, ask "go back" | Browser history traversed correctly |
| 1.1.3 | Refresh page | Ask "refresh this page" | Page reloads; agent confirms |
| 1.1.4 | Navigate to search | Ask "go to Google" | Navigates to google.com |

### 1.2 Page State & Extraction

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1.2.1 | Extract page text | Open any article, ask "what is this page about?" | Agent reads text and summarises accurately |
| 1.2.2 | Extract prices | Open Amazon/Flipkart product, ask "what is the price?" | Price value returned (e.g. "$49.99") |
| 1.2.3 | Extract emails | Open a contact page, ask "find all email addresses" | List of emails extracted |
| 1.2.4 | Extract table data | Open Wikipedia table, ask "extract the table" | Structured rows/columns returned |
| 1.2.5 | Extract URLs | Ask "list all links on this page" | Array of href values |
| 1.2.6 | Extract images | Ask "list images on this page" | Image src + alt text list |
| 1.2.7 | Extract structured data | Open a page with JSON-LD schema, ask "what structured data exists?" | Schema.org objects returned |
| 1.2.8 | Screenshot | Ask "take a screenshot" | Screenshot captured; confirmation shown |
| 1.2.9 | Get page state | Ask "describe the interactive elements on this page" | Buttons, inputs, links enumerated |

### 1.3 DOM Interaction

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1.3.1 | Click element | Ask "click the search button" | Button clicked; page responds |
| 1.3.2 | Type text | Ask "type 'Hello World' in the search box" | Text typed with realistic key events |
| 1.3.3 | Scroll down | Ask "scroll down" | Page scrolls |
| 1.3.4 | Select dropdown | Ask "select 'English' from the language dropdown" | Option selected |
| 1.3.5 | Toggle checkbox | Ask "check the newsletter checkbox" | Checkbox state toggled |
| 1.3.6 | Hover element | Ask "hover over the settings icon" | Hover event dispatched |
| 1.3.7 | Press key | Ask "press Escape" | Key event fired |

---

## Phase 2 — Forms & Shopping

### 2.1 Form Filling

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.1.1 | Fill text fields | Open a contact form, ask "fill in name=Alice, email=alice@example.com" | Fields populated with human-like events |
| 2.1.2 | Fill multiple fields | Ask "fill the registration form: first name=Bob, last name=Smith, email=bob@smith.com, password=Test1234!" | All fields filled in one operation |
| 2.1.3 | Handle autocomplete | Go to Google Maps, ask "search for Central Park" | Text typed, dropdown appears, matching option clicked |
| 2.1.4 | Date picker (native) | Open a form with `<input type="date">`, ask "set date to 2025-12-25" | Date input set correctly |
| 2.1.5 | Date picker (custom) | Open a hotel booking site, ask "check-in December 25" | Calendar navigated and day clicked |
| 2.1.6 | Time picker | Ask "set time to 14:30" | Time input filled (native or custom) |
| 2.1.7 | Multi-select | Ask "select Python, JavaScript, TypeScript from the skills list" | Multiple options checked |
| 2.1.8 | Rich text editor | Open a page with a Quill/Draft editor, ask "write a paragraph about AI" | Text inserted into rich editor |
| 2.1.9 | Multi-step form | Open a multi-step checkout, ask "go to the next step" | Next/Continue button clicked |
| 2.1.10 | Form validation | After submitting with missing fields, ask "check for validation errors" | Error messages listed |
| 2.1.11 | Dismiss popup | On a site with cookie banner, ask "dismiss the popup" | Banner closed before further interaction |
| 2.1.12 | CAPTCHA delegation | On a form with CAPTCHA, agent should prompt user | UI shows "Please solve the CAPTCHA" message |

### 2.2 Shopping

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.2.1 | Product search | Open Amazon, ask "search for wireless headphones under $50" | Search navigated; results page loaded |
| 2.2.2 | Filter results | Ask "filter by 4 stars and above" | Filter applied; results updated |
| 2.2.3 | Sort products | Ask "sort by price low to high" | Sort dropdown/button activated |
| 2.2.4 | View product | Ask "open the first result" | Product page opened |
| 2.2.5 | Check stock | Ask "is this product in stock?" | In-stock/Out-of-stock status returned |
| 2.2.6 | Get pricing | Ask "what is the price?" | Price extracted |
| 2.2.7 | Add to cart | Ask "add this to my cart" | Add-to-cart button found and clicked |
| 2.2.8 | View cart | Ask "show me my cart" | Cart items and total extracted |
| 2.2.9 | Apply coupon | Ask "apply coupon code SAVE20" | Coupon field found, code entered, applied |
| 2.2.10 | Remove from cart | Ask "remove the headphones from my cart" | Remove button found by product row |
| 2.2.11 | Update quantity | Ask "change quantity to 3" | Quantity input updated |
| 2.2.12 | Block complete purchase | Ask "complete the purchase" | Blocked response explaining user must confirm |
| 2.2.13 | Select shipping | Ask "select standard shipping" | Shipping radio button selected |

### 2.3 Email Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.3.1 | Read emails | Open Gmail, ask "what are my latest 5 emails?" | Inbox text extracted and summarised |
| 2.3.2 | Search emails | Ask "find emails from noreply@github.com" | Search query entered, results shown |
| 2.3.3 | Compose email | Ask "compose an email to alice@example.com" | Compose window opened |
| 2.3.4 | Send email (confirm) | Ask "send an email to bob@example.com saying hi" | Confirmation dialog shown; only sends after user approves |
| 2.3.5 | Reply to email | Open an email, ask "reply saying thanks" | Reply drafted; confirmation shown |
| 2.3.6 | Delete email (confirm) | Ask "delete this email" | Confirmation shown before deletion |
| 2.3.7 | Archive email | Ask "archive this email" | Archive action triggered |
| 2.3.8 | Add label | Ask "label this email as Important" | Label applied |

### 2.4 Research

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.4.1 | Web search | Ask "search for best Python web frameworks 2025" | Navigates to Google, extracts results |
| 2.4.2 | Compare options | Ask "compare the top 3 results on this page" | Comparison table or list returned |
| 2.4.3 | Collect data | Ask "collect all product names and prices on this page" | Structured list returned |
| 2.4.4 | Find competitors | Ask "find competitors of Notion on this page" | Competitor names extracted |
| 2.4.5 | Check stock price | Ask "what is Apple's stock price?" | Navigates to finance site; price extracted |

### 2.5 Conversation Buffer (Multi-Turn)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 2.5.1 | Reference prior turn | Turn 1: "search for laptops". Turn 2: "what was the first result?" | Agent references prior search without repeating it |
| 2.5.2 | Session turn counter | After 3 exchanges, check the side panel header | "3 turns in session" shown |
| 2.5.3 | New Chat clears buffer | Click "New Chat" | Session turns reset to 0; conversation cleared |
| 2.5.4 | Buffer size limit | Send 12 messages | Only last 10 pairs kept; no error thrown |

---

## Phase 3 — Calendar, Content, CRM, Workflows

### 3.1 Calendar & Booking

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.1.1 | Check availability | Open Google Calendar, ask "am I free next Monday at 3pm?" | Calendar text extracted; free/busy status reported |
| 3.1.2 | Create event | Ask "create a meeting titled 'Team Sync' on Friday at 2pm" | Event form filled and submitted after confirmation |
| 3.1.3 | Delete event (confirm) | Ask "delete the Team Sync event" | Confirmation dialog shown before deletion |
| 3.1.4 | Set reminder | Ask "set a 15-minute reminder for my next event" | Reminder field updated |
| 3.1.5 | Find meeting time | Ask "when is everyone free this week?" | Availability text extracted and summarised |
| 3.1.6 | Reschedule (confirm) | Ask "move the 2pm meeting to 4pm" | Confirmation of change shown |
| 3.1.7 | Book restaurant | Open a booking site, ask "book a table for 2 at 7pm tomorrow" | Form filled; confirmation step reached |
| 3.1.8 | Cancel booking (confirm) | Ask "cancel my reservation" | Confirmation required before proceeding |

### 3.2 Content Creation

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.2.1 | Create blog post | Open WordPress editor, ask "create a post titled 'AI in 2025' with intro paragraph" | Title and body fields filled |
| 3.2.2 | Edit content | Ask "change the first paragraph to focus on machine learning" | Content updated |
| 3.2.3 | Publish (confirm) | Ask "publish this post" | Confirmation shown; publishes after approval |
| 3.2.4 | Schedule post | Ask "schedule this for Jan 1 at 9am" | Date picker filled |
| 3.2.5 | Format text | Ask "make the heading bold" | Bold applied to heading |
| 3.2.6 | Check grammar | Ask "check this text for grammar errors" | Errors listed |
| 3.2.7 | Create social post (confirm) | Open LinkedIn, ask "post: 'Excited to share my latest article!'" | Confirmation shown before posting |
| 3.2.8 | Schedule tweet | Open Twitter/X, ask "schedule this tweet for tomorrow at 8am" | Date/time filled in scheduler |
| 3.2.9 | Add hashtags | Ask "add #AI #Tech hashtags to my post" | Hashtags appended in composer |
| 3.2.10 | Monitor mentions | Ask "search for mentions of 'Sanchalak' on this platform" | Search triggered; results extracted |

### 3.3 CRM

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.3.1 | Create lead | Open HubSpot/Salesforce, ask "create a lead: Alice Johnson, alice@acme.com, ACME Corp" | Lead form filled and submitted |
| 3.3.2 | Update lead status | Ask "move the ACME Corp deal to Proposal Sent" | Status field updated |
| 3.3.3 | Log interaction | Ask "log a call with Alice Johnson — discussed pricing, 30 minutes" | Interaction entry created |
| 3.3.4 | Schedule follow-up | Ask "set a follow-up with Alice for next Friday" | Follow-up task created |
| 3.3.5 | Add notes | Ask "add a note: interested in enterprise plan" | Note appended to record |
| 3.3.6 | Send follow-up email (confirm) | Ask "send Alice a follow-up about the proposal" | Email drafted; confirmation required |
| 3.3.7 | Create opportunity | Ask "create a deal: ACME Enterprise, $50,000, close date March 31" | Deal/opportunity form filled |

### 3.4 Workflow Automation

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 3.4.1 | List workflows | Ask "show me my saved workflows" | `list_workflows` returns saved automations |
| 3.4.2 | Run workflow | Ask "run the 'Daily Price Check' workflow" | `run_workflow` executed; status broadcast to UI |
| 3.4.3 | Scheduled workflow fires | Create a workflow with 1-minute interval; wait | Alarm fires; workflow run recorded in IndexedDB |
| 3.4.4 | Conditional step skip | Create workflow with condition `data.inStock == false`; step skips when in stock | Skipped step shows `{ skipped: true }` in run results |
| 3.4.5 | Workflow persistence | Reload extension; run `list_workflows` | Workflows survive service worker restart (IndexedDB) |
| 3.4.6 | DB version upgrade | Clear extension data; reload | DB_VERSION 2 migrations run cleanly (no console errors) |

---

## Phase 4 — Multi-Tab, API, Vision, Auth, Accessibility, Documents, Financial

### 4.1 Multi-Tab Coordination

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.1.1 | List all tabs | Ask "list my open tabs" | All tabs returned with IDs, titles, URLs |
| 4.1.2 | Filter tabs by URL | Ask "list tabs that have 'github' in the URL" | Only matching tabs shown |
| 4.1.3 | Read tab content | Ask "read the content of the tab with 'docs.python.org'" | Text extracted from non-active tab |
| 4.1.4 | Compare across tabs | Ask "compare the pricing pages on tabs 2 and 3" | Side-by-side text from both tabs |
| 4.1.5 | Execute in tab | Ask "click the search button on the Wikipedia tab" | Tool executed in target tab |
| 4.1.6 | Max 5 tabs limit | Compare more than 5 tabs | Only first 5 processed |

### 4.2 API & Service Integration

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.2.1 | REST API GET | Ask "call https://jsonplaceholder.typicode.com/posts/1" | JSON response returned with status 200 |
| 4.2.2 | REST API POST | Ask "POST to https://jsonplaceholder.typicode.com/posts with {title: 'test'}" | Response shows created resource |
| 4.2.3 | Parse JSON | Ask "extract the title from {\"title\": \"Hello\", \"id\": 1}" | `{ "title": "Hello" }` returned |
| 4.2.4 | Webhook (confirm) | Ask "send {event: 'test'} to a webhook URL" | Confirmation shown; POST sent after approval |
| 4.2.5 | Google Sheets read | Ask "read cells A1:C5 from sheet ID <id>" with API token | Cell values returned |
| 4.2.6 | Google Sheets write | Ask "write 'Hello' to cell B2" | Confirmation shown; write executed |
| 4.2.7 | Slack message (confirm) | Ask "send 'Hello team' to #general" | Confirmation; message posted via Slack API |
| 4.2.8 | Jira create issue | Ask "create a Jira bug 'Login fails on mobile'" | Issue created; key returned |
| 4.2.9 | Trello create card | Ask "create a Trello card 'Fix header' in the To Do list" | Card created with URL |
| 4.2.10 | OAuth initiate | Ask "connect to Google" | OAuth guidance message shown |

### 4.3 Vision & ML

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.3.1 | Identify UI elements | Ask "what interactive elements are on this page?" | Buttons, inputs, links enumerated with selectors |
| 4.3.2 | Filter by type | Ask "list only the buttons on this page" | Only button elements returned |
| 4.3.3 | Read visual content | Ask "describe the images on this page" | Alt text, titles, ARIA labels returned |
| 4.3.4 | Describe layout | Ask "describe the layout of this page" | Header, nav, main, footer sections identified |
| 4.3.5 | Verify visual change | Click a button, ask "is the modal now open?" | Checks DOM for expected element |
| 4.3.6 | OCR from image | Ask "read the text in the first image" | Alt text or canvas fallback returned |
| 4.3.7 | Score options | Ask "rank these 3 jobs by salary and remote-friendliness: [...]" | Ranked list with scores and reasoning |
| 4.3.8 | Generate variations | Ask "give me 3 headline variations for 'Boost your productivity'" | 3 headline options returned |
| 4.3.9 | Capture screenshot | Ask "take a screenshot" | Base64 PNG data URL returned |

### 4.4 Authentication

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.4.1 | Login (confirm) | Open a login page, ask "login as test@example.com" | Confirmation required; username/password filled and submitted after approval |
| 4.4.2 | Auto-detect fields | On a login page with non-standard field names, ask to login | Agent finds email + password fields via multiple selectors |
| 4.4.3 | Logout | Ask "log me out" | Logout button found and clicked (with confirmation) |
| 4.4.4 | Reset password (confirm) | Ask "reset my password for test@example.com" | Forgot password link clicked; email typed; form submitted |
| 4.4.5 | Handle 2FA | Ask "enter the code 123456" | OTP field found; code entered; form submitted |
| 4.4.6 | Create account (confirm) | Ask "create account with email=new@user.com" | Registration form filled after confirmation |
| 4.4.7 | Change password (confirm) | Ask "change my password to NewPass123!" | Password form filled after confirmation |
| 4.4.8 | Password not echoed | After login, check agent response | Password value NOT shown in any response text |

### 4.5 Accessibility

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.5.1 | Text to speech | Ask "read this page aloud" | Speech synthesis starts; page text spoken |
| 4.5.2 | Read selection | Select text on page, ask "read what I selected" | Selected text is spoken |
| 4.5.3 | Stop speech | While reading, ask "stop reading" | `speechSynthesis.cancel()` called; speech stops |
| 4.5.4 | Custom rate | Ask "read aloud at speed 1.5" | Speech rate parameter set to 1.5 |
| 4.5.5 | High contrast | Ask "enable high contrast mode" | Page background turns black, text white |
| 4.5.6 | Low contrast | Ask "enable low contrast mode" | Page filter: contrast(60%) applied |
| 4.5.7 | Turn off contrast | Ask "turn off contrast mode" | Injected style element removed |
| 4.5.8 | Increase font size | Ask "make the text bigger" | `html { font-size: 140% }` injected |
| 4.5.9 | Reset font size | Ask "reset font size" | Font style element removed |
| 4.5.10 | Keyboard nav enhancement | Ask "enable keyboard navigation" | Orange focus rings added; ARIA elements get tabindex=0 |
| 4.5.11 | Focus next element | Ask "focus the next element" | `document.activeElement` moves to next focusable element |

### 4.6 Document Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.6.1 | Read PDF | Open a PDF in Chrome, ask "what is this PDF about?" | Text extracted from PDF viewer |
| 4.6.2 | Read Google Doc | Open a Google Doc, ask "summarise this document" | Document text extracted |
| 4.6.3 | Read spreadsheet | Open Google Sheets, ask "what data is in this sheet?" | Cell contents extracted |
| 4.6.4 | Read presentation | Open Google Slides, ask "list the slide titles" | Slide text extracted |
| 4.6.5 | Insert text in doc | Ask "add a paragraph about AI at the end" | Text inserted into active editor |
| 4.6.6 | Write to spreadsheet (confirm) | Ask "write 'Q1 Total' in cell A1" | Confirmation shown; cell updated |
| 4.6.7 | Export document | Ask "export this as PDF" | Export/download menu triggered |
| 4.6.8 | Download file | Ask "download this file" | Download triggered |
| 4.6.9 | Google Sheets API | Ask "read cells A1:B5 from sheet <id>" with token | API call made; values returned |

### 4.7 Financial Tools

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 4.7.1 | Stock price | Ask "what is Apple's stock price?" | Real-time price from Yahoo Finance returned |
| 4.7.2 | Crypto price | Ask "what is Bitcoin's price in USD?" | CoinGecko price + 24h change returned |
| 4.7.3 | Currency conversion | Ask "convert 100 USD to INR" | Frankfurter rate × 100 returned with date |
| 4.7.4 | Read portfolio | Open Zerodha/Groww holdings page, ask "what is my portfolio?" | Holdings text extracted |
| 4.7.5 | Read transactions | Open a bank statement page, ask "show my last 10 transactions" | Transaction list extracted |
| 4.7.6 | Read invoice | Open an invoice PDF/page, ask "extract the line items" | Items, amounts, totals returned |
| 4.7.7 | Calculate expenses | Ask "calculate my monthly expense breakdown from [transactions]" | Category totals + percentages returned |
| 4.7.8 | Block execute_trade | Ask "buy 10 shares of AAPL" | Blocked with clear explanation message |
| 4.7.9 | Block transfer_funds | Ask "transfer $500 to account 12345" | Blocked with clear explanation message |

---

## Error Handling & Edge Cases

### 5.1 Content Script Injection

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.1.1 | chrome:// page | Navigate to `chrome://settings`, issue a command | Graceful error: "Cannot inject content script on this page" |
| 5.1.2 | Slow page load | Start command on a slow page | `ensureContentScript` retries; eventually succeeds or times out gracefully |
| 5.1.3 | Content script ping | After injection, PING returns `{pong: true}` | Message channel confirmed open |

### 5.2 Tool Failures

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.2.1 | Element not found | Ask "click a button that doesn't exist" | Error returned; agent tries alternative approach |
| 5.2.2 | API timeout | Call `call_rest_api` to a slow endpoint | `fetch` throws; error returned with message |
| 5.2.3 | Invalid JSON | `parse_json` with malformed string | `{ success: false, error: "JSON parse error: ..." }` |
| 5.2.4 | No active tab | All tools requiring `getActiveTab` | Error: "No active tab" returned |
| 5.2.5 | Tool not found | Unknown tool name dispatched | `throw new Error("Unknown tool: <name>")` caught; `{ success: false }` |

### 5.3 Service Worker Lifecycle

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.3.1 | SW restart mid-task | Kill service worker during task | Next command starts fresh; no crash |
| 5.3.2 | Alarm survives SW restart | Schedule a workflow, restart SW | `chrome.alarms` re-fires; `initScheduler` re-attaches listener |
| 5.3.3 | Conversation buffer after restart | After SW restart, send a message referencing prior turn | Buffer cleared (in-memory); agent handles gracefully |

### 5.4 Confirmation Flow

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 5.4.1 | Confirm approve | Trigger a confirm-level tool; click "Approve" | Action executes |
| 5.4.2 | Confirm deny | Trigger a confirm-level tool; click "Deny" | Action cancelled; agent reports back |
| 5.4.3 | Confirm timeout | Trigger confirm; wait 2 minutes without responding | Auto-denied after 120 seconds |
| 5.4.4 | Block-level tool | Issue a command that requires a blocked tool | `safetyLevel: 'block'` response with explanation |

---

## Build Verification

### 6.1 Build & Load

```bash
# Clean build
npx vite build

# Expected output
# ✓ 60+ modules transformed
# dist/background/service-worker.js
# dist/sidepanel/index.html
# dist/content/index.js
# dist/popup/index.html
# dist/options/index.html
```

Check for:
- Zero TypeScript errors
- Zero unused import errors
- All tool files present in output bundle
- `manifest.json` valid (run `chrome://extensions` → "Errors" button)

### 6.2 Type Safety Spot Checks

| File | Check |
|------|-------|
| `service-worker.ts` | All `register*Tools()` calls match exported function names |
| `content/index.ts` | All accessibility imports used in switch cases |
| `workflow/engine.ts` | `WorkflowRun.triggeredBy` accepts `'manual' \| 'schedule' \| 'event'` |
| `api.tools.ts` | `fetch` calls have `try/catch` returning `{ success: false, error }` |
| `financial.tools.ts` | Blocked tools return `{ success: false, error: '⛔ ...' }` |

---

## Performance & Stress Tests

| # | Test | Target |
|---|------|--------|
| P1 | Extract text from a 500KB page | < 2 seconds |
| P2 | compare_across_tabs with 5 tabs | < 10 seconds total |
| P3 | 10 consecutive tool calls in one task | No memory leak; SW stays alive |
| P4 | Conversation buffer with 10 turns | LLM context < 8000 tokens |
| P5 | Google Sheets read 100 rows | Response < 3 seconds |

---

## Security Tests

| # | Test | Expected |
|---|------|----------|
| S1 | Password field inspection | Agent never returns password value in response text |
| S2 | XSS via page text | Malicious script tags in page text do not execute |
| S3 | Webhook URL injection | `params.webhookUrl` used as-is only after user confirms |
| S4 | OAuth token logging | Token value not logged to console |
| S5 | Block: execute_trade | Always returns blocked message regardless of framing |
| S6 | Block: transfer_funds | Always returns blocked message regardless of framing |
| S7 | Block: complete_purchase | Always returns blocked message regardless of framing |

---

## Regression Tests (run after any change)

1. Build succeeds: `npx vite build`
2. Extension loads without errors in `chrome://extensions`
3. Side panel opens and shows "New session" label
4. Ask: "What page am I on?" → agent responds with current URL/title
5. Ask: "Click the first link on this page" → link clicked
6. New Chat resets session counter to 0
7. Workflow scheduler initialises (check background console for "Workflow scheduler initialised")
8. `get_all_tabs` returns at least one tab

---

## Test Environment Matrix

| Browser | OS | Extension Mode | Notes |
|---------|----|----|-------|
| Chrome 120+ | Windows 11 | Unpacked (dev) | Primary target |
| Chrome 120+ | macOS 14 | Unpacked (dev) | Secondary |
| Chrome Canary | Windows 11 | Unpacked | Test MV3 edge cases |

---

*Last updated: 2026-04-05*
