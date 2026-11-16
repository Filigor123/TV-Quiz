// PeerJS accepts a caller-supplied ID. Avoid its separate HTTP ID allocation
// request: the signalling WebSocket will register this random ID directly.
(() => {
  'use strict';
  function create() {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return 'tvq-' + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }
  window.QuizPeerId = Object.freeze({create});
})();
