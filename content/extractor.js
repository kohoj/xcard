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
    var textEl = article.querySelector(S.TWEET_TEXT);
    if (!textEl) return '';
    return textEl.innerText.trim();
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
