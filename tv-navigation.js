/* Five-way navigation for the host page, including LG webOS key codes. */
(() => {
  'use strict';
  const controls = 'button, select, input, textarea, a[href], [tabindex="0"]';
  const aliases = {Left:'ArrowLeft', Right:'ArrowRight', Up:'ArrowUp', Down:'ArrowDown', OK:'Enter', Select:'Enter', Return:'Back', BrowserBack:'Back', GoBack:'Back', Escape:'Back', Esc:'Back'};
  const codes = {37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',13:'Enter',23:'Enter',461:'Back',10009:'Back',27:'Back',8:'Back'};
  let lastCard = null;

  function visible(el) {
    return !!el && !el.disabled && el.getAttribute('aria-disabled') !== 'true' &&
      !el.closest('[hidden], [inert]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  }
  function scope() {
    if (visible(document.getElementById('setup'))) return document.querySelector('.catalog-step.active');
    return ['lobby','game','results'].map(id => document.getElementById(id)).find(visible);
  }
  function items() { const root = scope(); return root ? Array.from(root.querySelectorAll(controls)).filter(visible) : []; }
  function focus(el) {
    if (!visible(el)) return;
    el.focus({preventScroll:true});
    el.scrollIntoView({block:'nearest',inline:'nearest',behavior:'auto'});
    if (el.matches('.catalog-card')) lastCard = el;
  }
  function refresh() {
    const root = scope();
    if (!root || (root.contains(document.activeElement) && visible(document.activeElement) && document.activeElement.matches(controls))) return;
    focus(root.id === 'catalogHome' ? (visible(lastCard) ? lastCard : root.querySelector('.catalog-card:not(:disabled)')) : items()[0]);
  }
  function moveCatalog(current, key) {
    if (!current.matches('.catalog-card')) {
      if (key === 'ArrowDown') focus(visible(lastCard) ? lastCard : document.querySelector('.catalog-card:not(:disabled)'));
      return;
    }
    const row = current.closest('.shelf');
    const cards = Array.from(row.querySelectorAll('.catalog-card')).filter(visible);
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      focus(cards[cards.indexOf(current) + (key === 'ArrowRight' ? 1 : -1)]);
      return;
    }
    const rows = Array.from(document.querySelectorAll('.shelf')).filter(row => Array.from(row.querySelectorAll('.catalog-card')).some(visible));
    const nextRow = rows[rows.indexOf(row) + (key === 'ArrowDown' ? 1 : -1)];
    if (!nextRow) return;
    const rect = current.getBoundingClientRect(), center = rect.left + rect.width / 2;
    const next = Array.from(nextRow.querySelectorAll('.catalog-card')).filter(visible).sort((a,b) => {
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
      return Math.abs(ar.left + ar.width / 2 - center) - Math.abs(br.left + br.width / 2 - center);
    })[0];
    focus(next);
  }
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const key = aliases[event.key] || codes[event.keyCode] || event.key;
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Enter','Back'].includes(key)) return;
    const input = document.activeElement;
    const editing = input && (input.matches('textarea, input:not([type="checkbox"]):not([type="radio"]):not([type="button"])') || input.isContentEditable);
    if (editing && (event.key === 'Backspace' || key === 'ArrowLeft' || key === 'ArrowRight')) return;
    event.preventDefault();
    if ((key === 'Enter' || key === 'Back') && event.repeat) return;
    if (key === 'Back') { document.dispatchEvent(new CustomEvent('tv-back')); return; }
    refresh();
    const current = document.activeElement, list = items();
    if (!list.includes(current)) return;
    if (key === 'Enter') {
      if (current.tagName === 'SELECT') focus(list[list.indexOf(current) + 1]);
      else current.click();
      return;
    }
    if (scope().id === 'catalogHome') { moveCatalog(current, key); return; }
    if (current.tagName === 'SELECT' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      const step = key === 'ArrowRight' ? 1 : -1;
      let index = current.selectedIndex + step;
      while (current.options[index] && current.options[index].disabled) index += step;
      if (current.options[index]) { current.selectedIndex = index; current.dispatchEvent(new Event('change',{bubbles:true})); }
      return;
    }
    const step = key === 'ArrowDown' || key === 'ArrowRight' ? 1 : -1;
    focus(list[list.indexOf(current) + step]);
  });
  // Repair focus after asynchronous readiness, screen changes and disappearing controls.
  let scheduled = false;
  new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; refresh(); });
  }).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','disabled','style','class']});
  window.TVNavigation = {focus,refresh};
  refresh();
})();
