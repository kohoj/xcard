// XCard Content Script — Entry Point
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
