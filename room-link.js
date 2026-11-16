// A phone must receive a network URL, never a file path or the TV's loopback host.
(() => {
  const publishedBase = 'https://filigor123.github.io/TV-Quiz/';
  function build(hostId, pageUrl) {
    const current = new URL(pageUrl);
    const loopback = /^(localhost|127(?:\.\d+){3}|\[::1\])$/i.test(current.hostname) || current.hostname.endsWith('.localhost');
    const usable = ['http:', 'https:'].includes(current.protocol) && !loopback;
    const joinUrl = new URL('join.html', usable ? current.href : publishedBase);
    joinUrl.searchParams.set('host', hostId);
    joinUrl.hash = '';
    return joinUrl.href;
  }
  window.QuizRoomLink = Object.freeze({build});
})();
