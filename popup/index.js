(function () {
  'use strict';

  var baseUrlInput = document.getElementById('baseUrl');
  var apiKeyInput = document.getElementById('apiKey');
  var modelInput = document.getElementById('model');
  var langSelect = document.getElementById('lang');
  var savedMsg = document.getElementById('saved');
  var testBtn = document.getElementById('testBtn');
  var testResult = document.getElementById('testResult');
  var presetBtns = document.querySelectorAll('.preset-btn');

  // --- Load ---
  chrome.storage.local.get({
    xcard_language: 'en',
    xcard_base_url: '',
    xcard_api_key: '',
    xcard_model: ''
  }, function (s) {
    langSelect.value = s.xcard_language;
    baseUrlInput.value = s.xcard_base_url;
    apiKeyInput.value = s.xcard_api_key;
    modelInput.value = s.xcard_model;
    highlightPreset();
  });

  // --- Save ---
  function save() {
    chrome.storage.local.set({
      xcard_language: langSelect.value,
      xcard_base_url: baseUrlInput.value.replace(/\/+$/, ''),
      xcard_api_key: apiKeyInput.value,
      xcard_model: modelInput.value
    }, function () {
      savedMsg.classList.add('show');
      setTimeout(function () { savedMsg.classList.remove('show'); }, 1200);
    });
  }

  baseUrlInput.addEventListener('change', function () { save(); highlightPreset(); });
  apiKeyInput.addEventListener('change', save);
  modelInput.addEventListener('change', function () { save(); highlightPreset(); });
  langSelect.addEventListener('change', save);

  // --- Presets ---
  function highlightPreset() {
    var url = baseUrlInput.value.replace(/\/+$/, '');
    presetBtns.forEach(function (btn) {
      var match = btn.getAttribute('data-base') === url;
      btn.classList.toggle('active', match);
    });
  }

  presetBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      baseUrlInput.value = btn.getAttribute('data-base');
      modelInput.value = btn.getAttribute('data-model');
      save();
      highlightPreset();
    });
  });

  // --- Test ---
  testBtn.addEventListener('click', function () {
    var baseUrl = baseUrlInput.value.replace(/\/+$/, '');
    var apiKey = apiKeyInput.value;
    var model = modelInput.value;

    if (!baseUrl || !apiKey || !model) {
      showResult('error', 'Please fill in all fields.');
      return;
    }

    testBtn.disabled = true;
    testBtn.textContent = 'Testing...';
    testResult.className = 'test-result';
    testResult.style.display = 'none';

    chrome.runtime.sendMessage({
      type: 'TEST_API',
      baseUrl: baseUrl,
      apiKey: apiKey,
      model: model
    }, function (resp) {
      testBtn.disabled = false;
      testBtn.textContent = 'Test Connection';
      if (chrome.runtime.lastError) {
        showResult('error', chrome.runtime.lastError.message);
        return;
      }
      if (resp && resp.success) {
        showResult('success', 'Connected — ' + (resp.preview || 'OK'));
      } else {
        showResult('error', resp ? resp.error : 'No response from background');
      }
    });
  });

  function showResult(type, msg) {
    testResult.className = 'test-result ' + type;
    testResult.textContent = msg;
    testResult.style.display = 'block';
  }
})();
