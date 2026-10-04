(()=>{'use strict';
function before(){const st=window.VDUrgent?.getState?.()||{},meta=window.VDUrgent?.PAGE_META?.[st.page]||{},name=window.VDReportNaming?.make(meta.title||st.page)||document.title;document.documentElement.dataset.printReport=name;document.body.classList.add('vd-printing')}
function after(){document.body.classList.remove('vd-printing')}
addEventListener('beforeprint',before);addEventListener('afterprint',after);window.VDReportExport={print:()=>window.VDUrgent?.printCurrent?.()};
})();