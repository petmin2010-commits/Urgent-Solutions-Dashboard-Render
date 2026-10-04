(()=>{'use strict';
if(!window.Chart||window.__VD_GLOBAL_VALUE_LABELS_TRANSPARENT__)return;
window.__VD_GLOBAL_VALUE_LABELS_TRANSPARENT__=true;

function n(raw,type){
  if(raw==null||raw==='')return null;
  if(typeof raw==='number')return Number.isFinite(raw)?raw:null;
  if(typeof raw==='string'){const v=Number(raw.replace(/,/g,''));return Number.isFinite(v)?v:null;}
  if(typeof raw==='object'){
    const v=type==='bubble'?Number(raw.r):Number(raw.y);
    return Number.isFinite(v)?v:null;
  }
  return null;
}
function fmt(v){
  return new Intl.NumberFormat('en-US',{maximumFractionDigits:1}).format(v);
}
function ownLabels(chart){
  const ps=chart?.config?.plugins;
  return Array.isArray(ps)&&ps.some(p=>p&&['stpValueLabels','reportPointLabels','workOrderTypeLabels','contractorValueCountLabels','monthlyViolationsLabels','vdGlobalValueLabels'].includes(p.id));
}
function intersects(a,b,pad=2){
  return !(a.right+pad<=b.left||a.left-pad>=b.right||a.bottom+pad<=b.top||a.top-pad>=b.bottom);
}
function inside(r,area){
  return r.left>=area.left+1&&r.right<=area.right-1&&r.top>=area.top+1&&r.bottom<=area.bottom-1;
}
function rectFor(ctx,text,cx,cy,fs){
  const w=Math.ceil(ctx.measureText(text).width)+4;
  const h=fs+4;
  return {left:cx-w/2,right:cx+w/2,top:cy-h/2,bottom:cy+h/2,cx,cy,w,h};
}
function candidates(cx,cy,step=10){
  return [
    [cx,cy],
    [cx,cy-step],
    [cx,cy+step],
    [cx-step,cy],
    [cx+step,cy],
    [cx-step,cy-step],
    [cx+step,cy-step],
    [cx-step,cy+step],
    [cx+step,cy+step],
    [cx,cy-step*2],
    [cx,cy+step*2],
    [cx-step*2,cy],
    [cx+step*2,cy]
  ];
}
function place(ctx,text,cx,cy,fs,area,occupied,opts={}){
  ctx.save();
  ctx.font=(opts.weight||'800')+' '+fs+'px Cairo, Tahoma, Arial, sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';

  let chosen=null;
  const step=Math.max(fs+3,Number(opts.step||0));
  const list=opts.candidates||candidates(cx,cy,step);

  for(const [x,y] of list){
    const r=rectFor(ctx,text,x,y,fs);
    if(!inside(r,area))continue;
    if(occupied.some(o=>intersects(r,o,opts.pad??2)))continue;
    chosen=r;break;
  }

  if(!chosen&&opts.allowEdge){
    const raw=rectFor(ctx,text,cx,cy,fs);
    const x=Math.max(area.left+raw.w/2+1,Math.min(cx,area.right-raw.w/2-1));
    const y=Math.max(area.top+raw.h/2+1,Math.min(cy,area.bottom-raw.h/2-1));
    const r=rectFor(ctx,text,x,y,fs);
    if(!occupied.some(o=>intersects(r,o,opts.pad??2)))chosen=r;
  }

  if(!chosen){ctx.restore();return false;}

  occupied.push(chosen);

  const fill=opts.color||'#172b5f';
  ctx.lineJoin='round';
  ctx.lineWidth=Math.max(2,fs*.26);
  ctx.strokeStyle='rgba(255,255,255,.82)';
  ctx.strokeText(text,chosen.cx,chosen.cy+.2);
  ctx.fillStyle=fill;
  ctx.fillText(text,chosen.cx,chosen.cy+.2);
  ctx.restore();
  return true;
}
const plugin={
  id:'vdGlobalValueLabels',
  afterDatasetsDraw(chart,args,opts){
    if(opts===false||opts?.display===false||ownLabels(chart))return;
    const ctx=chart.ctx,area=chart.chartArea;
    if(!ctx||!area)return;

    const fs=chart.width<300?8:chart.width<520?9:10;
    const occupied=[];
    const totals=new Map();

    chart.data.datasets.forEach((ds,di)=>{
      const meta=chart.getDatasetMeta(di);
      if(!meta||meta.hidden)return;

      const type=meta.type||chart.config.type||'bar';
      const horizontal=chart.options?.indexAxis==='y';
      const stacked=!!(meta.vScale?.options?.stacked||meta.iScale?.options?.stacked);

      meta.data.forEach((el,pi)=>{
        if(!el||el.hidden)return;
        const value=n(ds.data?.[pi],type);
        if(value==null)return;

        const text=fmt(value);

        if(type==='doughnut'||type==='pie'||type==='polarArea'){
          if(value===0)return;
          const p=el.getProps?el.getProps(['x','y','startAngle','endAngle','innerRadius','outerRadius'],true):el;
          const angle=(Number(p.startAngle||0)+Number(p.endAngle||0))/2;
          const inner=Number(p.innerRadius||0),outer=Number(p.outerRadius||0);
          const span=Math.max(0,Number(p.endAngle||0)-Number(p.startAngle||0));
          const baseR=span<0.34?outer-6:(inner+outer)/2;
          const cx=Number(p.x||0)+Math.cos(angle)*baseR;
          const cy=Number(p.y||0)+Math.sin(angle)*baseR;
          const radial=[];
          for(const delta of [0,9,-9,18,-18]){
            const r=Math.max(inner+7,Math.min(outer-5,baseR+delta));
            radial.push([
              Number(p.x||0)+Math.cos(angle)*r,
              Number(p.y||0)+Math.sin(angle)*r
            ]);
          }
          place(ctx,text,cx,cy,fs,area,occupied,{candidates:radial,pad:3,allowEdge:false});
          return;
        }

        const pos=el.tooltipPosition?el.tooltipPosition():{x:el.x,y:el.y};

        if(type==='line'||type==='scatter'||type==='bubble'){
          if(value===0&&meta.data.length>7)return;
          const x=Number(pos.x||0),y=Number(pos.y||0);
          place(ctx,text,x,y-(fs+6),fs,area,occupied,{
            candidates:[
              [x,y-(fs+6)],[x,y+(fs+6)],
              [x+fs+10,y-(fs+4)],[x-fs-10,y-(fs+4)],
              [x+fs+10,y+(fs+4)],[x-fs-10,y+(fs+4)]
            ],
            pad:3
          });
          return;
        }

        if(type==='bar'){
          const p=el.getProps?el.getProps(['x','y','base','width','height'],true):el;
          if(stacked){
            const x=horizontal?(Number(p.x||0)+Number(p.base||0))/2:Number(p.x||0);
            const y=horizontal?Number(p.y||0):(Number(p.y||0)+Number(p.base||0))/2;
            const segmentSize=horizontal?Math.abs(Number(p.x||0)-Number(p.base||0)):Math.abs(Number(p.y||0)-Number(p.base||0));

            if(value!==0&&segmentSize>=fs+5){
              place(ctx,text,x,y,fs,area,occupied,{pad:2});
            }
            totals.set(pi,(totals.get(pi)||0)+value);
          }else if(horizontal){
            if(value===0)return;
            const dir=Number(p.x||0)>=Number(p.base||0)?1:-1;
            const x=Number(p.x||0)+dir*(fs+8),y=Number(p.y||0);
            place(ctx,text,x,y,fs,area,occupied,{
              candidates:[
                [x,y],[Number(p.x||0)-dir*(fs+6),y],
                [x,y-fs-3],[x,y+fs+3]
              ],
              pad:2,allowEdge:true
            });
          }else{
            if(value===0)return;
            const dir=Number(p.y||0)<=Number(p.base||0)?-1:1;
            const x=Number(p.x||0),y=Number(p.y||0)+dir*(fs+8);
            place(ctx,text,x,y,fs,area,occupied,{
              candidates:[
                [x,y],[x,Number(p.y||0)-dir*(fs+5)],
                [x-fs-7,y],[x+fs+7,y]
              ],
              pad:2,allowEdge:true
            });
          }
          return;
        }

        if(value===0)return;
        place(ctx,text,Number(pos.x||0),Number(pos.y||0)-(fs+7),fs,area,occupied,{pad:2});
      });
    });

    if(totals.size){
      const visible=chart.data.datasets.map((_,i)=>chart.getDatasetMeta(i)).filter(m=>m&&!m.hidden);
      totals.forEach((total,pi)=>{
        if(total===0)return;
        const els=visible.map(m=>m.data?.[pi]).filter(Boolean);
        if(!els.length)return;

        const horizontal=chart.options?.indexAxis==='y';
        if(horizontal){
          const far=els.reduce((a,b)=>Number(b.x||0)>Number(a.x||0)?b:a,els[0]);
          const x=Number(far.x||0)+20,y=Number(far.y||0);
          place(ctx,'Σ '+fmt(total),x,y,fs,area,occupied,{
            candidates:[[x,y],[Number(far.x||0)-20,y],[x,y-fs-3],[x,y+fs+3]],
            pad:4,allowEdge:true,color:'#172b5f'
          });
        }else{
          const top=els.reduce((a,b)=>Number(b.y||1e9)<Number(a.y||1e9)?b:a,els[0]);
          const x=Number(top.x||0),y=Number(top.y||0)-18;
          place(ctx,'Σ '+fmt(total),x,y,fs,area,occupied,{
            candidates:[[x,y],[x,Number(top.y||0)+18],[x-fs-10,y],[x+fs+10,y]],
            pad:4,allowEdge:true,color:'#172b5f'
          });
        }
      });
    }
  }
};

Chart.register(plugin);
Chart.defaults.color='#000';
Chart.defaults.font.family='Cairo, Tahoma, Arial, sans-serif';
Chart.defaults.plugins.vdGlobalValueLabels={display:true};
window.VDGlobalValueLabels=plugin;
})();