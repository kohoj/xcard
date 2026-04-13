// XCard Grok Bridge — Runs in MAIN world (page context)
// Two-step flow: CreateGrokConversation → add_response.json

(function () {
  'use strict';

  var BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  var CREATE_CONV_ENDPOINT = 'https://x.com/i/api/graphql/vvC5uy7pWWHXS2aDi1FZeA/CreateGrokConversation';
  var ADD_RESPONSE_ENDPOINT = 'https://grok.x.com/2/grok/add_response.json';

  function getCsrfToken() {
    var match = document.cookie.match(/(?:^|;\s*)ct0=([^;]+)/);
    return match ? match[1] : '';
  }

  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  // Step 1: Create a new Grok conversation
  async function createConversation(csrfToken) {
    var response = await fetch(CREATE_CONV_ENDPOINT, {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + BEARER_TOKEN,
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en'
      },
      credentials: 'include',
      body: JSON.stringify({
        variables: {},
        queryId: 'vvC5uy7pWWHXS2aDi1FZeA'
      })
    });

    if (!response.ok) {
      throw new Error('Failed to create Grok conversation: ' + response.status);
    }

    var data = await response.json();
    // Extract conversationId from GraphQL response
    var convId = data && data.data && data.data.create_grok_conversation &&
                 data.data.create_grok_conversation.conversation_id;
    if (!convId) {
      // Try alternative response shapes
      convId = data && data.data && data.data.grok_conversation_id;
      if (!convId) {
        // Last resort: look for any string that looks like a conversation ID
        var jsonStr = JSON.stringify(data);
        var match = jsonStr.match(/"conversation_id"\s*:\s*"(\d+)"/);
        if (match) convId = match[1];
      }
    }

    if (!convId) {
      throw new Error('Could not extract conversationId from response: ' + JSON.stringify(data).substring(0, 200));
    }

    return convId;
  }

  // Step 2: Send message to the conversation
  async function addResponse(csrfToken, conversationId, prompt) {
    var response = await fetch(ADD_RESPONSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + BEARER_TOKEN,
        'content-type': 'text/plain;charset=UTF-8',
        'x-csrf-token': csrfToken,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
        'x-xai-request-id': generateUUID(),
        'origin': 'https://x.com',
        'referer': 'https://x.com/'
      },
      credentials: 'include',
      body: JSON.stringify({
        responses: [
          {
            message: prompt,
            sender: 1,
            fileAttachments: []
          }
        ],
        systemPromptName: '',
        conversationId: conversationId,
        grokModelOptionId: 'grok-4-auto',
        modelMode: 'MODEL_MODE_AUTO',
        returnSearchResults: true,
        returnCitations: true,
        requestFeatures: {
          eagerTweets: true,
          serverHistory: true
        },
        toolOverrides: {},
        enableSideBySide: false,
        isTemporaryChat: false
      })
    });

    if (!response.ok) {
      var errText = await response.text().catch(function () { return ''; });
      throw new Error('Grok API error: ' + response.status + ' — ' + errText.substring(0, 300));
    }

    // Parse streaming JSONL response
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

    return fullMessage;
  }

  // Main handler
  async function callGrok(requestId, prompt) {
    var csrfToken = getCsrfToken();
    if (!csrfToken) {
      sendResult(requestId, null, 'Not logged in to X.com');
      return;
    }

    try {
      // Step 1: Create conversation
      var conversationId = await createConversation(csrfToken);
      // Step 2: Send message
      var result = await addResponse(csrfToken, conversationId, prompt);
      sendResult(requestId, result, null);
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
