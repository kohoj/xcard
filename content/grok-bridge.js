// XCard Grok Bridge — Runs in MAIN world (page context)
// Strategy: Intercept X.com's fetch pipeline to capture the
// x-client-transaction-id header generator, then use it for our requests.

(function () {
  'use strict';

  var BEARER_TOKEN = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
  var CREATE_CONV_ENDPOINT = 'https://x.com/i/api/graphql/vvC5uy7pWWHXS2aDi1FZeA/CreateGrokConversation';
  var ADD_RESPONSE_ENDPOINT = 'https://grok.x.com/2/grok/add_response.json';

  // --- Transaction ID capture ---
  // X.com's JS adds x-client-transaction-id to requests.
  // We intercept fetch to capture this header from real X.com requests,
  // then replay the generation for our own requests.
  var capturedTransactionIds = [];
  var nativeFetch = null;

  function setupFetchInterceptor() {
    // Save reference to whatever fetch is currently installed
    // (X.com may have already wrapped it with their interceptor)
    nativeFetch = window.fetch;

    var originalFetch = window.fetch;
    window.fetch = function (input, init) {
      // Capture x-client-transaction-id from any outgoing request
      if (init && init.headers) {
        var txId = null;
        if (init.headers instanceof Headers) {
          txId = init.headers.get('x-client-transaction-id');
        } else if (typeof init.headers === 'object') {
          txId = init.headers['x-client-transaction-id'];
        }
        if (txId) {
          capturedTransactionIds.push(txId);
          // Keep only last 10
          if (capturedTransactionIds.length > 10) {
            capturedTransactionIds.shift();
          }
        }
      }
      return originalFetch.apply(this, arguments);
    };
  }

  // Install interceptor immediately
  setupFetchInterceptor();

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

  // Get a transaction ID: use captured one or generate a base64 random string
  function getTransactionId() {
    if (capturedTransactionIds.length > 0) {
      return capturedTransactionIds[capturedTransactionIds.length - 1];
    }
    // Fallback: generate a random base64-like string
    var bytes = new Uint8Array(48);
    crypto.getRandomValues(bytes);
    return btoa(String.fromCharCode.apply(null, bytes));
  }

  // Step 1: Create a new Grok conversation
  async function createConversation(csrfToken) {
    // Use nativeFetch to go through X.com's pipeline
    var response = await nativeFetch(CREATE_CONV_ENDPOINT, {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + BEARER_TOKEN,
        'content-type': 'application/json',
        'x-csrf-token': csrfToken,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
        'x-client-transaction-id': getTransactionId()
      },
      credentials: 'include',
      body: JSON.stringify({
        variables: {},
        queryId: 'vvC5uy7pWWHXS2aDi1FZeA'
      })
    });

    if (!response.ok) {
      var errText = await response.text().catch(function () { return ''; });
      throw new Error('Failed to create conversation: ' + response.status + ' ' + errText.substring(0, 200));
    }

    var data = await response.json();
    console.log('[XCard] CreateGrokConversation response:', JSON.stringify(data).substring(0, 500));

    // Extract conversationId - try multiple paths
    var convId = null;
    try {
      // Try the most likely path
      convId = data.data.create_grok_conversation.conversation_id;
    } catch (e) {}
    if (!convId) {
      // Search the entire response for a conversation ID pattern
      var jsonStr = JSON.stringify(data);
      var match = jsonStr.match(/"conversation_?[iI]d"\s*:\s*"(\d+)"/i);
      if (match) convId = match[1];
    }

    if (!convId) {
      throw new Error('No conversationId in response: ' + JSON.stringify(data).substring(0, 300));
    }

    return convId;
  }

  // Step 2: Send message to the conversation
  async function addResponse(csrfToken, conversationId, prompt) {
    var response = await nativeFetch(ADD_RESPONSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'authorization': 'Bearer ' + BEARER_TOKEN,
        'content-type': 'text/plain;charset=UTF-8',
        'x-csrf-token': csrfToken,
        'x-twitter-auth-type': 'OAuth2Session',
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': 'en',
        'x-xai-request-id': generateUUID(),
        'x-client-transaction-id': getTransactionId(),
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
      } catch (e) {}
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
      console.log('[XCard] Creating Grok conversation...');
      console.log('[XCard] Captured transaction IDs:', capturedTransactionIds.length);
      var conversationId = await createConversation(csrfToken);
      console.log('[XCard] Conversation created:', conversationId);
      console.log('[XCard] Sending message to Grok...');
      var result = await addResponse(csrfToken, conversationId, prompt);
      console.log('[XCard] Grok responded, length:', result.length);
      sendResult(requestId, result, null);
    } catch (err) {
      console.error('[XCard] Grok error:', err);
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

  window.addEventListener('message', function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== 'XCARD_GROK_REQUEST') return;
    callGrok(event.data.requestId, event.data.prompt);
  });
})();
