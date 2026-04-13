// XCard Background Service Worker
// Handles: Grok automation via tab, avatar proxy

(function () {
  'use strict';

  // --- Pending Grok Requests ---
  // Map of requestId → { prompt, sendResponse, tabId }
  var pendingRequests = {};

  // --- Prompt Builder ---

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
    // Strip "Thought for Xs" prefix that Grok adds for reasoning
    text = text.replace(/^Thought for \d+s\s*/i, '');

    // The captured text may include BOTH the user's prompt AND Grok's response.
    // Our prompt template contains "TITLE: <title here>" — we need to skip it
    // and find Grok's actual TITLE/TLDR output.

    // Find ALL occurrences of TITLE: and use the LAST one (Grok's response)
    var titleMatches = [];
    var titleRegex = /TITLE:\s*(.+?)(?:\n|$)/g;
    var m;
    while ((m = titleRegex.exec(text)) !== null) {
      titleMatches.push(m[1].trim());
    }

    // Find ALL occurrences of TLDR: and use the LAST one
    var tldrMatches = [];
    var tldrRegex = /TLDR:\s*\n?([\s\S]+?)(?=\nTITLE:|$)/g;
    while ((m = tldrRegex.exec(text)) !== null) {
      tldrMatches.push(m[1].trim());
    }

    // Use last TITLE that's not our template placeholder
    var title = '';
    for (var i = titleMatches.length - 1; i >= 0; i--) {
      if (titleMatches[i] !== '<title here>' && titleMatches[i].length > 2) {
        title = titleMatches[i];
        break;
      }
    }

    // For TLDR, get everything after the last "TLDR:" marker
    var tldr = '';
    var lastTldrIdx = text.lastIndexOf('TLDR:');
    if (lastTldrIdx !== -1) {
      tldr = text.substring(lastTldrIdx + 5).trim();
    } else if (tldrMatches.length > 0) {
      tldr = tldrMatches[tldrMatches.length - 1];
    }

    // If still no tldr, use everything after the title
    if (!tldr && title) {
      var titleIdx = text.lastIndexOf(title);
      if (titleIdx !== -1) {
        tldr = text.substring(titleIdx + title.length).replace(/^\s*\n/, '').trim();
      }
    }

    // Final fallback
    if (!tldr) {
      tldr = text.trim();
    }

    // Clean up: remove any remaining "Thought for Xs" in tldr
    tldr = tldr.replace(/^Thought for \d+s\s*/gi, '');

    return {
      title: title,
      tldr: tldr
    };
  }

  // --- Grok via Tab Automation ---

  function generateTldr(tweetData, language) {
    return new Promise(function (resolve, reject) {
      var prompt = buildPrompt(tweetData, language);
      var requestId = 'xcard_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

      pendingRequests[requestId] = {
        prompt: prompt,
        resolve: resolve,
        reject: reject
      };

      // Open Grok in a background tab
      chrome.tabs.create({
        url: 'https://x.com/i/grok#' + requestId,
        active: false
      }, function (tab) {
        if (chrome.runtime.lastError) {
          delete pendingRequests[requestId];
          reject(new Error('Failed to open Grok tab: ' + chrome.runtime.lastError.message));
          return;
        }
        pendingRequests[requestId].tabId = tab.id;
        console.log('[XCard] Opened Grok tab:', tab.id, 'requestId:', requestId);

        // Set a timeout for the entire operation
        setTimeout(function () {
          if (pendingRequests[requestId]) {
            delete pendingRequests[requestId];
            try { chrome.tabs.remove(tab.id); } catch (e) {}
            reject(new Error('Grok automation timed out after 90s'));
          }
        }, 90000);
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
    // Content script requests TLDR generation
    if (message.type === 'GENERATE_TLDR') {
      generateTldr(message.tweetData, message.language)
        .then(function (rawText) {
          var result = parseGrokResponse(rawText);
          sendResponse({ success: true, data: result });
        })
        .catch(function (err) {
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    // Avatar proxy
    if (message.type === 'FETCH_AVATAR') {
      fetchAvatarAsBase64(message.url)
        .then(function (dataUrl) { sendResponse({ success: true, dataUrl: dataUrl }); })
        .catch(function (err) { sendResponse({ success: false, error: err.message }); });
      return true;
    }

    // Grok automation tab is ready and asks for the prompt
    if (message.type === 'GROK_AUTO_READY') {
      var req = pendingRequests[message.requestId];
      if (req) {
        sendResponse({ prompt: req.prompt });
      } else {
        sendResponse({ prompt: null });
      }
      return false;
    }

    // Grok automation tab finished
    if (message.type === 'GROK_AUTO_RESULT') {
      var pending = pendingRequests[message.requestId];
      if (pending) {
        delete pendingRequests[message.requestId];
        // Close the Grok tab
        if (pending.tabId) {
          try { chrome.tabs.remove(pending.tabId); } catch (e) {}
        }
        if (message.success && message.data) {
          pending.resolve(message.data);
        } else {
          pending.reject(new Error(message.error || 'Grok automation failed'));
        }
      }
      return false;
    }
  });

  console.log('[XCard] Service worker started');
})();
