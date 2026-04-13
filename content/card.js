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

  // Allowed HTML tags for sanitization
  var ALLOWED_TAGS = ['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'blockquote', 'br', 'h1', 'h2', 'h3', 'h4', 'a', 'pre'];

  function sanitizeHtml(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    // Remove all script/style/iframe/img-with-onerror elements
    var dangerous = div.querySelectorAll('script, style, iframe, object, embed, form, input, textarea');
    for (var i = 0; i < dangerous.length; i++) {
      dangerous[i].parentNode.removeChild(dangerous[i]);
    }
    // Remove event handler attributes from all elements
    var allEls = div.querySelectorAll('*');
    for (var j = 0; j < allEls.length; j++) {
      var el = allEls[j];
      var tag = el.tagName.toLowerCase();
      if (ALLOWED_TAGS.indexOf(tag) === -1) {
        // Replace disallowed tag with its text content
        var text = document.createTextNode(el.textContent);
        el.parentNode.replaceChild(text, el);
        continue;
      }
      // Strip all event handlers and dangerous attributes
      var attrs = el.attributes;
      for (var k = attrs.length - 1; k >= 0; k--) {
        var name = attrs[k].name.toLowerCase();
        if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') {
          el.removeAttribute(attrs[k].name);
        }
        if (name === 'href' && attrs[k].value.trim().toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attrs[k].name);
        }
      }
    }
    return div.innerHTML;
  }

  function renderMarkdown(md, theme) {
    if (typeof marked === 'undefined') return escapeHtml(md);
    var html = marked.parse(md, { breaks: true });
    html = sanitizeHtml(html);
    // Apply bold/italic color for contrast
    html = html.replace(/<strong>/g, '<strong style="color:' + theme.boldText + ';font-weight:600;">');
    html = html.replace(/<em>/g, '<em style="color:' + theme.boldText + ';">');
    return '<div class="xcard-md" style="color:' + theme.textSecondary + '">' + html + '</div>';
  }

  function buildCardHTML(tweetData, grokResult, avatarDataUrl, theme, tweetImageDataUrl) {
    var avatar = avatarDataUrl || tweetData.authorAvatarUrl;
    var badge = tweetData.verified ? getVerifiedBadge(tweetData.verifiedType) : '';
    var tldrHTML = renderMarkdown(grokResult.tldr, theme);
    var title = grokResult.title || '';
    var tweetImage = tweetImageDataUrl || '';

    var html = ''
      + '<div class="xcard-card" style="'
      + 'background:' + theme.cardBg + ';'
      + 'border:1px solid ' + theme.cardBorder + ';'
      + 'border-radius:0;padding:20px;width:500px;'
      + 'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;'
      + 'box-sizing:border-box;">'

      // Header: avatar + name + X logo
      + '<div style="display:flex;align-items:center;gap:10px;">'
      +   '<img src="' + escapeHtml(avatar) + '" style="width:44px;height:44px;border-radius:50%;object-fit:cover;" crossorigin="anonymous">'
      +   '<div style="flex:1;min-width:0;">'
      +     '<div style="display:flex;align-items:center;gap:2px;flex-wrap:wrap;">'
      +       '<span style="color:' + theme.textPrimary + ';font-weight:700;font-size:15px;">'
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

      // Title
      + (title
        ? '<div style="margin-top:14px;color:' + theme.textPrimary + ';font-size:17px;font-weight:700;line-height:1.35;">'
        +   escapeHtml(title)
        + '</div>'
        : '')

      // TLDR
      + '<div style="margin-top:12px;font-size:13.5px;line-height:1.65;">'
      +   tldrHTML
      + '</div>'

      // Tweet image (first image if present)
      + (tweetImage
        ? '<div style="margin-top:12px;border-radius:12px;overflow:hidden;">'
        +   '<img src="' + escapeHtml(tweetImage) + '" style="width:100%;display:block;border-radius:12px;" crossorigin="anonymous">'
        + '</div>'
        : '')

      // Footer
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

  function renderToImage(tweetData, grokResult, avatarDataUrl, theme, tweetImageDataUrl) {
    return new Promise(function (resolve, reject) {
      var container = document.createElement('div');
      container.id = 'xcard-render-container';
      container.style.cssText = 'position:fixed;top:-9999px;left:-9999px;z-index:-1;';
      container.innerHTML = buildCardHTML(tweetData, grokResult, avatarDataUrl, theme, tweetImageDataUrl);
      document.body.appendChild(container);

      var cardEl = container.querySelector('.xcard-card');

      // Wait for ALL images to load
      var allImgs = cardEl.querySelectorAll('img');
      var imgPromises = [];
      allImgs.forEach(function (img) {
        if (!img.complete) {
          imgPromises.push(new Promise(function (res) {
            img.onload = res;
            img.onerror = res;
          }));
        }
      });
      var imgLoaded = imgPromises.length > 0 ? Promise.all(imgPromises) : Promise.resolve();

      // Detect theme from the rendered card's background
      var cardBgColor = cardEl.style.background || '#000';

      imgLoaded.then(function () {
        return html2canvas(cardEl, {
          backgroundColor: cardBgColor,
          scale: 3,
          useCORS: true,
          logging: false
        });
      }).then(function (canvas) {
        canvas.toBlob(function (blob) {
          document.body.removeChild(container);
          resolve({ blob: blob, dataUrl: canvas.toDataURL('image/png') });
        }, 'image/png');
      }).catch(function (err) {
        if (container.parentNode) document.body.removeChild(container);
        reject(err);
      });
    });
  }

  return {
    buildCardHTML: buildCardHTML,
    renderToImage: renderToImage
  };
})();
