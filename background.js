// XCard Background Service Worker
// Handles: AI API calls (OpenAI-compatible), avatar proxy

(function () {
  'use strict';

  // --- Prompt Builder ---

  function buildPrompt(tweetData, language) {
    var langInstruction = language || 'Chinese';
    var hasTitle = tweetData.articleTitle && tweetData.articleTitle.trim();

    var systemPrompt = 'You summarize X (Twitter) posts. Respond in ' + langInstruction + '. '
      + 'Output format:\nTITLE: <one-line title>\nTLDR:\n<markdown summary with bullet points>';

    var userPrompt = 'Post by ' + tweetData.authorHandle + ':\n\n' + tweetData.tweetText;

    if (hasTitle) {
      userPrompt += '\n\nOriginal title: ' + tweetData.articleTitle;
      systemPrompt += '\nUse the original title as TITLE.';
    }

    userPrompt += '\n\nGenerate a concise title and a thorough TL;DR summary (3-8 bullet points). '
      + 'Use **bold** for key points. Include a brief intro sentence before the bullets.';

    return { system: systemPrompt, user: userPrompt };
  }

  function parseResponse(text) {
    // Strip thinking prefixes
    text = text.replace(/^Thought for \d+s\s*/i, '');

    var titleMatch = text.match(/TITLE:\s*(.+?)(?:\n|$)/);
    var lastTldrIdx = text.lastIndexOf('TLDR:');
    var tldr = lastTldrIdx !== -1 ? text.substring(lastTldrIdx + 5).trim() : '';

    var title = titleMatch ? titleMatch[1].trim() : '';
    if (!tldr) tldr = text.replace(/TITLE:.*\n?/, '').trim();

    return { title: title, tldr: tldr };
  }

  // --- API Call (OpenAI-compatible) ---

  async function callAPI(tweetData, language) {
    var settings = await getSettings();
    if (!settings.baseUrl || !settings.apiKey || !settings.model) {
      throw new Error('API not configured. Click the XCard icon to set up your AI provider.');
    }

    var prompts = buildPrompt(tweetData, language);
    var endpoint = settings.baseUrl.replace(/\/+$/, '') + '/chat/completions';

    var body = {
      model: settings.model,
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user }
      ],
      max_tokens: 4096,
      temperature: 0.3,
      stream: false
    };

    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + settings.apiKey
    };

    // Anthropic uses a different header
    if (settings.baseUrl.includes('anthropic.com')) {
      headers['x-api-key'] = settings.apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
    }

    var response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      var errText = await response.text().catch(function () { return ''; });
      throw new Error('API error ' + response.status + ': ' + errText.substring(0, 200));
    }

    var data = await response.json();

    // Extract text from response (handle OpenAI, Anthropic, and thinking models)
    var text = '';
    if (data.choices && data.choices[0]) {
      var msg = data.choices[0].message || {};
      // Standard: content field
      text = msg.content || '';
      // Thinking models: content may be null, check reasoning fields
      if (!text) {
        text = msg.reasoning || msg.reasoning_content || '';
      }
      // Fallback: text field (older completions API)
      if (!text) {
        text = data.choices[0].text || '';
      }
    } else if (data.content && data.content[0]) {
      // Anthropic format
      text = data.content[0].text || '';
    }

    if (!text) {
      throw new Error('Empty response from API');
    }

    return parseResponse(text);
  }

  // --- Test API ---

  async function testAPI(baseUrl, apiKey, model) {
    var endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';

    var headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };

    if (baseUrl.includes('anthropic.com')) {
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      delete headers['Authorization'];
    }

    var response = await fetch(endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: model,
        messages: [{ role: 'user', content: 'Say "XCard OK" in 3 words. No thinking, just answer.' }],
        max_tokens: 50,
        stream: false
      })
    });

    if (!response.ok) {
      var errText = await response.text().catch(function () { return ''; });
      throw new Error(response.status + ': ' + errText.substring(0, 150));
    }

    var data = await response.json();
    var text = '';
    if (data.choices && data.choices[0]) {
      var msg = data.choices[0].message || {};
      text = msg.content || msg.reasoning || msg.reasoning_content || data.choices[0].text || '';
    } else if (data.content && data.content[0]) {
      text = data.content[0].text || '';
    }

    return (text || 'OK (empty content)').trim().substring(0, 50);
  }

  // --- Settings ---

  function getSettings() {
    return new Promise(function (resolve) {
      chrome.storage.local.get({
        xcard_base_url: '',
        xcard_api_key: '',
        xcard_model: ''
      }, function (s) {
        resolve({
          baseUrl: s.xcard_base_url,
          apiKey: s.xcard_api_key,
          model: s.xcard_model
        });
      });
    });
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
        reader.onerror = function () { resolve(''); };
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
      callAPI(message.tweetData, message.language)
        .then(function (result) { sendResponse({ success: true, data: result }); })
        .catch(function (err) { sendResponse({ success: false, error: err.message }); });
      return true;
    }

    if (message.type === 'FETCH_AVATAR') {
      fetchAvatarAsBase64(message.url)
        .then(function (dataUrl) { sendResponse({ success: true, dataUrl: dataUrl }); })
        .catch(function (err) { sendResponse({ success: false, error: err.message }); });
      return true;
    }

    if (message.type === 'TEST_API') {
      console.log('[XCard] Testing API:', message.baseUrl, message.model);
      testAPI(message.baseUrl, message.apiKey, message.model)
        .then(function (preview) {
          console.log('[XCard] Test success:', preview);
          sendResponse({ success: true, preview: preview });
        })
        .catch(function (err) {
          console.error('[XCard] Test failed:', err);
          sendResponse({ success: false, error: err.message || String(err) });
        });
      return true;
    }
  });

  console.log('[XCard] Service worker started');
})();
