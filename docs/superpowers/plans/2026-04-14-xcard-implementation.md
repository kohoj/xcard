# XCard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome extension that generates shareable card images from X.com posts with AI-powered TL;DR via Grok.

**Architecture:** MV3 Chrome extension. Content scripts (loaded in order, sharing `XCard` namespace) handle DOM interaction, tweet extraction, card rendering, and overlay UI. A background service worker handles auth, Grok API calls, and avatar proxying. No build tools — pure ES5+/ES6 with ordered script loading.

**Tech Stack:** Manifest V3, html2canvas, marked.js, Chrome Cookies API, Clipboard API

---

## File Map

```
xcard/
├── manifest.json                  — MV3 config, permissions, script loading order
├── background.js                  — Service Worker: auth, Grok API, avatar proxy
├── content/
│   ├── selectors.js               — Centralized DOM selectors (loaded 1st)
│   ├── theme.js                   — X.com theme detection (loaded 2nd)
│   ├── extractor.js               — Tweet data extraction from DOM (loaded 3rd)
│   ├── toast.js                   — Toast notification UI (loaded 4th)
│   ├── card.js                    — Card HTML builder + image capture (loaded 5th)
│   ├── overlay.js                 — Preview overlay modal (loaded 6th)
│   ├── index.js                   — Entry point: MutationObserver, button injection (loaded last)
│   └── styles.css                 — All injected styles
├── popup/
│   ├── index.html                 — Settings popup HTML
│   └── index.js                   — Settings popup logic
├── lib/
│   ├── marked.min.js              — Markdown parser (~7KB)
│   └── html2canvas.min.js         — DOM-to-image (~40KB)
├── icons/
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── scripts/
    └── generate-icons.html        — One-time icon generator (open in browser)
```

**Namespace Convention:** Every file in `content/` registers its exports on `window.XCard`. Files are loaded in dependency order via manifest.json `content_scripts.js` array.

---

### Task 1: Project Scaffold

**Files:**
- Create: `manifest.json`
- Create: `background.js`
- Create: `content/index.js`
- Create: `content/styles.css`
- Create: `scripts/generate-icons.html`
- Create: `icons/` (generated PNGs)
- Download: `lib/marked.min.js`, `lib/html2canvas.min.js`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p xcard/{content,popup,lib,icons,scripts}
```

- [ ] **Step 2: Create manifest.json**

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
  "content_scripts": [
    {
      "matches": ["https://x.com/*"],
      "js": [
        "lib/marked.min.js",
        "lib/html2canvas.min.js",
        "content/selectors.js",
        "content/theme.js",
        "content/extractor.js",
        "content/toast.js",
        "content/card.js",
        "content/overlay.js",
        "content/index.js"
      ],
      "css": ["content/styles.css"],
      "run_at": "document_idle"
    }
  ],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup/index.html",
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

- [ ] **Step 3: Create icon generator**

Create `scripts/generate-icons.html` — open this file in a browser, it generates and downloads all icon sizes:

```html
<!DOCTYPE html>
<html>
<body>
<script>
[16, 32, 48, 128].forEach(size => {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  // Background circle
  ctx.fillStyle = '#1d9bf0';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  // "X" letter
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${size * 0.5}px -apple-system, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('X', size / 2, size / 2);

  // Small card icon indicator (bottom-right)
  const r = size * 0.18;
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.9;
  ctx.fillRect(size - r * 2.2, size - r * 2.2, r * 2, r * 1.6);
  ctx.globalAlpha = 1;

  c.toBlob(blob => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `icon${size}.png`;
    a.click();
  });
});
</script>
<p>Icons downloading...</p>
</body>
</html>
```

- [ ] **Step 4: Generate icons**

Open `scripts/generate-icons.html` in Chrome. Move the downloaded files to `icons/`.

- [ ] **Step 5: Download libraries**

```bash
cd xcard/lib
curl -L -o marked.min.js "https://cdn.jsdelivr.net/npm/marked@15.0.7/marked.min.js"
curl -L -o html2canvas.min.js "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js"
```

- [ ] **Step 6: Create minimal background.js**

```js
// XCard Background Service Worker
// Handles: auth, Grok API, avatar proxy

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ status: 'ok' });
  }
  return true;
});

console.log('[XCard] Service worker started');
```

- [ ] **Step 7: Create minimal content/index.js**

```js
// XCard Content Script — Entry Point
window.XCard = window.XCard || {};

(function () {
  'use strict';
  console.log('[XCard] Content script loaded on', window.location.href);
})();
```

- [ ] **Step 8: Create empty content/styles.css**

```css
/* XCard — Injected Styles */
```

- [ ] **Step 9: Create stub files for all content modules**

Create each of these with the namespace registration:

`content/selectors.js`:
```js
window.XCard = window.XCard || {};
XCard.Selectors = {};
```

`content/theme.js`:
```js
window.XCard = window.XCard || {};
XCard.Theme = {};
```

`content/extractor.js`:
```js
window.XCard = window.XCard || {};
XCard.Extractor = {};
```

`content/toast.js`:
```js
window.XCard = window.XCard || {};
XCard.Toast = {};
```

`content/card.js`:
```js
window.XCard = window.XCard || {};
XCard.Card = {};
```

`content/overlay.js`:
```js
window.XCard = window.XCard || {};
XCard.Overlay = {};
```

- [ ] **Step 10: Load extension in Chrome and verify**

1. Open `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `xcard/` directory
4. Navigate to `https://x.com`
5. Open DevTools console
6. Expected: `[XCard] Content script loaded on https://x.com/...`
7. Go to service worker console (click "Inspect" on extension card)
8. Expected: `[XCard] Service worker started`

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: project scaffold with manifest, icons, and library deps"
```

---

### Task 2: Theme Detection

**Files:**
- Modify: `content/theme.js`

- [ ] **Step 1: Implement theme detection**

```js
window.XCard = window.XCard || {};

XCard.Theme = (function () {
  'use strict';

  var THEMES = {
    light: {
      name: 'light',
      cardBg: '#ffffff',
      cardBorder: '#e0e4e8',
      textPrimary: '#0f1419',
      textSecondary: '#536471',
      textTertiary: '#536471',
      boldText: '#2c3640',
      divider: '#e0e4e8',
      accentBlue: '#1d9bf0',
      pageBg: '#e8ecef'
    },
    dim: {
      name: 'dim',
      cardBg: '#15202b',
      cardBorder: '#38444d',
      textPrimary: '#e7e9ea',
      textSecondary: '#8b98a5',
      textTertiary: '#8b98a5',
      boldText: '#c8cdd2',
      divider: '#38444d',
      accentBlue: '#1d9bf0',
      pageBg: '#0d1117'
    },
    dark: {
      name: 'dark',
      cardBg: '#16181c',
      cardBorder: '#2f3336',
      textPrimary: '#e7e9ea',
      textSecondary: '#71767b',
      textTertiary: '#71767b',
      boldText: '#c8cdd2',
      divider: '#2f3336',
      accentBlue: '#1d9bf0',
      pageBg: '#000000'
    }
  };

  function detect() {
    var bg = getComputedStyle(document.body).backgroundColor;
    var rgb = bg.match(/\d+/g);
    if (!rgb) return THEMES.dark;

    var r = parseInt(rgb[0], 10);
    var g = parseInt(rgb[1], 10);
    var b = parseInt(rgb[2], 10);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b);

    if (luminance > 200) return THEMES.light;
    if (luminance > 30) return THEMES.dim;
    return THEMES.dark;
  }

  return {
    THEMES: THEMES,
    detect: detect
  };
})();
```

- [ ] **Step 2: Verify in console**

Navigate to x.com, open DevTools, run:
```js
console.log(XCard.Theme.detect());
```
Expected: Returns theme object matching the current X.com theme. Switch X.com theme in Settings → Display and re-run to verify all three.

- [ ] **Step 3: Commit**

```bash
git add content/theme.js
git commit -m "feat: add X.com theme detection (light/dim/dark)"
```

---

### Task 3: DOM Selectors

**Files:**
- Modify: `content/selectors.js`

- [ ] **Step 1: Define all selectors**

```js
window.XCard = window.XCard || {};

XCard.Selectors = {
  // Tweet structure
  TWEET_ARTICLE: 'article[data-testid="tweet"]',
  TWEET_TEXT: '[data-testid="tweetText"]',
  USER_AVATAR: 'img[src*="pbs.twimg.com/profile_images"]',

  // Action bar buttons
  SHARE_BUTTON: '[data-testid="share"]',
  ACTION_BAR: '[role="group"]',

  // Share dropdown menu (appears on share click)
  SHARE_MENU: '[data-testid="Dropdown"]',
  SHARE_MENU_ITEM: '[role="menuitem"]',

  // Verified badges
  VERIFIED_BADGE: 'svg[data-testid="icon-verified"]',

  // XCard injected elements (for dedup)
  XCARD_BUTTON: '[data-xcard-button]',
  XCARD_MENU_ITEM: '[data-xcard-menu-item]',

  // Overlay
  XCARD_OVERLAY: '#xcard-overlay',
  XCARD_CARD_CONTAINER: '#xcard-card-container'
};
```

- [ ] **Step 2: Verify selectors on live X.com**

Open DevTools on x.com, test each selector:
```js
document.querySelectorAll(XCard.Selectors.TWEET_ARTICLE).length; // > 0
document.querySelector(XCard.Selectors.TWEET_TEXT); // not null
```

- [ ] **Step 3: Commit**

```bash
git add content/selectors.js
git commit -m "feat: add centralized DOM selectors for X.com elements"
```

---

### Task 4: Tweet Data Extraction

**Files:**
- Modify: `content/extractor.js`

- [ ] **Step 1: Implement extraction from tweet article element**

```js
window.XCard = window.XCard || {};

XCard.Extractor = (function () {
  'use strict';

  var S = XCard.Selectors;

  function extractFromArticle(article) {
    return {
      authorName: getAuthorName(article),
      authorHandle: getAuthorHandle(article),
      authorAvatarUrl: getAvatarUrl(article),
      tweetText: getTweetText(article),
      tweetUrl: getTweetUrl(article),
      timestamp: getTimestamp(article),
      verified: isVerified(article),
      verifiedType: getVerifiedType(article)
    };
  }

  function getAuthorName(article) {
    // The author name is in the first link within the tweet's user info area.
    // It's inside a span with dir="auto" within the first link group.
    var userCell = article.querySelector('[data-testid="User-Name"]');
    if (!userCell) return 'Unknown';
    var nameSpan = userCell.querySelector('a[role="link"] span');
    return nameSpan ? nameSpan.textContent.trim() : 'Unknown';
  }

  function getAuthorHandle(article) {
    var userCell = article.querySelector('[data-testid="User-Name"]');
    if (!userCell) return '@unknown';
    // The handle link contains text starting with @
    var links = userCell.querySelectorAll('a[role="link"]');
    for (var i = 0; i < links.length; i++) {
      var text = links[i].textContent.trim();
      if (text.startsWith('@')) return text;
    }
    // Fallback: extract from href
    var link = userCell.querySelector('a[href^="/"]');
    if (link) {
      var href = link.getAttribute('href');
      return '@' + href.replace(/^\//, '').split('/')[0];
    }
    return '@unknown';
  }

  function getAvatarUrl(article) {
    var img = article.querySelector(S.USER_AVATAR);
    if (!img) return '';
    // Request higher-res version: replace _normal with _400x400
    return img.src.replace(/_normal\./, '_400x400.');
  }

  function getTweetText(article) {
    var textEl = article.querySelector(S.TWEET_TEXT);
    if (!textEl) return '';
    return textEl.innerText.trim();
  }

  function getTweetUrl(article) {
    // Find the timestamp link which contains the tweet URL
    var timeEl = article.querySelector('time');
    if (timeEl) {
      var link = timeEl.closest('a');
      if (link) return link.href;
    }
    // Fallback: construct from handle and status links
    var statusLinks = article.querySelectorAll('a[href*="/status/"]');
    for (var i = 0; i < statusLinks.length; i++) {
      var href = statusLinks[i].href;
      if (href.match(/\/status\/\d+$/)) return href;
    }
    return window.location.href;
  }

  function getTimestamp(article) {
    var timeEl = article.querySelector('time');
    if (!timeEl) return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    var dt = timeEl.getAttribute('datetime');
    if (!dt) return timeEl.textContent || '';
    var d = new Date(dt);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function isVerified(article) {
    var userCell = article.querySelector('[data-testid="User-Name"]');
    if (!userCell) return false;
    return !!userCell.querySelector('svg[aria-label*="Verified"], svg[data-testid="icon-verified"]');
  }

  function getVerifiedType(article) {
    var userCell = article.querySelector('[data-testid="User-Name"]');
    if (!userCell) return null;
    var badge = userCell.querySelector('svg[aria-label*="Verified"], svg[data-testid="icon-verified"]');
    if (!badge) return null;
    // Check fill color to determine type
    var path = badge.querySelector('path');
    if (!path) return 'blue';
    var fill = getComputedStyle(badge).color || '';
    if (fill.includes('gold') || fill.includes('D4AF37') || fill.includes('e8a815')) return 'gold';
    if (fill.includes('gray') || fill.includes('808080') || fill.includes('829aab')) return 'gray';
    return 'blue';
  }

  return {
    extractFromArticle: extractFromArticle
  };
})();
```

- [ ] **Step 2: Verify extraction on live X.com**

Open DevTools on x.com, run:
```js
var tweet = document.querySelector(XCard.Selectors.TWEET_ARTICLE);
console.log(XCard.Extractor.extractFromArticle(tweet));
```
Expected: Object with all fields populated (authorName, authorHandle, authorAvatarUrl, tweetText, tweetUrl, timestamp, verified, verifiedType).

- [ ] **Step 3: Commit**

```bash
git add content/extractor.js
git commit -m "feat: add tweet data extraction from DOM"
```

---

### Task 5: Toast Notifications

**Files:**
- Modify: `content/toast.js`
- Modify: `content/styles.css`

- [ ] **Step 1: Implement toast module**

```js
window.XCard = window.XCard || {};

XCard.Toast = (function () {
  'use strict';

  var TIMEOUT = 3000;
  var activeToast = null;

  function show(message, type) {
    dismiss();
    var toast = document.createElement('div');
    toast.className = 'xcard-toast xcard-toast--' + (type || 'info');
    toast.textContent = message;
    document.body.appendChild(toast);

    // Trigger enter animation
    requestAnimationFrame(function () {
      toast.classList.add('xcard-toast--visible');
    });

    activeToast = toast;
    if (type !== 'loading') {
      setTimeout(function () { dismiss(toast); }, TIMEOUT);
    }
    return toast;
  }

  function dismiss(toast) {
    var el = toast || activeToast;
    if (!el || !el.parentNode) return;
    el.classList.remove('xcard-toast--visible');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
    if (el === activeToast) activeToast = null;
  }

  return {
    info: function (msg) { return show(msg, 'info'); },
    success: function (msg) { return show(msg, 'success'); },
    error: function (msg) { return show(msg, 'error'); },
    loading: function (msg) { return show(msg, 'loading'); },
    dismiss: dismiss
  };
})();
```

- [ ] **Step 2: Add toast styles to content/styles.css**

```css
/* ===== Toast ===== */
.xcard-toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  padding: 10px 20px;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 14px;
  font-weight: 500;
  z-index: 100001;
  opacity: 0;
  transition: opacity 0.3s, transform 0.3s;
  pointer-events: none;
  max-width: 400px;
  text-align: center;
}

.xcard-toast--visible {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

.xcard-toast--info {
  background: #1d9bf0;
  color: #fff;
}

.xcard-toast--success {
  background: #00ba7c;
  color: #fff;
}

.xcard-toast--error {
  background: #f4212e;
  color: #fff;
}

.xcard-toast--loading {
  background: #1d9bf0;
  color: #fff;
}
```

- [ ] **Step 3: Verify toast in console**

On x.com DevTools:
```js
XCard.Toast.success('XCard loaded!');
```
Expected: Green toast appears at bottom center, fades in, auto-dismisses after 3s.

- [ ] **Step 4: Commit**

```bash
git add content/toast.js content/styles.css
git commit -m "feat: add toast notification system"
```

---

### Task 6: Background Service Worker — Auth & Grok API

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Implement full background.js**

```js
// XCard Background Service Worker
// Handles: auth, Grok API calls, avatar proxy

(function () {
  'use strict';

  // Twitter/X.com public bearer token (embedded in their JS bundle)
  var BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';

  var GROK_ENDPOINT = 'https://x.com/i/api/2/grok/add_response.json';

  // --- Auth ---

  function getCsrfToken() {
    return new Promise(function (resolve, reject) {
      chrome.cookies.get({ url: 'https://x.com', name: 'ct0' }, function (cookie) {
        if (cookie && cookie.value) {
          resolve(cookie.value);
        } else {
          reject(new Error('Not logged in to X.com — ct0 cookie not found'));
        }
      });
    });
  }

  function buildHeaders(csrfToken) {
    return {
      'authorization': 'Bearer ' + BEARER_TOKEN,
      'x-csrf-token': csrfToken,
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-active-user': 'yes',
      'content-type': 'application/json'
    };
  }

  // --- Grok API ---

  function buildPrompt(tweetData, language) {
    var hasTitle = tweetData.articleTitle && tweetData.articleTitle.trim();
    var langInstruction = language || 'Chinese';

    var prompt = 'You are summarizing an X (Twitter) post. Respond in ' + langInstruction + '.\n\n';
    prompt += 'Post by ' + tweetData.authorHandle + ':\n---\n';
    prompt += tweetData.tweetText + '\n---\n\n';

    if (hasTitle) {
      prompt += 'The post title is: "' + tweetData.articleTitle + '"\n\n';
      prompt += 'Generate a TL;DR summary in markdown format. Use bullet points for key points, **bold** for emphasis. ';
      prompt += 'Be thorough — aim for 3-8 bullet points depending on content length. ';
      prompt += 'Include a brief introductory sentence before the bullet points.\n\n';
      prompt += 'Format your response as:\nTITLE: ' + tweetData.articleTitle + '\nTLDR:\n<markdown content>';
    } else {
      prompt += 'Generate:\n';
      prompt += '1. A concise, descriptive title for this post (one line, in ' + langInstruction + ')\n';
      prompt += '2. A TL;DR summary in markdown format. Use bullet points for key points, **bold** for emphasis. ';
      prompt += 'Be thorough — aim for 3-8 bullet points depending on content length. ';
      prompt += 'Include a brief introductory sentence before the bullet points.\n\n';
      prompt += 'Format your response EXACTLY as:\nTITLE: <title here>\nTLDR:\n<markdown content>';
    }

    return prompt;
  }

  function parseGrokResponse(text) {
    var titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/);
    var tldrMatch = text.match(/TLDR:\s*\n?([\s\S]+)/);

    return {
      title: titleMatch ? titleMatch[1].trim() : '',
      tldr: tldrMatch ? tldrMatch[1].trim() : text.trim()
    };
  }

  async function callGrok(tweetData, language) {
    var csrfToken = await getCsrfToken();
    var headers = buildHeaders(csrfToken);
    var prompt = buildPrompt(tweetData, language);

    var body = JSON.stringify({
      responses: [
        {
          message: prompt,
          sender: 1
        }
      ],
      systemPromptName: '',
      grokModelOptionId: 'grok-3'
    });

    var response = await fetch(GROK_ENDPOINT, {
      method: 'POST',
      headers: headers,
      body: body,
      credentials: 'include'
    });

    if (!response.ok) {
      var errText = await response.text().catch(function () { return ''; });
      throw new Error('Grok API error: ' + response.status + ' — ' + errText.substring(0, 200));
    }

    // Grok streams newline-delimited JSON. Collect all result parts.
    var responseText = await response.text();
    var fullMessage = '';
    var lines = responseText.split('\n');

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      try {
        var obj = JSON.parse(line);
        if (obj.result && obj.result.message) {
          fullMessage = obj.result.message;
        } else if (obj.result && obj.result.responseText) {
          fullMessage = obj.result.responseText;
        }
      } catch (e) {
        // Not JSON, skip
      }
    }

    if (!fullMessage) {
      // Fallback: try the whole response as plain text
      fullMessage = responseText;
    }

    return parseGrokResponse(fullMessage);
  }

  // --- Avatar Proxy ---

  async function fetchAvatarAsBase64(url) {
    if (!url) return '';
    try {
      var response = await fetch(url);
      var blob = await response.blob();
      return new Promise(function (resolve) {
        var reader = new FileReader();
        reader.onloadend = function () { resolve(reader.result); };
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('[XCard] Avatar fetch failed:', e);
      return '';
    }
  }

  // --- Message Handler ---

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.type === 'GENERATE_TLDR') {
      callGrok(message.tweetData, message.language)
        .then(function (result) { sendResponse({ success: true, data: result }); })
        .catch(function (err) { sendResponse({ success: false, error: err.message }); });
      return true; // keep channel open for async
    }

    if (message.type === 'FETCH_AVATAR') {
      fetchAvatarAsBase64(message.url)
        .then(function (dataUrl) { sendResponse({ success: true, dataUrl: dataUrl }); })
        .catch(function (err) { sendResponse({ success: false, error: err.message }); });
      return true;
    }

    if (message.type === 'COPY_IMAGE') {
      // Copy PNG blob to clipboard from offscreen or content script
      sendResponse({ success: true });
      return true;
    }
  });

  console.log('[XCard] Service worker started');
})();
```

- [ ] **Step 2: Verify auth works**

Reload extension. In service worker console (chrome://extensions → XCard → Inspect):
```js
chrome.cookies.get({ url: 'https://x.com', name: 'ct0' }, c => console.log(c));
```
Expected: Cookie object with value (must be logged in to X.com).

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat: add background service worker with Grok API and avatar proxy"
```

---

### Task 7: Card Renderer

**Files:**
- Modify: `content/card.js`
- Modify: `content/styles.css`

- [ ] **Step 1: Implement card builder**

```js
window.XCard = window.XCard || {};

XCard.Card = (function () {
  'use strict';

  var X_LOGO_SVG = '<svg viewBox="0 0 24 24" width="20" height="20" style="fill:currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>';

  var VERIFIED_SVG = '<svg viewBox="0 0 22 22" width="18" height="18" style="fill:#1d9bf0;vertical-align:-3px;margin-left:2px"><path d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.69-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.636.433 1.221.878 1.69.47.446 1.055.752 1.69.883.635.13 1.294.083 1.902-.143.271.586.702 1.084 1.24 1.438.54.354 1.167.551 1.813.568.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.225 1.261.272 1.893.143.636-.13 1.222-.434 1.69-.88.45-.47.756-1.058.887-1.694.13-.636.077-1.294-.145-1.9.587-.274 1.084-.705 1.438-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.072 2.072 4.4-4.794 1.347 1.246z"/></svg>';

  var GOLD_VERIFIED_SVG = VERIFIED_SVG.replace('#1d9bf0', '#e8a815');
  var GRAY_VERIFIED_SVG = VERIFIED_SVG.replace('#1d9bf0', '#829aab');

  function getVerifiedBadge(verifiedType) {
    if (!verifiedType) return '';
    if (verifiedType === 'gold') return GOLD_VERIFIED_SVG;
    if (verifiedType === 'gray') return GRAY_VERIFIED_SVG;
    return VERIFIED_SVG;
  }

  function renderMarkdown(md, theme) {
    if (typeof marked === 'undefined') return md;
    var html = marked.parse(md, { breaks: true });
    // Wrap for theme-aware styling
    return '<div class="xcard-md" style="color:' + theme.textSecondary + '">' + html + '</div>';
  }

  function buildCardHTML(tweetData, grokResult, avatarDataUrl, theme) {
    var avatar = avatarDataUrl || tweetData.authorAvatarUrl;
    var badge = tweetData.verified ? getVerifiedBadge(tweetData.verifiedType) : '';
    var tldrHTML = renderMarkdown(grokResult.tldr, theme);
    var title = grokResult.title || '';

    var html = ''
      + '<div class="xcard-card" style="'
      + 'background:' + theme.cardBg + ';'
      + 'border:1px solid ' + theme.cardBorder + ';'
      + 'border-radius:16px;padding:20px;width:440px;'
      + 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;'
      + 'box-sizing:border-box;">'

      // --- Header: avatar + name + X logo ---
      + '<div style="display:flex;align-items:center;gap:10px;">'
      +   '<img src="' + avatar + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" crossorigin="anonymous">'
      +   '<div style="flex:1;min-width:0;">'
      +     '<div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;">'
      +       '<span style="color:' + theme.textPrimary + ';font-weight:700;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:260px;">'
      +         escapeHtml(tweetData.authorName)
      +       '</span>'
      +       badge
      +     '</div>'
      +     '<div style="color:' + theme.textTertiary + ';font-size:13px;">'
      +       escapeHtml(tweetData.authorHandle)
      +     '</div>'
      +   '</div>'
      +   '<div style="color:' + theme.textTertiary + ';">' + X_LOGO_SVG + '</div>'
      + '</div>'

      // --- Title ---
      + (title
        ? '<div style="margin-top:14px;color:' + theme.textPrimary + ';font-size:17px;font-weight:700;line-height:1.35;">'
        +   escapeHtml(title)
        + '</div>'
        : '')

      // --- TLDR ---
      + '<div style="margin-top:12px;font-size:13.5px;line-height:1.65;">'
      +   tldrHTML
      + '</div>'

      // --- Footer ---
      + '<div style="margin-top:14px;padding-top:12px;border-top:1px solid ' + theme.divider + ';display:flex;justify-content:space-between;align-items:center;">'
      +   '<span style="color:' + theme.textTertiary + ';font-size:12px;">' + escapeHtml(tweetData.timestamp) + '</span>'
      +   '<span style="color:' + theme.textTertiary + ';font-size:11px;display:flex;align-items:center;gap:4px;">'
      +     X_LOGO_SVG.replace('width="20" height="20"', 'width="14" height="14"')
      +     ' xcard'
      +   '</span>'
      + '</div>'

      + '</div>';

    return html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderToImage(tweetData, grokResult, avatarDataUrl, theme) {
    return new Promise(function (resolve, reject) {
      var container = document.createElement('div');
      container.id = 'xcard-render-container';
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;z-index:-1;';
      container.innerHTML = buildCardHTML(tweetData, grokResult, avatarDataUrl, theme);
      document.body.appendChild(container);

      var cardEl = container.querySelector('.xcard-card');

      // Wait for avatar image to load
      var img = cardEl.querySelector('img');
      var imgLoaded = img
        ? new Promise(function (res) {
            if (img.complete) return res();
            img.onload = res;
            img.onerror = res;
          })
        : Promise.resolve();

      imgLoaded.then(function () {
        return html2canvas(cardEl, {
          backgroundColor: null,
          scale: 2,
          useCORS: true,
          logging: false
        });
      }).then(function (canvas) {
        canvas.toBlob(function (blob) {
          document.body.removeChild(container);
          resolve({ blob: blob, dataUrl: canvas.toDataURL('image/png') });
        }, 'image/png');
      }).catch(function (err) {
        document.body.removeChild(container);
        reject(err);
      });
    });
  }

  return {
    buildCardHTML: buildCardHTML,
    renderToImage: renderToImage
  };
})();
```

- [ ] **Step 2: Add markdown theme styles to content/styles.css**

Append to `content/styles.css`:

```css
/* ===== Card Markdown ===== */
.xcard-md p {
  margin: 0 0 10px 0;
}

.xcard-md p:last-child {
  margin-bottom: 0;
}

.xcard-md ul, .xcard-md ol {
  margin: 0 0 10px 0;
  padding-left: 20px;
}

.xcard-md li {
  margin-bottom: 6px;
}

.xcard-md li:last-child {
  margin-bottom: 0;
}

.xcard-md strong {
  font-weight: 600;
}

.xcard-md em {
  font-style: italic;
}

.xcard-md code {
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.9em;
  background: rgba(127, 127, 127, 0.15);
}

.xcard-md blockquote {
  margin: 0 0 10px 0;
  padding-left: 12px;
  border-left: 3px solid currentColor;
  opacity: 0.8;
}

/* ===== Render Container ===== */
#xcard-render-container {
  pointer-events: none;
}
```

- [ ] **Step 3: Verify card rendering in console**

On x.com, run in DevTools:
```js
var theme = XCard.Theme.detect();
var tweet = document.querySelector(XCard.Selectors.TWEET_ARTICLE);
var data = XCard.Extractor.extractFromArticle(tweet);
var fakeGrok = { title: 'Test Title', tldr: '**Bold point** about something.\n\n- Item 1\n- Item 2\n- Item 3' };
XCard.Card.renderToImage(data, fakeGrok, '', theme).then(function(r) {
  var img = document.createElement('img');
  img.src = r.dataUrl;
  img.style.cssText = 'position:fixed;top:10px;right:10px;z-index:99999;max-width:440px;border:2px solid red;';
  document.body.appendChild(img);
  console.log('Blob size:', r.blob.size);
});
```
Expected: Card image appears in top-right corner with correct theme, rendered markdown.

- [ ] **Step 4: Commit**

```bash
git add content/card.js content/styles.css
git commit -m "feat: add card renderer with markdown support and image capture"
```

---

### Task 8: Preview Overlay

**Files:**
- Modify: `content/overlay.js`
- Modify: `content/styles.css`

- [ ] **Step 1: Implement overlay module**

```js
window.XCard = window.XCard || {};

XCard.Overlay = (function () {
  'use strict';

  var LANGUAGES = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'English' },
    { code: 'ja', label: '日本語' },
    { code: 'ko', label: '한국어' },
    { code: 'es', label: 'Español' },
    { code: 'fr', label: 'Français' },
    { code: 'de', label: 'Deutsch' }
  ];

  var LANGUAGE_NAMES = {
    zh: 'Chinese',
    en: 'English',
    ja: 'Japanese',
    ko: 'Korean',
    es: 'Spanish',
    fr: 'French',
    de: 'German'
  };

  var currentTweetData = null;
  var currentTheme = null;
  var currentAvatarDataUrl = '';

  function getLanguageName(code) {
    return LANGUAGE_NAMES[code] || 'English';
  }

  function show(imageDataUrl, imageBlob, tweetData, theme, avatarDataUrl, selectedLang) {
    dismiss();

    currentTweetData = tweetData;
    currentTheme = theme;
    currentAvatarDataUrl = avatarDataUrl;

    var overlay = document.createElement('div');
    overlay.id = 'xcard-overlay';
    overlay.innerHTML = buildOverlayHTML(imageDataUrl, theme, selectedLang);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(function () {
      overlay.classList.add('xcard-overlay--visible');
    });

    // Bind events
    overlay.querySelector('.xcard-overlay-close').addEventListener('click', dismiss);
    overlay.querySelector('.xcard-overlay-backdrop').addEventListener('click', dismiss);
    overlay.querySelector('.xcard-overlay-download').addEventListener('click', function () {
      downloadImage(imageDataUrl, tweetData.authorHandle);
    });

    var langSelect = overlay.querySelector('.xcard-overlay-lang');
    langSelect.addEventListener('change', function () {
      var lang = langSelect.value;
      chrome.storage.local.set({ xcard_language: lang });
      regenerate(lang);
    });

    var regenBtn = overlay.querySelector('.xcard-overlay-regenerate');
    regenBtn.addEventListener('click', function () {
      var lang = langSelect.value;
      regenerate(lang);
    });

    // Auto-copy
    copyToClipboard(imageBlob);

    // Keyboard close
    document.addEventListener('keydown', onEsc);
  }

  function buildOverlayHTML(imageDataUrl, theme, selectedLang) {
    var langOptions = LANGUAGES.map(function (l) {
      var selected = l.code === selectedLang ? ' selected' : '';
      return '<option value="' + l.code + '"' + selected + '>' + l.label + '</option>';
    }).join('');

    return ''
      + '<div class="xcard-overlay-backdrop"></div>'
      + '<div class="xcard-overlay-modal">'
      +   '<div class="xcard-overlay-header">'
      +     '<span class="xcard-overlay-title">Card Preview</span>'
      +     '<button class="xcard-overlay-close">&times;</button>'
      +   '</div>'
      +   '<div class="xcard-overlay-body">'
      +     '<img class="xcard-overlay-image" src="' + imageDataUrl + '" alt="XCard preview">'
      +   '</div>'
      +   '<div class="xcard-overlay-controls">'
      +     '<div class="xcard-overlay-lang-row">'
      +       '<label>Language:</label>'
      +       '<select class="xcard-overlay-lang">' + langOptions + '</select>'
      +       '<button class="xcard-overlay-regenerate" title="Regenerate">&#x21bb;</button>'
      +     '</div>'
      +     '<div class="xcard-overlay-actions">'
      +       '<button class="xcard-overlay-copy-status xcard-btn-primary">&#x2713; Copied!</button>'
      +       '<button class="xcard-overlay-download xcard-btn-secondary">Download</button>'
      +     '</div>'
      +   '</div>'
      + '</div>';
  }

  function regenerate(langCode) {
    var overlay = document.getElementById('xcard-overlay');
    if (!overlay) return;

    var img = overlay.querySelector('.xcard-overlay-image');
    var copyBtn = overlay.querySelector('.xcard-overlay-copy-status');
    var regenBtn = overlay.querySelector('.xcard-overlay-regenerate');

    img.style.opacity = '0.4';
    regenBtn.disabled = true;
    regenBtn.textContent = '...';
    copyBtn.textContent = 'Generating...';
    copyBtn.disabled = true;

    var langName = getLanguageName(langCode);

    chrome.runtime.sendMessage(
      { type: 'GENERATE_TLDR', tweetData: currentTweetData, language: langName },
      function (response) {
        if (!response || !response.success) {
          XCard.Toast.error(response ? response.error : 'Grok API failed');
          img.style.opacity = '1';
          regenBtn.disabled = false;
          regenBtn.innerHTML = '&#x21bb;';
          copyBtn.textContent = 'Failed';
          copyBtn.disabled = false;
          return;
        }

        XCard.Card.renderToImage(currentTweetData, response.data, currentAvatarDataUrl, currentTheme)
          .then(function (result) {
            img.src = result.dataUrl;
            img.style.opacity = '1';
            regenBtn.disabled = false;
            regenBtn.innerHTML = '&#x21bb;';
            copyToClipboard(result.blob);
            copyBtn.innerHTML = '&#x2713; Copied!';
            copyBtn.disabled = false;
          })
          .catch(function (err) {
            XCard.Toast.error('Render failed: ' + err.message);
            img.style.opacity = '1';
            regenBtn.disabled = false;
            regenBtn.innerHTML = '&#x21bb;';
          });
      }
    );
  }

  function copyToClipboard(blob) {
    if (!blob) return;
    navigator.clipboard.write([
      new ClipboardItem({ 'image/png': blob })
    ]).then(function () {
      var btn = document.querySelector('.xcard-overlay-copy-status');
      if (btn) { btn.innerHTML = '&#x2713; Copied!'; }
    }).catch(function (err) {
      console.warn('[XCard] Clipboard write failed:', err);
      XCard.Toast.error('Clipboard failed — use Download instead');
    });
  }

  function downloadImage(dataUrl, handle) {
    var a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'xcard-' + (handle || 'post').replace('@', '') + '.png';
    a.click();
  }

  function dismiss() {
    var overlay = document.getElementById('xcard-overlay');
    if (!overlay) return;
    overlay.classList.remove('xcard-overlay--visible');
    setTimeout(function () {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 300);
    document.removeEventListener('keydown', onEsc);
  }

  function onEsc(e) {
    if (e.key === 'Escape') dismiss();
  }

  return {
    show: show,
    dismiss: dismiss,
    LANGUAGES: LANGUAGES,
    getLanguageName: getLanguageName
  };
})();
```

- [ ] **Step 2: Add overlay styles to content/styles.css**

Append to `content/styles.css`:

```css
/* ===== Overlay ===== */
#xcard-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.3s;
}

#xcard-overlay.xcard-overlay--visible {
  opacity: 1;
}

.xcard-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
}

.xcard-overlay-modal {
  position: relative;
  background: #1e2732;
  border-radius: 16px;
  padding: 20px;
  max-width: 500px;
  width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.xcard-overlay-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.xcard-overlay-title {
  color: #e7e9ea;
  font-weight: 600;
  font-size: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.xcard-overlay-close {
  background: none;
  border: none;
  color: #8b98a5;
  font-size: 24px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}

.xcard-overlay-close:hover {
  color: #e7e9ea;
}

.xcard-overlay-body {
  overflow-y: auto;
  margin-bottom: 16px;
}

.xcard-overlay-image {
  width: 100%;
  border-radius: 12px;
  display: block;
  transition: opacity 0.3s;
}

.xcard-overlay-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.xcard-overlay-lang-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.xcard-overlay-lang-row label {
  color: #8b98a5;
  font-size: 13px;
}

.xcard-overlay-lang {
  background: #2d3741;
  color: #e7e9ea;
  border: 1px solid #38444d;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 13px;
  cursor: pointer;
}

.xcard-overlay-regenerate {
  background: #2d3741;
  color: #e7e9ea;
  border: 1px solid #38444d;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 16px;
  cursor: pointer;
  line-height: 1;
}

.xcard-overlay-regenerate:hover {
  background: #3a4750;
}

.xcard-overlay-regenerate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.xcard-overlay-actions {
  display: flex;
  gap: 8px;
}

.xcard-btn-primary {
  flex: 1;
  background: #1d9bf0;
  color: #fff;
  border: none;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.xcard-btn-primary:hover {
  background: #1a8cd8;
}

.xcard-btn-secondary {
  flex: 1;
  background: transparent;
  color: #1d9bf0;
  border: 1px solid #1d9bf0;
  border-radius: 20px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.xcard-btn-secondary:hover {
  background: rgba(29, 155, 240, 0.1);
}
```

- [ ] **Step 3: Commit**

```bash
git add content/overlay.js content/styles.css
git commit -m "feat: add preview overlay with language selector and clipboard support"
```

---

### Task 9: Content Script Entry Point — MutationObserver & Button Injection

**Files:**
- Modify: `content/index.js`
- Modify: `content/styles.css`

- [ ] **Step 1: Implement the main entry point**

```js
window.XCard = window.XCard || {};

(function () {
  'use strict';

  var S = XCard.Selectors;
  var DEBOUNCE_MS = 200;
  var pendingTimer = null;

  // --- XCard Button SVG (small card icon) ---
  var BUTTON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="2" y="4" width="20" height="16" rx="3" ry="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="10" r="2.2"/><line x1="13" y1="9" x2="20" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="13" x2="18" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  // --- Main orchestration ---

  function generateCard(article) {
    var tweetData = XCard.Extractor.extractFromArticle(article);
    if (!tweetData.tweetText) {
      XCard.Toast.error('Could not extract tweet text');
      return;
    }

    var theme = XCard.Theme.detect();
    var loadingToast = XCard.Toast.loading('Generating card...');

    // Get saved language
    chrome.storage.local.get({ xcard_language: 'zh' }, function (store) {
      var langCode = store.xcard_language;
      var langName = XCard.Overlay.getLanguageName(langCode);

      // Fetch avatar (CORS bypass via background)
      var avatarPromise = new Promise(function (resolve) {
        if (!tweetData.authorAvatarUrl) return resolve('');
        chrome.runtime.sendMessage(
          { type: 'FETCH_AVATAR', url: tweetData.authorAvatarUrl },
          function (resp) {
            resolve(resp && resp.success ? resp.dataUrl : '');
          }
        );
      });

      // Call Grok
      var grokPromise = new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage(
          { type: 'GENERATE_TLDR', tweetData: tweetData, language: langName },
          function (resp) {
            if (resp && resp.success) resolve(resp.data);
            else reject(new Error(resp ? resp.error : 'Grok request failed'));
          }
        );
      });

      Promise.all([avatarPromise, grokPromise])
        .then(function (results) {
          var avatarDataUrl = results[0];
          var grokResult = results[1];

          return XCard.Card.renderToImage(tweetData, grokResult, avatarDataUrl, theme)
            .then(function (imageResult) {
              XCard.Toast.dismiss(loadingToast);
              XCard.Overlay.show(
                imageResult.dataUrl,
                imageResult.blob,
                tweetData,
                theme,
                avatarDataUrl,
                langCode
              );
            });
        })
        .catch(function (err) {
          XCard.Toast.dismiss(loadingToast);
          XCard.Toast.error(err.message || 'Failed to generate card');
          console.error('[XCard]', err);
        });
    });
  }

  // --- Button injection into tweet action bar ---

  function injectButton(article) {
    if (article.querySelector(S.XCARD_BUTTON)) return;

    var actionBar = article.querySelector(S.ACTION_BAR);
    if (!actionBar) return;

    var btn = document.createElement('button');
    btn.setAttribute('data-xcard-button', 'true');
    btn.className = 'xcard-action-btn';
    btn.title = 'Generate XCard';
    btn.innerHTML = BUTTON_SVG;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      generateCard(article);
    });

    // Insert before the last item (share button area) or append
    var shareBtn = actionBar.querySelector(S.SHARE_BUTTON);
    if (shareBtn) {
      var shareGroup = shareBtn.closest('[role="group"] > div') || shareBtn.parentElement;
      if (shareGroup && shareGroup.parentElement) {
        shareGroup.parentElement.insertBefore(btn, shareGroup.nextSibling);
      } else {
        actionBar.appendChild(btn);
      }
    } else {
      actionBar.appendChild(btn);
    }
  }

  // --- Share menu injection ---

  function injectShareMenuItem(menuEl) {
    if (menuEl.querySelector(S.XCARD_MENU_ITEM)) return;

    // Find the closest tweet article
    // The share menu is a portal, so we find the tweet from the last clicked share button
    var article = findActiveTweetArticle();
    if (!article) return;

    var existingItems = menuEl.querySelectorAll(S.SHARE_MENU_ITEM);
    if (existingItems.length === 0) return;

    // Clone styling from an existing menu item
    var refItem = existingItems[0];
    var menuItem = refItem.cloneNode(true);
    menuItem.setAttribute('data-xcard-menu-item', 'true');

    // Replace content
    var textSpan = menuItem.querySelector('span');
    if (textSpan) textSpan.textContent = 'Generate XCard';

    // Replace icon
    var iconDiv = menuItem.querySelector('svg');
    if (iconDiv && iconDiv.parentElement) {
      iconDiv.parentElement.innerHTML = BUTTON_SVG;
    }

    menuItem.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      // Close the menu
      document.body.click();
      setTimeout(function () { generateCard(article); }, 100);
    });

    // Insert at top of menu
    var parent = existingItems[0].parentElement;
    parent.insertBefore(menuItem, existingItems[0]);
  }

  // Track which tweet's share button was last clicked
  var lastShareArticle = null;

  function findActiveTweetArticle() {
    return lastShareArticle;
  }

  function trackShareClicks(article) {
    var shareBtn = article.querySelector(S.SHARE_BUTTON);
    if (!shareBtn || shareBtn.hasAttribute('data-xcard-tracked')) return;
    shareBtn.setAttribute('data-xcard-tracked', 'true');
    shareBtn.addEventListener('click', function () {
      lastShareArticle = article;
    });
  }

  // --- MutationObserver ---

  function processNewTweets() {
    var tweets = document.querySelectorAll(S.TWEET_ARTICLE);
    tweets.forEach(function (article) {
      injectButton(article);
      trackShareClicks(article);
    });
  }

  function processShareMenus() {
    var menus = document.querySelectorAll(S.SHARE_MENU);
    menus.forEach(function (menu) {
      injectShareMenuItem(menu);
    });
  }

  function onMutation() {
    if (pendingTimer) return;
    pendingTimer = setTimeout(function () {
      pendingTimer = null;
      processNewTweets();
      processShareMenus();
    }, DEBOUNCE_MS);
  }

  // --- Init ---

  function init() {
    processNewTweets();

    var observer = new MutationObserver(onMutation);
    observer.observe(document.body, { childList: true, subtree: true });

    console.log('[XCard] Initialized — watching for tweets');
  }

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

- [ ] **Step 2: Add action button styles to content/styles.css**

Append to `content/styles.css`:

```css
/* ===== Action Bar Button ===== */
.xcard-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: #71767b;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
  padding: 0;
  margin: 0 2px;
}

.xcard-action-btn:hover {
  background: rgba(29, 155, 240, 0.1);
  color: #1d9bf0;
}

.xcard-action-btn:active {
  background: rgba(29, 155, 240, 0.2);
}
```

- [ ] **Step 3: Reload extension and verify on x.com**

1. Go to `chrome://extensions` → reload XCard
2. Navigate to `https://x.com`
3. Expected: Each tweet's action bar has a small card icon button
4. Click the button on any tweet
5. Expected: Loading toast → card generates → overlay appears with preview
6. Click share (arrow) on any tweet → expect "Generate XCard" menu item in dropdown

- [ ] **Step 4: Commit**

```bash
git add content/index.js content/styles.css
git commit -m "feat: add MutationObserver, button injection, and main orchestration"
```

---

### Task 10: Popup Settings

**Files:**
- Create: `popup/index.html`
- Create: `popup/index.js`

- [ ] **Step 1: Create popup HTML**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 260px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #15202b;
      color: #e7e9ea;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 16px;
      font-weight: 700;
    }
    .header svg { fill: #1d9bf0; }
    label {
      font-size: 13px;
      color: #8b98a5;
      display: block;
      margin-bottom: 6px;
    }
    select {
      width: 100%;
      background: #2d3741;
      color: #e7e9ea;
      border: 1px solid #38444d;
      border-radius: 8px;
      padding: 8px 10px;
      font-size: 14px;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
    }
    .saved {
      color: #00ba7c;
      font-size: 12px;
      margin-top: 8px;
      opacity: 0;
      transition: opacity 0.3s;
    }
    .saved.show { opacity: 1; }
    .footer {
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid #38444d;
      font-size: 11px;
      color: #71767b;
      text-align: center;
    }
    .footer a { color: #1d9bf0; text-decoration: none; }
  </style>
</head>
<body>
  <div class="header">
    <svg viewBox="0 0 24 24" width="20" height="20"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
    <h1>XCard</h1>
  </div>

  <label for="lang">Default TL;DR Language</label>
  <select id="lang">
    <option value="zh">中文</option>
    <option value="en">English</option>
    <option value="ja">日本語</option>
    <option value="ko">한국어</option>
    <option value="es">Español</option>
    <option value="fr">Français</option>
    <option value="de">Deutsch</option>
  </select>
  <div class="saved" id="saved">Saved!</div>

  <div class="footer">
    <a href="https://github.com" target="_blank">GitHub</a> &middot; v1.0.0
  </div>

  <script src="index.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup JS**

```js
(function () {
  'use strict';

  var langSelect = document.getElementById('lang');
  var savedMsg = document.getElementById('saved');

  // Load saved preference
  chrome.storage.local.get({ xcard_language: 'zh' }, function (store) {
    langSelect.value = store.xcard_language;
  });

  // Save on change
  langSelect.addEventListener('change', function () {
    chrome.storage.local.set({ xcard_language: langSelect.value }, function () {
      savedMsg.classList.add('show');
      setTimeout(function () { savedMsg.classList.remove('show'); }, 1500);
    });
  });
})();
```

- [ ] **Step 3: Verify popup**

Click the XCard extension icon in Chrome toolbar. Expected: Popup with language selector, default "中文". Change to "English", see "Saved!" flash.

- [ ] **Step 4: Commit**

```bash
git add popup/
git commit -m "feat: add popup settings with language preference"
```

---

### Task 11: Polish & Error Handling

**Files:**
- Modify: `background.js` (add login check)
- Modify: `content/card.js` (bold color from theme)
- Modify: `content/index.js` (error handling)

- [ ] **Step 1: Add bold text color to markdown rendering**

In `content/card.js`, update the `renderMarkdown` function to inject bold styling:

```js
  function renderMarkdown(md, theme) {
    if (typeof marked === 'undefined') return md;
    var html = marked.parse(md, { breaks: true });
    // Apply bold color for contrast
    html = html.replace(/<strong>/g, '<strong style="color:' + theme.boldText + ';font-weight:600;">');
    html = html.replace(/<em>/g, '<em style="color:' + theme.boldText + ';">');
    return '<div class="xcard-md" style="color:' + theme.textSecondary + '">' + html + '</div>';
  }
```

- [ ] **Step 2: Add login check in background.js**

In the `GENERATE_TLDR` handler in `background.js`, the `getCsrfToken()` rejection already provides the right error message. Verify it propagates to the UI.

- [ ] **Step 3: Handle edge case — empty tweet text**

In `content/index.js`, the `generateCard` function already checks `if (!tweetData.tweetText)`. No change needed — verify this path works.

- [ ] **Step 4: Commit**

```bash
git add content/card.js
git commit -m "fix: apply theme-aware bold/italic colors in markdown rendering"
```

---

### Task 12: End-to-End Testing

- [ ] **Step 1: Reload extension**

Go to `chrome://extensions` → reload XCard.

- [ ] **Step 2: Test on short tweet**

1. Navigate to any short tweet on x.com
2. Click the XCard button in the action bar
3. Expected: Loading toast → card with title + TLDR → overlay with "Copied!" → paste into a text field to verify clipboard

- [ ] **Step 3: Test share menu injection**

1. Click the share (arrow) button on a tweet
2. Expected: "Generate XCard" appears as the first item in the menu
3. Click it
4. Expected: Menu closes → card generates → overlay appears

- [ ] **Step 4: Test theme switching**

1. Go to X.com Settings → Display → choose each theme (Light, Dim, Dark)
2. Generate a card in each theme
3. Expected: Card background and text colors match the current X.com theme

- [ ] **Step 5: Test language switching**

1. In the overlay, change language to "English"
2. Click the regenerate button (↻)
3. Expected: Card re-generates with English TLDR
4. Change to "日本語" and regenerate
5. Expected: Card re-generates with Japanese TLDR

- [ ] **Step 6: Test clipboard paste**

1. Generate a card
2. Open WeChat (or any app that accepts image paste)
3. Cmd+V / Ctrl+V
4. Expected: Card image appears

- [ ] **Step 7: Test download**

1. In the overlay, click "Download"
2. Expected: PNG file downloads with name like `xcard-garrytan.png`

- [ ] **Step 8: Test verified badges**

1. Find a tweet by a verified user (blue badge)
2. Generate card
3. Expected: Blue verification badge appears next to author name

- [ ] **Step 9: Test error — not logged in**

1. Open an incognito window (not logged in to x.com)
2. Load extension in incognito (enable in extension settings)
3. Navigate to x.com (will show logged-out view — may not have tweets)
4. If possible, trigger XCard
5. Expected: Error toast "Not logged in to X.com — ct0 cookie not found"

- [ ] **Step 10: Test SPA navigation**

1. Navigate between Home, Profile, and individual tweet pages
2. Expected: XCard buttons continue to appear on new tweets loaded via SPA navigation

- [ ] **Step 11: Commit any test-driven fixes**

```bash
git add -A
git commit -m "fix: adjustments from E2E testing"
```

---

### Task 13: GitHub Repo & Chrome Web Store Prep

- [ ] **Step 1: Create .gitignore**

```
.DS_Store
*.zip
```

- [ ] **Step 2: Add README.md**

Create a concise README with: description, install instructions (developer mode), usage, and screenshots placeholder.

- [ ] **Step 3: Create GitHub repo**

```bash
cd xcard
gh repo create xcard --public --source . --push
```

- [ ] **Step 4: Package for Chrome Web Store**

```bash
cd xcard
zip -r ../xcard-v1.0.0.zip . -x ".*" -x "scripts/*" -x "docs/*" -x "*.zip"
```

- [ ] **Step 5: Upload to Chrome Web Store**

1. Go to https://chrome.google.com/webstore/devconsole
2. Click "New Item" → upload `xcard-v1.0.0.zip`
3. Fill in listing details:
   - Name: XCard
   - Description: Generate shareable card images from X.com posts with AI-powered TL;DR summaries. Perfect for sharing tweet summaries on WeChat and other messaging apps.
   - Category: Productivity
   - Language: English
4. Add screenshots (generate from E2E testing)
5. Submit for review

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "chore: add .gitignore and README"
git push
```
