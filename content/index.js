// XCard Content Script — Entry Point
window.XCard = window.XCard || {};

(function () {
  'use strict';

  var S = XCard.Selectors;
  var DEBOUNCE_MS = 200;
  var pendingTimer = null;

  // --- XCard Button SVG (small card icon) ---
  var BUTTON_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="2" y="4" width="20" height="16" rx="3" ry="3" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="8" cy="10" r="2.2"/><line x1="13" y1="9" x2="20" y2="9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><line x1="13" y1="13" x2="18" y2="13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';

  // --- Grok Bridge Communication ---

  var grokCallbacks = {};
  var grokRequestCounter = 0;

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'XCARD_GROK_RESPONSE') return;
    var cb = grokCallbacks[event.data.requestId];
    if (!cb) return;
    delete grokCallbacks[event.data.requestId];
    if (event.data.error) {
      cb.reject(new Error(event.data.error));
    } else {
      cb.resolve(event.data.data);
    }
  });

  function callGrokViaBridge(tweetData, language) {
    return new Promise(function (resolve, reject) {
      var requestId = 'xcard_' + (++grokRequestCounter) + '_' + Date.now();
      var prompt = buildPrompt(tweetData, language);

      grokCallbacks[requestId] = {
        resolve: function (rawText) {
          resolve(parseGrokResponse(rawText));
        },
        reject: reject
      };

      // Set a timeout in case bridge never responds
      setTimeout(function () {
        if (grokCallbacks[requestId]) {
          delete grokCallbacks[requestId];
          reject(new Error('Grok request timed out'));
        }
      }, 60000);

      window.postMessage({
        type: 'XCARD_GROK_REQUEST',
        requestId: requestId,
        prompt: prompt
      }, '*');
    });
  }

  function buildPrompt(tweetData, language) {
    var hasTitle = tweetData.articleTitle && tweetData.articleTitle.trim();
    var langInstruction = language || 'Chinese';
    var prompt = tweetData.tweetUrl + '\n\n';
    prompt += 'Summarize this X post. Respond in ' + langInstruction + '.\n\n';

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

  // --- Main orchestration ---

  var generationInProgress = false;

  function generateCard(article) {
    if (generationInProgress) {
      XCard.Toast.info('Card generation in progress...');
      return;
    }

    var tweetData = XCard.Extractor.extractFromArticle(article);
    if (!tweetData.tweetText) {
      XCard.Toast.error('Could not extract tweet text');
      return;
    }

    var theme = XCard.Theme.detect();
    generationInProgress = true;
    var loadingToast = XCard.Toast.loading('Generating card...');

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

      // Call Grok via MAIN world bridge (for cookie-authenticated requests)
      var grokPromise = callGrokViaBridge(tweetData, langName);

      Promise.all([avatarPromise, grokPromise])
        .then(function (results) {
          var avatarDataUrl = results[0];
          var grokResult = results[1];

          return XCard.Card.renderToImage(tweetData, grokResult, avatarDataUrl, theme)
            .then(function (imageResult) {
              XCard.Toast.dismiss(loadingToast);
              generationInProgress = false;
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
          generationInProgress = false;
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

    // Insert after the share button or append to action bar
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

    var article = findActiveTweetArticle();
    if (!article) return;

    var existingItems = menuEl.querySelectorAll(S.SHARE_MENU_ITEM);
    if (existingItems.length === 0) return;

    var refItem = existingItems[0];
    var menuItem = refItem.cloneNode(true);
    menuItem.setAttribute('data-xcard-menu-item', 'true');

    var textSpan = menuItem.querySelector('span');
    if (textSpan) textSpan.textContent = 'Generate XCard';

    var iconDiv = menuItem.querySelector('svg');
    if (iconDiv && iconDiv.parentElement) {
      iconDiv.parentElement.innerHTML = BUTTON_SVG;
    }

    menuItem.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      document.body.click();
      setTimeout(function () { generateCard(article); }, 100);
    });

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
    if (pendingTimer) clearTimeout(pendingTimer);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
