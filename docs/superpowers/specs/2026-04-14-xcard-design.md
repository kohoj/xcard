# XCard — Chrome Extension Design Spec

## Overview

XCard is a Chrome extension for X.com that generates shareable card images from tweets. When a user clicks share or a dedicated button on a tweet, XCard extracts the tweet data, calls X.com's internal Grok API to generate a structured TL;DR summary, renders a card image matching X.com's native theme, and copies it to the clipboard for easy sharing (e.g., via WeChat).

## Core User Flow

1. User sees a tweet on X.com they want to share
2. User triggers XCard via **share menu injection** or **action bar button**
3. Extension extracts tweet data (text, author, avatar, etc.)
4. Extension calls Grok API to generate a title (for regular tweets) and TL;DR
5. Card is rendered as an image matching X.com's current theme
6. Image is **auto-copied to clipboard** + **preview overlay** appears
7. User can change language, re-generate, or download from the overlay
8. User pastes the image into WeChat (or any other app)

## Architecture

```
Chrome Extension (Manifest V3)
├── content.js          — Injected into X.com pages
│   ├── DOM observation (MutationObserver)
│   ├── Tweet data extraction
│   ├── Share menu injection
│   ├── Action bar button injection
│   ├── Card rendering (HTML → html2canvas → PNG)
│   └── Preview overlay UI
├── background.js       — Service Worker
│   ├── Auth extraction (cookies, CSRF token)
│   ├── Grok API calls
│   ├── Avatar fetching (CORS bypass)
│   └── Clipboard write (PNG blob)
├── popup.html/js       — Extension popup (settings)
│   └── Language preference
├── lib/
│   ├── marked.min.js   — Markdown parser (~7KB)
│   └── html2canvas.min.js — DOM-to-image (~40KB)
├── icons/              — Extension icons (16/32/48/128)
└── manifest.json       — MV3 configuration
```

## Component Details

### 1. Content Script — Tweet Detection & Data Extraction

**DOM Selectors** (centralized in a selectors module):
- Tweet container: `article[data-testid="tweet"]`
- Tweet text: `[data-testid="tweetText"]`
- Author name: tweet article inner `a[role="link"] > div > span` (within user cell)
- Author handle: `a[role="link"][href^="/"]` with `@` prefix
- Avatar: `img[src*="pbs.twimg.com/profile_images"]` within tweet article
- Action bar: the row containing like/retweet/reply/share buttons
- Share button: `button[data-testid="share"]` or `[aria-label*="Share"]`

**MutationObserver Strategy**:
- Observe `document.body` with `childList: true, subtree: true`
- On mutation, scan for new `article[data-testid="tweet"]` elements
- Inject XCard button into each tweet's action bar
- Watch for share dropdown menu to appear → inject "XCard" menu item
- Debounce observations to avoid performance issues

**Data Extraction Output**:
```ts
{
  authorName: string,
  authorHandle: string,      // e.g., "@garrytan"
  authorAvatarUrl: string,
  tweetText: string,
  tweetUrl: string,
  isLongForm: boolean,       // article/note vs regular tweet
  articleTitle?: string,     // if long-form, extract from DOM
  timestamp: string,
  verified: boolean,
  verifiedType?: 'blue' | 'gold' | 'gray'
}
```

### 2. Service Worker — Auth & Grok API

**Authentication Chain**:
1. **Bearer Token**: Static public token embedded in X.com's JS bundle. Stored as constant, rarely changes.
2. **CSRF Token**: Read from `ct0` cookie via `chrome.cookies.get()`
3. **Session Cookies**: Automatically sent via `host_permissions` — no manual extraction needed

**Grok API Flow**:
1. Create conversation: `POST https://x.com/i/api/graphql/{queryId}/CreateGrokConversation`
2. Send prompt: `POST https://api.x.com/2/grok/add_response.json`
3. Parse response, extract generated text

**Grok Prompt Template**:
```
You are summarizing an X (Twitter) post. Respond in {language}.

Post by @{handle}:
---
{tweetText}
---

Generate:
1. A concise, descriptive title for this post (one line)
2. A TL;DR summary in markdown format. Use bullet points for key points, **bold** for emphasis. Be thorough but concise — aim for 3-8 bullet points depending on content length.

Format your response as:
TITLE: <title>
TLDR:
<markdown content>
```

For long-form articles with existing titles, skip title generation and only request TL;DR.

**Avatar Proxy**: Fetch avatar image in service worker (bypasses CORS), convert to base64 data URL, send back to content script.

### 3. Card Renderer

**Design**: Native X.com tweet style with full markdown TL;DR support.

**Card Structure**:
```
┌──────────────────────────────────┐
│ [Avatar] Author Name ✓  [X logo]│
│           @handle                │
│                                  │
│ Title (bold, 17px)               │
│                                  │
│ TL;DR body (markdown rendered):  │
│ - Paragraph text                 │
│ - **Bold** highlights            │
│ - • Bullet point lists           │
│ - *Italic* text                  │
│                                  │
│ ─────────────────────────────── │
│ Apr 14, 2026           𝕏 xcard  │
└──────────────────────────────────┘
```

**Theme Detection**:
- Read X.com's `background-color` from `document.body` or root element
- Map to three themes:
  - **Light**: `#ffffff` background, `#0f1419` text
  - **Dim**: `#15202b` background, `#e7e9ea` text
  - **Dark**: `#000000` / `#16181c` background, `#e7e9ea` text
- Card inherits the detected theme colors

**Markdown Rendering**:
- Use `marked.js` to parse Grok's markdown response
- Apply theme-aware CSS to rendered HTML (bold uses slightly brighter color for contrast)
- Sanitize output (strip scripts, limit to safe tags)

**Image Generation**:
- Render card as a hidden DOM element in content script
- Use `html2canvas` to capture as canvas
- Convert to PNG blob
- Target width: ~440px, height: auto (content-driven)

### 4. Preview Overlay

**Trigger**: Appears after card generation completes.

**UI Elements**:
- Semi-transparent backdrop over X.com page
- Modal with:
  - Card image preview (actual rendered PNG)
  - Language selector dropdown (中文, English, 日本語, 한국어, etc.)
  - "Copied!" status indicator (auto-copies on generation)
  - "Download" button (saves as PNG)
  - "Regenerate" button (re-calls Grok, useful after language change)
  - Close button (×) and click-outside-to-close

**Language Selection**:
- Default: saved preference from `chrome.storage.local`
- Changing language triggers Grok re-generation with new language in prompt
- Available languages: Chinese (中文), English, Japanese (日本語), Korean (한국어), Spanish, French, German — extensible list

### 5. Extension Popup

Minimal settings page:
- Default TL;DR language preference
- Nothing else — keep it simple

## Permissions (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "XCard",
  "description": "Generate shareable card images from X.com posts with AI-powered TL;DR",
  "version": "1.0.0",
  "permissions": [
    "cookies",
    "clipboardWrite",
    "storage"
  ],
  "host_permissions": [
    "https://x.com/*",
    "https://api.x.com/*",
    "https://pbs.twimg.com/*"
  ],
  "content_scripts": [{
    "matches": ["https://x.com/*"],
    "js": ["lib/marked.min.js", "lib/html2canvas.min.js", "content.js"],
    "css": ["content.css"]
  }],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "32": "icons/icon32.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "icons": {
    "16": "icons/icon16.png",
    "32": "icons/icon32.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  }
}
```

## Error Handling

- **Not logged in**: Detect missing `ct0` cookie → show toast "Please log in to X.com first"
- **Grok API failure**: Show error toast with retry button in overlay
- **Rate limited**: Show "Please wait a moment" toast, auto-retry after delay
- **DOM selector miss**: Graceful degradation — if data extraction partially fails, still generate card with available data
- **Clipboard write failure**: Fall back to download-only mode

## Testing Strategy

- Manual E2E testing on X.com with various tweet types:
  - Short tweet (< 280 chars)
  - Long tweet / thread
  - Tweet with article/note
  - Tweet with images/video
  - Tweet with verified author (blue/gold/gray badge)
  - Quote tweet
- Test all three themes (Light, Dim, Dark)
- Test language switching (Chinese, English, Japanese)
- Test clipboard paste into WeChat (macOS + Windows)
- Test share menu injection persistence across SPA navigation
