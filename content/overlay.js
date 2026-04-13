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
