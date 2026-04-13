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

    requestAnimationFrame(function () {
      overlay.classList.add('xcard-overlay--visible');
    });

    overlay.querySelector('.xcard-overlay-close').addEventListener('click', dismiss);
    overlay.querySelector('.xcard-overlay-backdrop').addEventListener('click', dismiss);
    overlay.querySelector('.xcard-overlay-download').addEventListener('click', function () {
      // Always download the current image (may have been regenerated)
      var currentSrc = overlay.querySelector('.xcard-overlay-image').src;
      downloadImage(currentSrc, tweetData.authorHandle);
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

    // Lock body scroll while overlay is open
    document.body.style.overflow = 'hidden';

    copyToClipboard(imageBlob);
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

    // Use the Grok bridge via index.js's callGrokViaBridge
    // We need to build the prompt and call via postMessage
    var prompt = currentTweetData.tweetUrl + '\n\n';
    prompt += 'Summarize this X post. Respond in ' + langName + '.\n\n';
    prompt += 'Generate:\n';
    prompt += '1. A concise, descriptive title for this post (one line, in ' + langName + ')\n';
    prompt += '2. A TL;DR summary in markdown format. Use bullet points for key points, **bold** for emphasis. ';
    prompt += 'Be thorough — aim for 3-8 bullet points depending on content length. ';
    prompt += 'Include a brief introductory sentence before the bullet points.\n\n';
    prompt += 'Format your response EXACTLY as:\nTITLE: <title here>\nTLDR:\n<markdown content>';

    var requestId = 'xcard_regen_' + Date.now();

    var onResponse = function (event) {
      if (event.source !== window) return;
      if (!event.data || event.data.type !== 'XCARD_GROK_RESPONSE') return;
      if (event.data.requestId !== requestId) return;
      window.removeEventListener('message', onResponse);

      if (event.data.error) {
        XCard.Toast.error(event.data.error);
        img.style.opacity = '1';
        regenBtn.disabled = false;
        regenBtn.innerHTML = '&#x21bb;';
        copyBtn.textContent = 'Failed';
        copyBtn.disabled = false;
        return;
      }

      var text = event.data.data;
      var titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/);
      var tldrMatch = text.match(/TLDR:\s*\n?([\s\S]+)/);
      var grokResult = {
        title: titleMatch ? titleMatch[1].trim() : '',
        tldr: tldrMatch ? tldrMatch[1].trim() : text.trim()
      };

      XCard.Card.renderToImage(currentTweetData, grokResult, currentAvatarDataUrl, currentTheme)
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
    };

    window.addEventListener('message', onResponse);
    window.postMessage({
      type: 'XCARD_GROK_REQUEST',
      requestId: requestId,
      prompt: prompt
    }, '*');
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
    document.body.style.overflow = '';
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
