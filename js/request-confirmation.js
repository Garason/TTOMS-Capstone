(() => {
  'use strict';
  const requestId = new URLSearchParams(window.location.search).get('id');
  document.getElementById('request-number').textContent = requestId || 'not available';
})();
