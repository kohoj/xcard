(function () {
  'use strict';

  var baseUrlInput = document.getElementById('baseUrl');
  var apiKeyInput = document.getElementById('apiKey');
  var modelInput = document.getElementById('model');
  var langSelect = document.getElementById('lang');
  var savedMsg = document.getElementById('saved');
  var testBtn = document.getElementById('testBtn');
  var testResult = document.getElementById('testResult');

  // --- Load saved settings ---
  chrome.storage.local.get({
    xcard_language: 'zh',
    xcard_base_url: '',
    xcard_api_key: '',
    xcard_model: ''
  }, function (store) {
    langSelect.value = store.xcard_language;
    baseUrlInput.value = store.xcard_base_url;
    apiKeyInput.value = store.xcard_api_key;
    modelInput.value = store.xcard_model;
  });

  // --- Auto-save on change ---
  function save() {
    chrome.storage.local.set({
      xcard_language: langSelect.value,
      xcard_base_url: baseUrlInput.value.replace(/\/+$/, ''),
      xcard_api_key: apiKeyInput.value,
      xcard_model: modelInput.value
    }, function () {
      savedMsg.classList.add('show');
      setTimeout(function () { savedMsg.classList.remove('show'); }, 1500);
    });
  }

  baseUrlInput.addEventListener('change', save);
  apiKeyInput.addEventListener('change', save);
  modelInput.addEventListener('change', save);
  langSelect.addEventListener('change', save);

  // --- Preset buttons ---
  document.querySelectorAll('.preset-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      baseUrlInput.value = btn.getAttribute('data-base');
      modelInput.value = btn.getAttribute('data-model');
      save();
    });
  });

  // --- Test connection ---
  testBtn.addEventListener('click', function () {
    var baseUrl = baseUrlInput.value.replace(/\/+$/, '');
    var apiKey = apiKeyInput.value;
    var model = modelInput.value;

    if (!baseUrl || !apiKey || !model) {
      showTestResult('error', 'Please fill in all fields');
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
        showTestResult('error', 'Extension error: ' + chrome.runtime.lastError.message);
        return;
      }
      if (resp && resp.success) {
        showTestResult('success', 'Connected! Response: ' + (resp.preview || 'OK'));
      } else {
        showTestResult('error', resp ? resp.error : 'No response from background');
      }
    });
  });

  function showTestResult(type, msg) {
    testResult.className = 'test-result ' + type;
    testResult.textContent = msg;
    testResult.style.display = 'block';
  }
})();
