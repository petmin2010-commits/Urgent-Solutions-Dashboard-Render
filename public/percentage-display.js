(() => {
 'use strict';
 // Presentation-only. Source numbers, filters, sorts, and calculations remain unchanged.
 const IS_PERCENT = /(?:نسبة|التغطية|مئوية|percent(?:age)?|[%٪])/i;
 const NUMBER = /^[+-]?(?:[0-9٠-٩۰-۹]{1,3}(?:[,٬][0-9٠-٩۰-۹]{3})+|[0-9٠-٩۰-۹]+)(?:[.٫][0-9٠-٩۰-۹]+)?$/;
 const PREFIXED_PERCENT = /^[%٪]\s*[0-9٠-٩۰-۹]/;
 function valueWithoutUnit(raw) {
   const value = String(raw ?? '').replace(/[\u200e\u200f\u2066-\u2069]/g, '').trim();
   if (!value || /[%٪]/.test(value) || PREFIXED_PERCENT.test(value)) return null;
   return NUMBER.test(value) ? value : null;
 }
 function formatCell(cell) {
   if (!cell || cell.children.length > 0) return;
   const number = valueWithoutUnit(cell.textContent);
   if (number === null) return;
   const isolated = document.createElement('bdi');
   isolated.dir = 'ltr';
   isolated.textContent = number + '%';
   cell.replaceChildren(isolated);
 }
 function formatTable(table) {
   const header = table.querySelector('thead tr:last-child');
   if (!header) return;
   const cells = [...header.children];
   const indices = cells.flatMap((cell,index) => IS_PERCENT.test(cell.textContent) ? [index] : []);
   if (!indices.length) return;
   table.querySelectorAll('tbody tr').forEach(row => {
     indices.forEach(i => formatCell(row.children[i]));
   });
 }
 let pending = new Set();
 let scheduled = false;
 function flush() {
   scheduled = false;
   const tables = pending;
   pending = new Set();
   tables.forEach(table => { if (table.isConnected) formatTable(table); });
 }
 function queue(table) {
   if (!table) return;
   pending.add(table);
   if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
 }
 function start() {
   const host = document.getElementById('pageHost');
   if (!host) return;
   host.querySelectorAll('table').forEach(queue);
   new MutationObserver(changes => {
     for (const change of changes) {
       if (change.target.nodeType !== 1) continue;
       const insideTable = change.target.closest('table');
       if (insideTable) { queue(insideTable); continue; }
       for (const node of change.addedNodes) {
         if (node.nodeType !== 1) continue;
         if (node.matches('table')) queue(node);
         node.querySelectorAll?.('table').forEach(queue);
       }
     }
   }).observe(host, {subtree:true, childList:true});
 }
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
 else start();
 // Chart.js percentages: only series explicitly marked as percentages.
 if (window.Chart?.defaults?.plugins?.tooltip?.callbacks?.label) {
   const original = Chart.defaults.plugins.tooltip.callbacks.label;
   Chart.defaults.plugins.tooltip.callbacks.label = function(context) {
     if (!IS_PERCENT.test(String(context.dataset?.label || ''))) return original.call(this, context);
     const raw = String(context.formattedValue ?? '').trim();
     const shown = /[%٪]$/.test(raw) ? raw : raw + '%';
     return (context.dataset?.label ? context.dataset.label + ': ' : '') + shown;
   };
 }
})();
