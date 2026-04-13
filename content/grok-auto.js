// XCard Grok Automation — Runs on x.com/i/grok pages
// High-fidelity: types prompt into real Grok UI, captures response.
// Self-diagnosing: logs DOM structure to help debug selector issues.

(function () {
  'use strict';

  var hash = window.location.hash;
  if (!hash || !hash.startsWith('#xcard_')) return;

  var requestId = hash.substring(1);
  console.log('[XCard Auto] Activated, requestId:', requestId);

  chrome.runtime.sendMessage({ type: 'GROK_AUTO_READY', requestId: requestId }, function (response) {
    if (!response || !response.prompt) {
      console.error('[XCard Auto] No prompt received');
      sendResult(requestId, null, 'No prompt received');
      return;
    }
    console.log('[XCard Auto] Got prompt, length:', response.prompt.length);
    runAutomation(response.prompt, requestId);
  });

  async function runAutomation(prompt, reqId) {
    try {
      // Step 1: Wait for page to be interactive
      console.log('[XCard Auto] Waiting for page to load...');
      await waitFor(3000);

      // Step 2: Diagnose the page — find input and button
      console.log('[XCard Auto] Diagnosing page DOM...');
      var diagnosis = diagnosePage();
      console.log('[XCard Auto] Diagnosis:', JSON.stringify(diagnosis, null, 2));

      if (!diagnosis.input) {
        // Wait more and retry
        console.log('[XCard Auto] Input not found, waiting more...');
        await waitFor(5000);
        diagnosis = diagnosePage();
        console.log('[XCard Auto] Diagnosis retry:', JSON.stringify(diagnosis, null, 2));
      }

      if (!diagnosis.input) {
        throw new Error('Could not find Grok chat input. Page state: ' + diagnosis.summary);
      }

      // Step 3: Focus and type into the input
      var inputEl = diagnosis.input;
      console.log('[XCard Auto] Found input:', inputEl.tagName, inputEl.className.substring(0, 50));
      inputEl.focus();
      await waitFor(200);

      // Try multiple typing approaches
      var typed = false;

      // Approach 1: Native value setter (for textarea/input)
      if (inputEl.tagName === 'TEXTAREA' || inputEl.tagName === 'INPUT') {
        try {
          var descriptor = Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(inputEl), 'value'
          );
          if (descriptor && descriptor.set) {
            descriptor.set.call(inputEl, prompt);
            inputEl.dispatchEvent(new Event('input', { bubbles: true }));
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
            typed = true;
            console.log('[XCard Auto] Typed via native setter');
          }
        } catch (e) {
          console.warn('[XCard Auto] Native setter failed:', e.message);
        }
      }

      // Approach 2: execCommand insertText (for contenteditable)
      if (!typed) {
        try {
          inputEl.focus();
          document.execCommand('selectAll', false, null);
          document.execCommand('insertText', false, prompt);
          typed = true;
          console.log('[XCard Auto] Typed via execCommand');
        } catch (e) {
          console.warn('[XCard Auto] execCommand failed:', e.message);
        }
      }

      // Approach 3: Set textContent + dispatch input event
      if (!typed) {
        inputEl.textContent = prompt;
        inputEl.innerHTML = prompt;
        inputEl.dispatchEvent(new InputEvent('input', {
          bubbles: true, cancelable: true, inputType: 'insertText', data: prompt
        }));
        typed = true;
        console.log('[XCard Auto] Typed via textContent');
      }

      await waitFor(500);

      // Verify text was entered
      var currentValue = inputEl.value || inputEl.textContent || inputEl.innerText || '';
      console.log('[XCard Auto] Current input value length:', currentValue.length);

      if (currentValue.length < 10) {
        // Try clipboard paste as last resort
        console.log('[XCard Auto] Input seems empty, trying clipboard paste...');
        try {
          inputEl.focus();
          await navigator.clipboard.writeText(prompt);
          document.execCommand('paste');
          await waitFor(300);
          console.log('[XCard Auto] Pasted via clipboard');
        } catch (e) {
          console.warn('[XCard Auto] Clipboard paste failed:', e.message);
        }
      }

      await waitFor(300);

      // Snapshot page text BEFORE sending, so we can isolate the NEW response
      var preSnapshot = document.body.innerText || '';

      // Step 4: Click send or press Enter
      console.log('[XCard Auto] Looking for send button...');
      var sendBtn = findSendButton();

      if (sendBtn) {
        console.log('[XCard Auto] Clicking send button:', sendBtn.tagName, sendBtn.getAttribute('aria-label') || sendBtn.textContent.substring(0, 20));
        sendBtn.click();
      } else {
        console.log('[XCard Auto] No send button found, pressing Enter...');
        inputEl.dispatchEvent(new KeyboardEvent('keydown', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
        }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true
        }));
      }

      // Step 5: Wait for response (pass pre-snapshot to isolate new content)
      console.log('[XCard Auto] Waiting for Grok response...');
      var responseText = await waitForResponse(90000, preSnapshot);

      if (!responseText || responseText.length < 10) {
        throw new Error('Grok response was empty or too short');
      }

      console.log('[XCard Auto] Got response, length:', responseText.length);
      sendResult(reqId, responseText, null);

    } catch (err) {
      console.error('[XCard Auto] Error:', err);
      sendResult(reqId, null, err.message);
    }
  }

  // --- Page Diagnosis ---

  function diagnosePage() {
    var result = {
      url: location.href,
      input: null,
      sendButton: null,
      summary: ''
    };

    // Find all potential input elements
    var candidates = [];

    // Textareas
    var textareas = document.querySelectorAll('textarea');
    textareas.forEach(function (t) {
      candidates.push({
        el: t, tag: 'textarea',
        placeholder: t.placeholder || '',
        visible: t.offsetParent !== null,
        testid: t.getAttribute('data-testid') || ''
      });
    });

    // Contenteditable
    var editables = document.querySelectorAll('[contenteditable="true"]');
    editables.forEach(function (e) {
      candidates.push({
        el: e, tag: e.tagName + '[contenteditable]',
        placeholder: e.getAttribute('data-placeholder') || e.getAttribute('placeholder') || '',
        visible: e.offsetParent !== null,
        testid: e.getAttribute('data-testid') || ''
      });
    });

    // role="textbox"
    var textboxes = document.querySelectorAll('[role="textbox"]');
    textboxes.forEach(function (t) {
      candidates.push({
        el: t, tag: t.tagName + '[role=textbox]',
        placeholder: t.getAttribute('data-placeholder') || t.getAttribute('placeholder') || '',
        visible: t.offsetParent !== null,
        testid: t.getAttribute('data-testid') || ''
      });
    });

    console.log('[XCard Auto] Input candidates:', candidates.map(function (c) {
      return c.tag + ' visible=' + c.visible + ' placeholder="' + c.placeholder + '" testid="' + c.testid + '"';
    }));

    // Pick the best visible input
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i].visible) {
        result.input = candidates[i].el;
        break;
      }
    }
    // Fallback: any input even if not "visible" by offsetParent check
    if (!result.input && candidates.length > 0) {
      result.input = candidates[0].el;
    }

    // Find send button
    result.sendButton = findSendButton();

    result.summary = candidates.length + ' inputs, ' +
      (result.sendButton ? 'send button found' : 'no send button') +
      ', body children: ' + document.body.children.length;

    return result;
  }

  function findSendButton() {
    // Try specific selectors
    var selectors = [
      'button[data-testid="send"]',
      'button[data-testid="sendButton"]',
      'button[data-testid*="send" i]',
      'button[aria-label="Send"]',
      'button[aria-label*="Send"]',
      'button[aria-label*="send"]',
      'button[aria-label="Submit"]'
    ];

    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i]);
        if (el) return el;
      } catch (e) {}
    }

    // Log all buttons for diagnosis
    var allButtons = document.querySelectorAll('button');
    var buttonInfo = [];
    for (var j = 0; j < allButtons.length; j++) {
      var btn = allButtons[j];
      var info = {
        aria: btn.getAttribute('aria-label') || '',
        testid: btn.getAttribute('data-testid') || '',
        text: (btn.textContent || '').trim().substring(0, 30),
        hasSvg: !!btn.querySelector('svg'),
        disabled: btn.disabled
      };
      if (info.aria || info.testid || info.text) {
        buttonInfo.push(info);
      }
    }
    console.log('[XCard Auto] All buttons:', JSON.stringify(buttonInfo));

    // Heuristic: find a button near the bottom of the page with an SVG (arrow icon)
    for (var k = allButtons.length - 1; k >= 0; k--) {
      var b = allButtons[k];
      if (b.querySelector('svg') && !b.disabled) {
        var rect = b.getBoundingClientRect();
        // Should be in the bottom portion of the viewport
        if (rect.top > window.innerHeight * 0.6 && rect.width < 60) {
          return b;
        }
      }
    }

    return null;
  }

  // --- Wait for Response ---

  function waitForResponse(timeout, preSnapshot) {
    return new Promise(function (resolve, reject) {
      var startTime = Date.now();
      var lastText = '';
      var stableCount = 0;
      var STABLE_CHECKS = 3;

      function check() {
        var elapsed = Date.now() - startTime;
        var text = extractResponse(preSnapshot);

        if (text && text.length > 20) {
          if (text === lastText) {
            stableCount++;
            if (stableCount >= STABLE_CHECKS) {
              console.log('[XCard Auto] Response stable after', Math.round(elapsed / 1000), 's');
              resolve(text);
              return;
            }
          } else {
            stableCount = 0;
            lastText = text;
            console.log('[XCard Auto] Response updating... length:', text.length);
          }
        }

        if (elapsed >= timeout) {
          if (lastText && lastText.length > 20) {
            resolve(lastText);
          } else {
            reject(new Error('Grok response timeout (' + Math.round(elapsed / 1000) + 's)'));
          }
          return;
        }

        setTimeout(check, 1500);
      }

      setTimeout(check, 3000);
    });
  }

  function extractResponse(preSnapshot) {
    // Get current full page text
    var currentText = document.body.innerText || '';

    // The NEW content is what appeared after we sent the message.
    // Simple diff: find text in currentText that wasn't in preSnapshot.
    var newContent = '';
    if (preSnapshot && currentText.length > preSnapshot.length) {
      // Find where the new content starts
      // The page text grows as Grok streams its response
      // Strategy: find the longest suffix of currentText that doesn't appear in preSnapshot
      var overlap = findNewContent(preSnapshot, currentText);
      if (overlap.length > 20) {
        newContent = overlap;
      }
    }

    // Also try targeted extraction from DOM
    var domResponse = extractFromDOM();

    // Use whichever is longer and more substantial
    var best = (newContent.length > domResponse.length) ? newContent : domResponse;

    // Clean up: remove "Thought for Xs" prefix
    best = best.replace(/^Thought for \d+s\s*/i, '');

    return best.trim();
  }

  function findNewContent(before, after) {
    // Find content in 'after' that wasn't in 'before'
    // Simple approach: find the point where they diverge
    var minLen = Math.min(before.length, after.length);
    var divergeAt = 0;

    // Find first difference
    for (var i = 0; i < minLen; i++) {
      if (before[i] !== after[i]) {
        divergeAt = i;
        break;
      }
      divergeAt = i;
    }

    // The new content is from divergeAt to end of 'after'
    // But we might have some shared prefix, so look for a natural break
    var newPart = after.substring(divergeAt);

    // Find the start of meaningful new content (skip partial words)
    var lineStart = newPart.indexOf('\n');
    if (lineStart > 0 && lineStart < 50) {
      newPart = newPart.substring(lineStart + 1);
    }

    return newPart.trim();
  }

  function extractFromDOM() {
    // Strategy 1: Find markdown-rendered blocks
    var mdBlocks = document.querySelectorAll(
      '[class*="markdown" i], [class*="prose" i]'
    );
    if (mdBlocks.length > 0) {
      var last = mdBlocks[mdBlocks.length - 1];
      var text = last.innerText || '';
      if (text.length > 20) return text.trim();
    }

    // Strategy 2: Find the last substantial text block that's not an input
    var mainEl = document.querySelector('main, [role="main"]') || document.body;
    var allDivs = mainEl.querySelectorAll('div');
    var best = '';

    for (var i = 0; i < allDivs.length; i++) {
      var div = allDivs[i];
      if (div.querySelector('textarea, [contenteditable="true"], [role="textbox"]')) continue;
      if (div.querySelector('nav, header')) continue;
      var t = (div.innerText || '').trim();
      if (t.length > best.length && t.length > 50 && div.children.length > 0) {
        best = t;
      }
    }

    return best;
  }

  // --- Utilities ---

  function waitFor(ms) {
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
