// XCard Grok Bridge — Runs in MAIN world (page context)
// This script has access to the page's cookies and can make
// authenticated requests to grok.x.com as the logged-in user.

(function () {
  'use strict';

  var BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  var GROK_ENDPOINT = 'https://grok.x.com/2/grok/add_response.json';

  function getCsrfToken() {
    var match = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/);
    return match ? match[1] : '';
  }

  async function callGrok(requestId, prompt) {
    var csrfToken = getCsrfToken();
    if (!csrfToken) {
      sendResult(requestId, null, 'Not logged in to X.com');
      return;
    }

    try {
      var response = await fetch(GROK_ENDPOINT, {
        method: 'POST',
        headers: {
          'authorization': 'Bearer ' + BEARER_TOKEN,
          'x-csrf-token': csrfToken,
          'x-twitter-auth-type': 'OAuth2Session',
          'x-twitter-active-user': 'yes',
          'x-twitter-client-language': 'en',
          'content-type': 'text/plain;charset=UTF-8'
        },
        credentials: 'include',
        body: JSON.stringify({
          responses: [
            {
              message: prompt,
              sender: 1,
              promptSource: '',
              fileAttachments: []
            }
          ],
          systemPromptName: '',
          grokModelOptionId: 'grok-3',
          conversationId: '',
          returnSearchResults: false,
          returnCitations: false,
          promptMetadata: {
            promptSource: 'NATURAL',
            action: 'INPUT'
          },
          imageGenerationCount: 0,
          requestFeatures: {
            eagerTweets: false,
            serverHistory: false
          },
          enableSideBySide: false,
          toolOverrides: {},
          modelConfigOverride: {},
          isTemporaryChat: true
        })
      });

      if (!response.ok) {
        var errText = await response.text().catch(function () { return ''; });
        sendResult(requestId, null, 'Grok API error: ' + response.status + ' — ' + errText.substring(0, 200));
        return;
      }

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
        fullMessage = responseText;
      }

      sendResult(requestId, fullMessage, null);
    } catch (err) {
      sendResult(requestId, null, err.message || 'Grok request failed');
    }
  }

  function sendResult(requestId, data, error) {
    window.postMessage({
      type: 'XCARD_GROK_RESPONSE',
      requestId: requestId,
      data: data,
      error: error
    }, '*');
  }

  // Listen for requests from the content script (ISOLATED world)
  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'XCARD_GROK_REQUEST') return;
    callGrok(event.data.requestId, event.data.prompt);
  });
})();
