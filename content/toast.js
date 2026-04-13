window.XCard = window.XCard || {};

XCard.Toast = (function () {
  'use strict';

  var TIMEOUT = 3000;
  var activeToast = null;

  function show(message, type) {
    dismiss();
    var toast = document.createElement('div');
    toast.className = 'xcard-toast xcard-toast--' + (type || 'info');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('xcard-toast--visible');
    });

    activeToast = toast;
    if (type !== 'loading') {
      setTimeout(function () { dismiss(toast); }, TIMEOUT);
    }
    return toast;
  }

  function dismiss(toast) {
    var el = toast || activeToast;
    if (!el || !el.parentNode) return;
    el.classList.remove('xcard-toast--visible');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
    if (el === activeToast) activeToast = null;
  }

  return {
    info: function (msg) { return show(msg, 'info'); },
    success: function (msg) { return show(msg, 'success'); },
    error: function (msg) { return show(msg, 'error'); },
    loading: function (msg) { return show(msg, 'loading'); },
    dismiss: dismiss
  };
})();
