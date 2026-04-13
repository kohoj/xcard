# XCard

Generate shareable card images from X.com posts with AI-powered TL;DR summaries.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-blue)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)

## What it does

XCard adds a button to every tweet on X.com. Click it to generate a beautiful card image with:

- Author avatar and name (with verification badge)
- AI-generated title
- Structured TL;DR summary (markdown rendered)
- Auto-copied to clipboard — paste directly into WeChat, Slack, etc.

Cards match X.com's current theme (Light / Dim / Dark).

## Setup

### 1. Install the extension

- Clone this repo
- Open `chrome://extensions/` → Enable "Developer mode"
- Click "Load unpacked" → Select the `xcard/` directory

### 2. Configure your AI provider

Click the XCard icon in the toolbar and set up any OpenAI-compatible API:

| Provider | Base URL | Example Model |
|----------|----------|---------------|
| OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini` |
| OpenRouter | `https://openrouter.ai/api/v1` | `openai/gpt-4o-mini` |
| Anthropic | `https://api.anthropic.com/v1` | `claude-sonnet-4-6` |
| NVIDIA | `https://integrate.api.nvidia.com/v1` | `z-ai/glm4.7` |

Any OpenAI-compatible endpoint works — just enter the Base URL, API Key, and Model.

### 3. Use it

- Navigate to X.com
- Click the card icon on any tweet's action bar
- Card is generated and auto-copied to clipboard
- Preview overlay lets you change language, regenerate, or download

## Features

- **Two trigger methods**: Action bar button + Share menu injection
- **Theme-aware**: Cards match X.com's Light / Dim / Dark theme
- **Markdown TL;DR**: Rich formatting with bullet points, bold, italic
- **Multi-language**: Chinese, English, Japanese, Korean, Spanish, French, German
- **Auto-clipboard**: Image copied automatically, paste anywhere
- **Download**: Save as PNG file

## Tech Stack

- Chrome Extension Manifest V3
- Vanilla JavaScript (no build tools)
- [html2canvas](https://html2canvas.hertzen.com/) for image generation
- [marked.js](https://marked.js.org/) for markdown rendering

## License

MIT
