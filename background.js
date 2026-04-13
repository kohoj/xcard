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
  });

  console.log('[XCard] Service worker started');
})();
