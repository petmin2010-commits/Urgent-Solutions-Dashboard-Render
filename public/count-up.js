(() => {
  'use strict';

  const SELECTOR = [
    '.master-card strong',
    '.kpi-story-card strong',
    '.kpi strong',
    '.kpi b',
    '.kpi-mini b',
    '[class*="kpi-card"] strong',
    '[class*="metric-card"] strong',
    '[class*="stat-card"] strong',
    '[class*="summary-card"] strong',
    '[class*="counter-card"] strong',
    '[class*="card"] > strong'
  ].join(',');

  const active = new Map();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function asciiDigits(value) {
    return String(value)
      .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/٬/g, ',')
      .replace(/٫/g, '.');
  }  function parseValue(el) {
    const raw = String(el.textContent || '').trim();
    const match = raw.match(/^([^0-9٠-٩+\-]*)([-+]?[0-9٠-٩][0-9٠-٩,٬]*(?:[.٫][0-9٠-٩]+)?)([^0-9٠-٩]*)$/);
    if (!match) return null;

    const numeric = asciiDigits(match[2]).replace(/,/g, '');
    const value = Number(numeric);
    if (!Number.isFinite(value) || Math.abs(value) > 99999999) return null;

    const decimalPart = numeric.split('.')[1] || '';
    return {
      raw,
      value,
      prefix: match[1],
      suffix: match[3],
      decimals: decimalPart.length,
      arabic: /[٠-٩]/.test(match[2]),
      grouping: /[,٬]/.test(match[2])
    };
  }

  function formatNumber(meta, value) {
    const locale = meta.arabic ? 'ar-SA-u-nu-arab' : 'en-US';
    const formatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals,
      useGrouping: meta.grouping
    });
    return meta.prefix + formatter.format(value) + meta.suffix;
  }  function finish(el) {
    const state = active.get(el);
    if (!state) return;
    cancelAnimationFrame(state.raf);
    el.textContent = state.meta.raw;
    el.dataset.vdCountTarget = state.meta.raw;
    el.dataset.vdCounting = '0';
    el.classList.remove('vd-counting-number');
    el.classList.add('vd-count-finished');
    setTimeout(() => el.classList.remove('vd-count-finished'), 320);
    active.delete(el);
  }

  function animate(el) {
    if (!(el instanceof Element) || el.dataset.vdCounting === '1') return;
    const meta = parseValue(el);
    if (!meta || meta.value === 0 || el.dataset.vdCountTarget === meta.raw) return;

    if (reduceMotion) {
      el.dataset.vdCountTarget = meta.raw;
      return;
    }

    const duration = el.dataset.vdCountSeen ? 560 : Math.min(1050, 720 + Math.abs(meta.value) * 1.4);
    const start = performance.now();
    el.dataset.vdCounting = '1';
    el.dataset.vdCountSeen = '1';
    el.classList.add('vd-counting-number');

    const state = { meta, raf: 0, lastRendered: meta.raw };
    active.set(el, state);    const frame = now => {
      const progress = Math.max(0, Math.min(1, (now - start) / duration));
      const eased = 1 - Math.pow(1 - progress, 3);
      const rawCurrent = meta.decimals
        ? meta.value * eased
        : Math.round(meta.value * eased);
      const current = Math.abs(rawCurrent) < 1e-9 ? 0 : rawCurrent;
      const rendered = formatNumber(meta, current);

      state.lastRendered = rendered;
      el.textContent = rendered;

      if (progress < 1) {
        state.raf = requestAnimationFrame(frame);
      } else {
        finish(el);
      }
    };

    state.raf = requestAnimationFrame(frame);
  }

  function scan(root = document) {
    if (root instanceof Element && root.matches(SELECTOR)) animate(root);
    root.querySelectorAll?.(SELECTOR).forEach(animate);
  }

  let scanQueued = false;
  function queueScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
      scanQueued = false;
      scan(document);
    });
  }  const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.target instanceof Element && mutation.target.dataset.vdCounting === '1') {
        const state = active.get(mutation.target);
        const current = String(mutation.target.textContent || '').trim();
        if (state && current !== state.lastRendered && current !== state.meta.raw) {
          cancelAnimationFrame(state.raf);
          active.delete(mutation.target);
          mutation.target.dataset.vdCounting = '0';
          mutation.target.classList.remove('vd-counting-number');
          animate(mutation.target);
        }
        continue;
      }
      for (const node of mutation.addedNodes) {
        if (node instanceof Element) queueScan(node);
      }
      if (mutation.target instanceof Element && mutation.target.closest(SELECTOR)) {
        queueScan(mutation.target.closest(SELECTOR));
      }
    }
  });

  function installStyle() {
    if (document.getElementById('vdCountUpStyle')) return;
    const style = document.createElement('style');
    style.id = 'vdCountUpStyle';
    style.textContent =
      '.vd-counting-number{display:inline-block;font-variant-numeric:tabular-nums;will-change:contents,transform}' +
      '.vd-count-finished{display:inline-block;animation:vdCountPop .30s ease-out}' +
      '@keyframes vdCountPop{0%{transform:scale(.97);opacity:.84}60%{transform:scale(1.045);opacity:1}100%{transform:scale(1)}}' +
      '@media(prefers-reduced-motion:reduce){.vd-count-finished{animation:none}}';
    document.head.appendChild(style);
  }  function boot() {
    installStyle();
    scan(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  window.addEventListener('beforeprint', () => {
    [...active.keys()].forEach(finish);
  });

  window.VDCountUp = {
    refresh: () => scan(document),
    finishAll: () => [...active.keys()].forEach(finish)
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();