(()=>{
'use strict';

const uploads=[];
let active=null;
const clean=v=>String(v==null?'':v).replace(/\s+/g,' ').trim();
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const direct=(el,name)=>[...(el?.children||[])].find(x=>x.localName===name)||null;
const directAll=(el,name)=>[...(el?.children||[])].filter(x=>x.localName===name);
const descendants=(el,name)=>[...(el?.getElementsByTagNameNS?.('*',name)||[])];
const childText=(el,name)=>clean(direct(el,name)?.textContent||'');
const descText=(el,name)=>clean(descendants(el,name)[0]?.textContent||'');
const uid=()=>('kmz-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8));

function parseCoords(text){
 return clean(text).split(/\s+/).map(x=>x.split(',').map(Number)).filter(a=>Number.isFinite(a[0])&&Number.isFinite(a[1])).map(a=>[a[0],a[1],Number.isFinite(a[2])?a[2]:null]);
}
function kmlColor(raw,fallback){
 const s=clean(raw).replace('#','');
 if(!/^[0-9a-f]{8}$/i.test(s))return {color:fallback,opacity:1};
 const a=parseInt(s.slice(0,2),16)/255,b=s.slice(2,4),g=s.slice(4,6),r=s.slice(6,8);
 return {color:'#'+r+g+b,opacity:Math.max(0,Math.min(1,a))};
}
function parseStyle(el){
 if(!el)return {};
 const line=direct(el,'LineStyle'),poly=direct(el,'PolyStyle'),icon=direct(el,'IconStyle'),out={};
 if(line){
  const lc=kmlColor(childText(line,'color'),'#1677b8'),width=Number(childText(line,'width'));
  out.color=lc.color;out.opacity=lc.opacity;out.weight=Number.isFinite(width)&&width>0?width:3;
 }
 if(poly){
  const pc=kmlColor(childText(poly,'color'),'#48a8c8');
  out.fillColor=pc.color;out.fillOpacity=pc.opacity*(childText(poly,'fill')==='0'?0:1);out.outline=childText(poly,'outline')!=='0';
 }
 if(icon){
  const ic=kmlColor(childText(icon,'color'),out.color||'#1677b8'),scale=Number(childText(icon,'scale'));
  out.iconColor=ic.color;out.iconOpacity=ic.opacity;out.iconScale=Number.isFinite(scale)&&scale>0?scale:1;
 }
 return out;
}
function geometryFrom(el){
 if(!el)return null;
 const name=el.localName;
 if(name==='Point'){
  const c=parseCoords(descText(el,'coordinates'));return c.length?{type:'Point',coordinates:c[0]}:null;
 }
 if(name==='LineString'||name==='LinearRing'){
  const c=parseCoords(descText(el,'coordinates'));return c.length>1?{type:'LineString',coordinates:c}:null;
 }
 if(name==='Track'){
  const c=descendants(el,'coord').map(x=>clean(x.textContent).split(/\s+/).map(Number)).filter(a=>Number.isFinite(a[0])&&Number.isFinite(a[1])).map(a=>[a[0],a[1],Number.isFinite(a[2])?a[2]:null]);
  return c.length>1?{type:'LineString',coordinates:c}:null;
 }
 if(name==='Polygon'){
  const outer=descendants(el,'outerBoundaryIs')[0],outerRing=outer?descendants(outer,'LinearRing')[0]:null;
  const out=outerRing?parseCoords(descText(outerRing,'coordinates')):[];
  if(out.length<3)return null;
  const holes=descendants(el,'innerBoundaryIs').map(x=>descendants(x,'LinearRing')[0]).filter(Boolean).map(x=>parseCoords(descText(x,'coordinates'))).filter(x=>x.length>=3);
  return {type:'Polygon',coordinates:[out,...holes]};
 }
 if(name==='MultiGeometry'){
  const parts=[...el.children].map(geometryFrom).filter(Boolean);
  return parts.length?{type:'GeometryCollection',geometries:parts}:null;
 }
 return null;
}
function extendedData(pm){
 const out={};
 descendants(pm,'Data').forEach(x=>{const k=clean(x.getAttribute('name')),v=descText(x,'value');if(k&&v)out[k]=v});
 descendants(pm,'SimpleData').forEach(x=>{const k=clean(x.getAttribute('name')),v=clean(x.textContent);if(k&&v)out[k]=v});
 return out;
}
function parseKml(text,fileName){
 if(text.length>20*1024*1024)throw new Error('ملف KML بعد فك الضغط أكبر من 20MB');
 const doc=new DOMParser().parseFromString(text,'text/xml');
 if(doc.getElementsByTagName('parsererror').length)throw new Error('ملف KML غير صالح أو تالف');
 const styleById=new Map();
 descendants(doc,'Style').forEach(s=>{const id=clean(s.getAttribute('id'));if(id)styleById.set('#'+id,parseStyle(s))});
 const styleMap=new Map();
 descendants(doc,'StyleMap').forEach(sm=>{
  const id=clean(sm.getAttribute('id'));if(!id)return;
  const normal=descendants(sm,'Pair').find(p=>childText(p,'key')==='normal')||descendants(sm,'Pair')[0];
  const url=childText(normal,'styleUrl');if(url)styleMap.set('#'+id,url);
 });
 const resolveStyle=pm=>{
  let url=childText(pm,'styleUrl');if(styleMap.has(url))url=styleMap.get(url);
  const base=styleById.get(url)||{};
  const inline=direct(pm,'Style');
  return {...base,...parseStyle(inline)};
 };
 const features=[];
 descendants(doc,'Placemark').forEach((pm,i)=>{
  const geoms=[...pm.children].filter(x=>['Point','LineString','Polygon','MultiGeometry','Track'].includes(x.localName)).map(geometryFrom).filter(Boolean);
  if(!geoms.length)return;
  const geometry=geoms.length===1?geoms[0]:{type:'GeometryCollection',geometries:geoms};
  features.push({
   id:i+1,name:childText(pm,'name')||('عنصر '+(i+1)),description:childText(pm,'description'),
   properties:extendedData(pm),style:resolveStyle(pm),geometry
  });
 });
 return {id:uid(),name:fileName.replace(/\.(kmz|kml)$/i,''),fileName,features,visible:true,addedAt:Date.now()};
}
async function readUpload(file){
 const lower=file.name.toLowerCase();
 if(file.size>50*1024*1024)throw new Error('الحد الأقصى للملف 50MB');
 if(lower.endsWith('.kml'))return parseKml(await file.text(),file.name);
 if(!lower.endsWith('.kmz'))throw new Error('الامتداد المطلوب KMZ أو KML');
 if(!window.JSZip)throw new Error('تعذر تحميل محرك فك ملفات KMZ');
 const zip=await window.JSZip.loadAsync(file);
 const names=Object.keys(zip.files).filter(n=>/\.kml$/i.test(n)&&!zip.files[n].dir);
 if(!names.length)throw new Error('لا يوجد ملف KML داخل KMZ');
 const name=names.find(n=>/(^|\/)doc\.kml$/i.test(n))||names[0];
 return parseKml(await zip.file(name).async('string'),file.name);
}
function featurePopup(feature,upload){
 const props=Object.entries(feature.properties||{}).filter(([,v])=>clean(v)).slice(0,14);
 const rows=props.map(([k,v])=>'<div><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>').join('');
 return '<div class="map-popup-card kmz-popup"><div class="map-card-head"><span class="map-kind kmz">KMZ</span><b>'+esc(feature.name)+'</b></div><div class="map-card-grid"><div><span>الطبقة</span><b>'+esc(upload.name)+'</b></div>'+rows+'</div>'+(feature.description?'<div class="kmz-description">'+esc(feature.description)+'</div>':'')+'</div>';
}
function leafletGeometry(L,feature,upload){
 const s=feature.style||{};
 const line={color:s.color||'#1677b8',weight:s.weight||3,opacity:s.opacity==null ? .92 : s.opacity};
 const poly={...line,fillColor:s.fillColor||'#48a8c8',fillOpacity:s.fillOpacity==null ? .2 : s.fillOpacity};
 const point={radius:Math.max(5,Math.min(12,6*(s.iconScale||1))),color:'#fff',weight:2,fillColor:s.iconColor||s.color||'#7b61a8',fillOpacity:s.iconOpacity==null ? .95 : s.iconOpacity};
 const popup=featurePopup(feature,upload);
 const bind=layer=>{if(!layer)return layer;if(layer.bindTooltip)layer.bindTooltip(esc(feature.name),{direction:'top',sticky:true,opacity:.96,className:'vd-map-tooltip'});if(layer.bindPopup)layer.bindPopup(popup,{maxWidth:430,className:'vd-map-popup'});return layer};
 const build=g=>{
  if(!g)return null;
  if(g.type==='Point')return bind(L.circleMarker([g.coordinates[1],g.coordinates[0]],point));
  if(g.type==='LineString')return bind(L.polyline(g.coordinates.map(c=>[c[1],c[0]]),line));
  if(g.type==='Polygon')return bind(L.polygon(g.coordinates.map(r=>r.map(c=>[c[1],c[0]])),poly));
  if(g.type==='GeometryCollection'){const items=(g.geometries||[]).map(build).filter(Boolean);return items.length?L.layerGroup(items):null}
  return null;
 };
 return build(feature.geometry);
}
function buildLayer(map,upload){
 const L=window.L,group=L.layerGroup();
 upload.features.forEach(f=>{const layer=leafletGeometry(L,f,upload);if(layer)group.addLayer(layer)});
 return group;
}
function layerBounds(layer){
 try{
  if(layer?.getBounds){const b=layer.getBounds();if(b?.isValid?.())return b}
  const b=window.L.latLngBounds([]);
  layer?.eachLayer?.(x=>{
   if(x.getBounds){const xb=x.getBounds();if(xb?.isValid?.())b.extend(xb)}
   else if(x.getLatLng)b.extend(x.getLatLng());
  });
  return b.isValid()?b:null;
 }catch{return null}
}
function init(options={}){
 const map=options.map,input=options.input,button=options.button,host=options.host,stage=options.stage,search=options.search;
 if(!map||!window.L||!input||!button||!host)return null;
 const layers=new Map();
 let searchQuery='';
 active={map,layers};
 const say=msg=>typeof options.toast==='function'?options.toast(msg):void 0;
 const summary=()=>typeof options.onSummary==='function'&&options.onSummary(uploads.filter(x=>x.visible).length,uploads.length);
 const sourceIds=new Set();
 (options.sources||[]).forEach(s=>{
  const id=clean(s.id)||('sheet-kmz-'+s.row);if(!id)return;sourceIds.add(id);
  let u=uploads.find(x=>x.id===id);
  if(!u){
   u={id,name:clean(s.name)||('KMZ - صف '+s.row),fileName:'',features:[],visible:false,loaded:false,loading:false,sourceKind:'sheet',sourceUrl:s.sourceUrl,originalUrl:s.originalUrl||'',sourceRow:s.row};
   uploads.push(u);
  }else if(u.sourceKind==='sheet'){
   if(u.originalUrl&&s.originalUrl&&u.originalUrl!==s.originalUrl){u.features=[];u.loaded=false;u.visible=false}
   u.name=clean(s.name)||u.name;u.sourceUrl=s.sourceUrl;u.originalUrl=s.originalUrl||u.originalUrl;u.sourceRow=s.row;
  }
 });
 for(let i=uploads.length-1;i>=0;i--)if(uploads[i].sourceKind==='sheet'&&!sourceIds.has(uploads[i].id))uploads.splice(i,1);
 const statusText=u=>u.loading?'جاري تحميل KMZ…':u.sourceKind==='sheet'?(u.loaded?(u.features.length+' عنصر • من AL'):'جاهز من العمود AL • اختر لإضافته'):(u.features.length+' عنصر • ملف مرفوع');
 const rowHtml=u=>'<div class="map-kmz-row '+(u.sourceKind==='sheet'?'sheet-source':'')+'" data-kmz-row="'+esc(u.id)+'"><label class="map-kmz-check" title="إظهار/إخفاء الطبقة"><input type="checkbox" data-kmz-action="toggle" '+(u.visible?'checked':'')+'><span></span></label><div class="map-kmz-name"><b>'+esc(u.name)+'</b><span>'+esc(statusText(u))+'</span></div><div class="map-kmz-actions"><button type="button" data-kmz-action="zoom" title="تحميل/تكبير إلى حدود الطبقة">⌖</button><button type="button" data-kmz-action="remove" title="'+(u.sourceKind==='sheet'?'إزالة الرسم مع إبقاء رابط AL متاحًا':'حذف الطبقة')+'">×</button></div></div>';
 const render=()=>{
  layers.forEach(layer=>{try{if(map.hasLayer(layer))map.removeLayer(layer)}catch{}});
  layers.clear();
  uploads.forEach(u=>{
   if(u.loaded===false&&!u.features?.length)return;
   const layer=buildLayer(map,u);layers.set(u.id,layer);if(u.visible)layer.addTo(map);
  });
  const visibleRows=searchQuery?uploads.filter(u=>clean([u.name,u.fileName,u.sourceKind==='sheet'?'AL':'ملف'].join(' ')).toLowerCase().includes(searchQuery)):uploads;
  host.innerHTML=visibleRows.length?visibleRows.map(rowHtml).join(''):(uploads.length?'<div class="map-kmz-empty">لا توجد طبقات مطابقة للبحث</div>':'');
  host.classList.toggle('show',uploads.length>0);
  summary();
 };
 const fitUpload=u=>{const layer=layers.get(u.id),b=layerBounds(layer);if(b)map.fitBounds(b,{padding:[42,42],maxZoom:17})};
 const loadRemote=async u=>{
  if(u.loaded)return true;
  u.loading=true;render();
  try{
   const response=await fetch(u.sourceUrl,{credentials:'same-origin',cache:'no-store'});
   if(!response.ok){
    let msg='تعذر تحميل طبقة KMZ';
    try{const j=await response.json();if(j?.message)msg=j.message}catch{}
    throw new Error(msg);
   }
   const type=(response.headers.get('x-kmz-type')||'kmz').toLowerCase()==='kml'?'kml':'kmz';
   const blob=await response.blob();
   const parsed=await readUpload(new File([blob],u.name+'.'+type,{type:blob.type||''}));
   if(!parsed.features.length)throw new Error('لا توجد عناصر قابلة للرسم داخل الملف');
   u.features=parsed.features;u.fileName=parsed.fileName;u.loaded=true;u.visible=true;u.loading=false;
   render();fitUpload(u);say('تمت إضافة طبقة '+u.name+' من العمود AL');return true;
  }catch(e){
   u.loading=false;u.visible=false;render();say(u.name+': '+(e?.message||'تعذر تحميل KMZ'));return false;
  }
 };
 const loadFiles=async files=>{
  const list=[...files].filter(Boolean);if(!list.length)return;
  button.classList.add('loading');button.disabled=true;
  let added=0,last=null;
  for(const file of list){
   try{
    const u=await readUpload(file);
    if(!u.features.length){say('لا توجد عناصر قابلة للرسم في '+file.name);continue}
    u.sourceKind='upload';u.loaded=true;uploads.push(u);added++;last=u;
   }catch(e){say(file.name+': '+(e?.message||'تعذر قراءة الملف'))}
  }
  render();
  button.classList.remove('loading');button.disabled=false;input.value='';
  if(added){say('تمت إضافة '+added+' طبقة جغرافية');if(last)fitUpload(last)}
 };
 button.addEventListener('click',()=>input.click());
 input.addEventListener('change',()=>loadFiles(input.files));
 if(search)search.addEventListener('input',()=>{searchQuery=clean(search.value).toLowerCase();render()});
 host.addEventListener('click',async e=>{
  const action=e.target.closest('[data-kmz-action]');if(!action)return;
  const row=action.closest('[data-kmz-row]'),u=uploads.find(x=>x.id===row?.dataset.kmzRow);if(!u)return;
  const kind=action.dataset.kmzAction;
  if(kind==='toggle'){
   const checked=!!action.checked;
   if(checked&&u.sourceKind==='sheet'&&!u.loaded){await loadRemote(u);return}
   u.visible=checked;render();return;
  }
  if(kind==='zoom'){
   if(u.sourceKind==='sheet'&&!u.loaded){await loadRemote(u);return}
   if(!u.visible){u.visible=true;render()}fitUpload(u);return;
  }
  if(kind==='remove'){
   if(u.sourceKind==='sheet'){
    u.visible=false;u.loaded=false;u.loading=false;u.features=[];render();say('تمت إزالة الرسم، ورابط AL ما زال متاحًا');
   }else{
    const i=uploads.findIndex(x=>x.id===u.id);if(i>=0)uploads.splice(i,1);
    render();say('تم حذف طبقة '+u.name);
   }
  }
 });
 if(stage){
  stage.addEventListener('dragover',e=>{e.preventDefault();stage.classList.add('kmz-drop-active')});
  stage.addEventListener('dragleave',e=>{if(e.target===stage||!stage.contains(e.relatedTarget))stage.classList.remove('kmz-drop-active')});
  stage.addEventListener('drop',e=>{
   e.preventDefault();stage.classList.remove('kmz-drop-active');
   loadFiles([...e.dataTransfer.files].filter(f=>/\.(kmz|kml)$/i.test(f.name)));
  });
 }
 render();
 return {
  extendBounds(target){
   uploads.filter(x=>x.visible).forEach(u=>{const b=layerBounds(layers.get(u.id));if(b)target.extend(b)});
   return target;
  },
  fitAll(){
   const b=window.L.latLngBounds([]);this.extendBounds(b);
   if(b.isValid())map.fitBounds(b,{padding:[42,42],maxZoom:16});
  },
  visibleCount:()=>uploads.filter(x=>x.visible).length,
  totalCount:()=>uploads.length
 };
}
window.VDKMZ={init,uploads};
})();