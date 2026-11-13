// Apply the saved (or system) theme before first paint so there's no flash.
// A separate file (not inline) so the Content-Security-Policy can forbid inline scripts.
(function () {
  var theme;
  try { theme = localStorage.getItem('theme'); } catch (e) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.setAttribute('data-theme', theme);
})();
