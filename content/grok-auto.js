// XCard Grok Automation — Runs on x.com/i/grok pages
// Automates the actual Grok UI: type prompt, click send, capture response.
// Only activates when opened by XCard (detected via URL hash).

(function () {
  'use strict';

  // Only activate if opened by XCard
  var hash = window.location.hash;
  if (!hash || !hash.startsWith('#xcard_')) return;

  var requestId = hash.substring(1);
  console.log('[XCard Grok Auto] Activated, requestId:', requestId);

  // Ask background for the prompt
  chrome.runtime.sendMessage({ type: 'GROK_AUTO_READY', requestId: requestId }, function (response) {
    if (!response || !response.prompt) {
      console.error('[XCard Grok Auto] No prompt received');
      sendResult(requestId, null, 'No prompt received from background');
      return;
    }
    console.log('[XCard Grok Auto] Got prompt, length:', response.prompt.length);
    runAutomation(response.prompt, requestId);
  });

  async function runAutomation(prompt, reqId) {
    try {
      // Step 1: Wait for the Grok chat input to be ready
      console.log('[XCard Grok Auto] Waiting for chat input...');
      var input = await waitForInput(15000);
      console.log('[XCard Grok Auto] Input found:', input.tagName);

      // Step 2: Type the prompt
      console.log('[XCard Grok Auto] Typing prompt...');
      await typePrompt(input, prompt);
      await sleep(300);

      // Step 3: Find and click the send button
      console.log('[XCard Grok Auto] Looking for send button...');
      var sendBtn = await waitForSendButton(5000);
      console.log('[XCard Grok Auto] Clicking send...');
      sendBtn.click();

      // Step 4: Wait for the response to finish streaming
      console.log('[XCard Grok Auto] Waiting for Grok response...');
      var responseText = await waitForResponse(60000);
      console.log('[XCard Grok Auto] Response received, length:', responseText.length);

      sendResult(reqId, responseText, null);
    } catch (err) {
      console.error('[XCard Grok Auto] Error:', err);
      sendResult(reqId, null, err.message || 'Grok automation failed');
    }
  }

  // --- DOM Interaction Helpers ---

  function waitForInput(timeout) {
    var selectors = [
      'textarea[data-testid]',
      'div[role="textbox"]',
      'textarea',
      '[contenteditable="true"]',
      'div[data-testid*="input"]',
      'div[data-testid*="Input"]'
    ];

    return new Promise(function (resolve, reject) {
      var elapsed = 0;
      var interval = 500;

      function check() {
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el && el.offsetParent !== null) {
            resolve(el);
            return;
          }
        }
        elapsed += interval;
        if (elapsed >= timeout) {
          reject(new Error('Grok chat input not found after ' + timeout + 'ms'));
          return;
        }
        setTimeout(check, interval);
      }
      check();
    });
  }

  function typePrompt(input, text) {
    return new Promise(function (resolve) {
      input.focus();

      if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') {
        // For native textarea/input
        var nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        ).set || Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        ).set;
        nativeSetter.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        // For contenteditable or role="textbox"
        input.textContent = text;
        input.dispatchEvent(new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: text
        }));
      }

      // Also try clipboard paste approach as fallback
      setTimeout(resolve, 200);
    });
  }

  function waitForSendButton(timeout) {
    var selectors = [
      'button[data-testid="send"]',
      'button[data-testid="sendButton"]',
      'button[aria-label="Send"]',
      'button[aria-label="send"]',
      'button[aria-label*="Send"]',
      'button[data-testid*="send" i]'
    ];

    return new Promise(function (resolve, reject) {
      var elapsed = 0;
      var interval = 300;

      function check() {
        // Try specific selectors first
        for (var i = 0; i < selectors.length; i++) {
          var el = document.querySelector(selectors[i]);
          if (el && !el.disabled) {
            resolve(el);
            return;
          }
        }

        // Fallback: find button near the input area that's likely "send"
        var buttons = document.querySelectorAll('button');
        for (var j = buttons.length - 1; j >= 0; j--) {
          var btn = buttons[j];
          var label = (btn.getAttribute('aria-label') || '').toLowerCase();
          var text = (btn.textContent || '').toLowerCase().trim();
          if ((label.includes('send') || label.includes('submit') ||
               text === 'send' || text === 'submit' ||
               btn.querySelector('svg')) && !btn.disabled) {
            // Check if it's near the bottom (likely the send button)
            var rect = btn.getBoundingClientRect();
            if (rect.bottom > window.innerHeight * 0.5) {
              resolve(btn);
              return;
            }
          }
        }

        elapsed += interval;
        if (elapsed >= timeout) {
          // Last resort: try Enter key
          console.log('[XCard Grok Auto] Send button not found, trying Enter key');
          var input = document.querySelector('textarea, [role="textbox"], [contenteditable="true"]');
          if (input) {
            input.dispatchEvent(new KeyboardEvent('keydown', {
              key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true
            }));
            // Create a fake button that was "clicked"
            resolve({ click: function() {} });
            return;
          }
          reject(new Error('Send button not found after ' + timeout + 'ms'));
          return;
        }
        setTimeout(check, interval);
      }
      check();
    });
  }

  function waitForResponse(timeout) {
    return new Promise(function (resolve, reject) {
      var elapsed = 0;
      var checkInterval = 1000;
      var lastText = '';
      var stableCount = 0;
      var STABLE_THRESHOLD = 3; // Text must be stable for 3 checks (3 seconds)

      function check() {
        // Look for Grok's response text
        // Grok responses appear as message bubbles after the user's message
        var responseText = extractLatestResponse();

        if (responseText && responseText.length > 0) {
          if (responseText === lastText) {
            stableCount++;
            if (stableCount >= STABLE_THRESHOLD) {
              // Response is stable — streaming is done
              resolve(responseText);
              return;
            }
          } else {
            stableCount = 0;
            lastText = responseText;
          }
        }

        elapsed += checkInterval;
        if (elapsed >= timeout) {
          if (lastText) {
            // Return whatever we have
            resolve(lastText);
          } else {
            reject(new Error('No Grok response received after ' + timeout + 'ms'));
          }
          return;
        }
        setTimeout(check, checkInterval);
      }

      // Wait a bit before first check to let the UI update
      setTimeout(check, 2000);
    });
  }

  function extractLatestResponse() {
    // Strategy: find all message-like containers, get the LAST one that's from Grok (not user)
    // Grok messages are typically in a different style/position than user messages

    // Try multiple approaches
    var text = '';

    // Approach 1: Look for specific message containers
    var messageContainers = document.querySelectorAll(
      '[data-testid*="message"], [data-testid*="response"], ' +
      '[class*="message"], [class*="Message"]'
    );
    if (messageContainers.length > 0) {
      var last = messageContainers[messageContainers.length - 1];
      text = last.innerText || last.textContent || '';
      if (text.length > 20) return text.trim();
    }

    // Approach 2: Look for markdown-rendered content (Grok typically renders markdown)
    var markdownBlocks = document.querySelectorAll(
      '[class*="markdown"], [class*="Markdown"], ' +
      '[data-testid*="markdown"], .prose'
    );
    if (markdownBlocks.length > 0) {
      var lastMd = markdownBlocks[markdownBlocks.length - 1];
      text = lastMd.innerText || lastMd.textContent || '';
      if (text.length > 20) return text.trim();
    }

    // Approach 3: Look for the conversation turn structure
    // Grok UI likely has turn containers for user/assistant
    var turns = document.querySelectorAll(
      '[data-testid*="turn"], [data-testid*="Turn"], ' +
      '[role="article"], [class*="turn"], [class*="Turn"]'
    );
    if (turns.length >= 2) {
      // Last turn should be Grok's response
      var lastTurn = turns[turns.length - 1];
      text = lastTurn.innerText || lastTurn.textContent || '';
      if (text.length > 20) return text.trim();
    }

    // Approach 4: Brute force — find the largest text block that appeared after our input
    var allDivs = document.querySelectorAll('main div, [role="main"] div');
    var longestText = '';
    for (var i = 0; i < allDivs.length; i++) {
      var div = allDivs[i];
      var t = (div.innerText || '').trim();
      if (t.length > longestText.length && t.length > 50 &&
          div.children.length > 0 && // Has child elements (structured content)
          !div.querySelector('textarea') && // Not an input area
          !div.querySelector('input')) {
        longestText = t;
      }
    }
    if (longestText.length > 50) return longestText;

    return '';
  }

  // --- Utilities ---

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  function sendResult(reqId, data, error) {
    chrome.runtime.sendMessage({
      type: 'GROK_AUTO_RESULT',
      requestId: reqId,
      success: !error,
      data: data,
      error: error
    });
  }
})();
