window.XCard = window.XCard || {};

XCard.Theme = (function () {
  'use strict';

  var THEMES = {
    light: {
      name: 'light',
      cardBg: '#ffffff',
      cardBorder: '#e0e4e8',
      textPrimary: '#0f1419',
      textSecondary: '#536471',
      textTertiary: '#536471',
      boldText: '#2c3640',
      divider: '#e0e4e8',
      accentBlue: '#1d9bf0',
      pageBg: '#e8ecef'
    },
    dim: {
      name: 'dim',
      cardBg: '#15202b',
      cardBorder: '#38444d',
      textPrimary: '#e7e9ea',
      textSecondary: '#8b98a5',
      textTertiary: '#8b98a5',
      boldText: '#c8cdd2',
      divider: '#38444d',
      accentBlue: '#1d9bf0',
      pageBg: '#0d1117'
    },
    dark: {
      name: 'dark',
      cardBg: '#16181c',
      cardBorder: '#2f3336',
      textPrimary: '#e7e9ea',
      textSecondary: '#71767b',
      textTertiary: '#71767b',
      boldText: '#c8cdd2',
      divider: '#2f3336',
      accentBlue: '#1d9bf0',
      pageBg: '#000000'
    }
  };

  function detect() {
    var bg = getComputedStyle(document.body).backgroundColor;
    var rgb = bg.match(/\d+/g);
    if (!rgb) return THEMES.dark;

    var r = parseInt(rgb[0], 10);
    var g = parseInt(rgb[1], 10);
    var b = parseInt(rgb[2], 10);
    var luminance = (0.299 * r + 0.587 * g + 0.114 * b);

    if (luminance > 200) return THEMES.light;
    if (luminance > 30) return THEMES.dim;
    return THEMES.dark;
  }

  return {
    THEMES: THEMES,
    detect: detect
  };
})();
