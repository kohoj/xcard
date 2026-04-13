window.XCard = window.XCard || {};

XCard.Extractor = (function () {
  'use strict';

  var S = XCard.Selectors;

  function extractFromArticle(article) {
    var longForm = isLongForm(article);
    return {
      authorName: getAuthorName(article),
      authorHandle: getAuthorHandle(article),
      authorAvatarUrl: getAvatarUrl(article),
      tweetText: getTweetText(article),
      tweetUrl: getTweetUrl(article),
      isLongForm: longForm,
      articleTitle: longForm ? getArticleTitle(article) : null,
      timestamp: getTimestamp(article),
      verified: isVerified(article),
      verifiedType: getVerifiedType(article)
    };
  }

  function isLongForm(article) {
    // X.com articles/notes have a card with a title, or a "Show more" indicator
    return !!article.querySelector('[data-testid="card.wrapper"]') ||
           !!article.querySelector('article [role="link"][aria-label]');
  }

  function getArticleTitle(article) {
    // Long-form posts have a card with headline text
    var card = article.querySelector('[data-testid="card.wrapper"]');
    if (card) {
      var headline = card.querySelector('[data-testid="card.layoutLarge.detail"] span, [data-testid="card.layoutSmall.detail"] span');
      if (headline) return headline.textContent.trim();
    }
    return null;
  }

  function getAuthorName(article) {
    var userCell = article.querySelector(S.USER_NAME);
    if (!userCell) return 'Unknown';
    var nameSpan = userCell.querySelector('a[role="link"] span');
    return nameSpan ? nameSpan.textContent.trim() : 'Unknown';
  }

  function getAuthorHandle(article) {
    var userCell = article.querySelector(S.USER_NAME);
    if (!userCell) return '@unknown';
    var links = userCell.querySelectorAll('a[role="link"]');
    for (var i = 0; i < links.length; i++) {
      var text = links[i].textContent.trim();
      if (text.startsWith('@')) return text;
    }
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
    return img.src.replace(/_normal\./, '_400x400.');
  }

  function getTweetText(article) {
    // Standard tweet text
    var textEl = article.querySelector(S.TWEET_TEXT);
    if (textEl) {
      var text = textEl.innerText.trim();
      if (text) return text;
    }

    // Article/Note card — text may be in the card wrapper
    var card = article.querySelector('[data-testid="card.wrapper"]');
    if (card) {
      var cardText = card.innerText.trim();
      if (cardText) return cardText;
    }

    // Fallback: grab all visible text from the tweet, excluding UI elements
    var clone = article.cloneNode(true);
    // Remove action bar, user name row, timestamps
    var remove = clone.querySelectorAll('[role="group"], nav, [data-testid="User-Name"]');
    remove.forEach(function (el) { el.remove(); });
    var fallback = clone.innerText.trim();
    if (fallback.length > 10) return fallback;

    return '';
  }

  function getTweetUrl(article) {
    var timeEl = article.querySelector('time');
    if (timeEl) {
      var link = timeEl.closest('a');
      if (link) return link.href;
    }
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
    var userCell = article.querySelector(S.USER_NAME);
    if (!userCell) return false;
    return !!userCell.querySelector('svg[aria-label*="Verified"], svg[data-testid="icon-verified"]');
  }

  function getVerifiedType(article) {
    var userCell = article.querySelector(S.USER_NAME);
    if (!userCell) return null;
    var badge = userCell.querySelector('svg[aria-label*="Verified"], svg[data-testid="icon-verified"]');
    if (!badge) return null;
    // Check aria-label for badge type hints
    var label = (badge.getAttribute('aria-label') || '').toLowerCase();
    if (label.includes('business') || label.includes('official')) return 'gold';
    if (label.includes('government') || label.includes('affiliated')) return 'gray';
    // Fallback: parse computed color as RGB
    var color = getComputedStyle(badge).color || '';
    var rgb = color.match(/\d+/g);
    if (rgb && rgb.length >= 3) {
      var r = parseInt(rgb[0], 10), g = parseInt(rgb[1], 10), b = parseInt(rgb[2], 10);
      if (r > 200 && g > 150 && b < 50) return 'gold';
      if (r > 100 && g > 100 && b > 100 && r < 180) return 'gray';
    }
    return 'blue';
  }

  return {
    extractFromArticle: extractFromArticle
  };
})();
