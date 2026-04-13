(function () {
  'use strict';

  var langSelect = document.getElementById('lang');
  var savedMsg = document.getElementById('saved');

  // Load saved preference
  chrome.storage.local.get({ xcard_language: 'zh' }, function (store) {
    langSelect.value = store.xcard_language;
  });

  // Save on change
  langSelect.addEventListener('change', function () {
    chrome.storage.local.set({ xcard_language: langSelect.value }, function () {
      savedMsg.classList.add('show');
      setTimeout(function () { savedMsg.classList.remove('show'); }, 1500);
    });
  });
})();
