/* DUCEET v16.6 — rastreador jurídico por ramas + archivo histórico + convocatorias + persistencia cliente
 * Node.js 18+. Ejecuta: node duceet-tracker-server-v16.js
 * http://localhost:8787/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const PORT = process.env.PORT || 8787;
const ROOT = __dirname;
// En Render: adjunta un Persistent Disk (mount path /var/data) y define DUCEET_DATA_DIR=/var/data.
// En local, los datos permanecen en la carpeta del proyecto.
const DATA_DIR = path.resolve(process.env.DUCEET_DATA_DIR || process.env.RENDER_DISK_PATH || ROOT);
fs.mkdirSync(DATA_DIR, { recursive: true });
const HTML = path.join(ROOT, 'Duceet_juridico_Peru_internacional_v16.html');
const DATA = path.join(DATA_DIR, 'duceet-tracker-data-v13.json');
const OLD_DATA = path.join(DATA_DIR, 'duceet-tracker-data-v10.json');
const OLD_DATA9 = path.join(DATA_DIR, 'duceet-tracker-data-v9.json');
const SUMMARIES = path.join(DATA_DIR, 'duceet-shared-summaries-v11_2.json');
const MODEL_ALERTS = path.join(DATA_DIR, 'duceet-model-alerts-v13.json');
const INTERVAL = 3 * 60 * 60 * 1000;
const VERSION = '16.6.0';
const UA = 'DUCEET-Juridico-Tracker/4.0';

const OFFICIAL = {
  pjJuris:'https://scc.pj.gob.pe/wps/wcm/connect/cij-juris/s_jurisprudencia_sistematizada/as_suprema/as_servicios/',
  pjVinc:'https://scc.pj.gob.pe/wps/wcm/connect/cij-juris/s_jurisprudencia_sistematizada/as_suprema/as_servicios/as_jurisprudencia_vinculante/',
  pjImportant:'https://www.pj.gob.pe/wps/wcm/connect/cortesuprema/s_cortes_suprema_home/as_poder_judicial/as_corte_suprema/as_salas_supremas/as_sentencias_importantes',
  pjCivil:'https://scc.pj.gob.pe/wps/wcm/connect/CorteSuprema/s_cortes_suprema_home/as_poder_judicial/as_corte_suprema/as_salas_supremas/as_sala_civil_permanente/as_sentencias_importantes',
  pjLaboral:'https://www.pj.gob.pe/wps/wcm/connect/cortesuprema/s_cortes_suprema_home/as_poder_judicial/as_corte_suprema/as_salas_supremas/as_sala_constitucional_permanente/as_sentencias_importantes_nueva_ley_procesal_trabajo',
  pjObservatorio:'https://www.pj.gob.pe/wps/wcm/connect/ObservatorioPJ/s_ojpj/as_resoluciones/as_con_adm/',
  tc:'https://www.tc.gob.pe/jurisprudencia/',
  talento:'https://talentoperu.servir.gob.pe/'
};

function readText(file){ try{return fs.readFileSync(file,'utf8')}catch{return ''} }
function readJson(file,fallback){try{const x=JSON.parse(readText(file)||'null');return x==null?fallback:x}catch{return fallback}}
function writeJson(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,JSON.stringify(obj,null,2),'utf8')}
function cleanText(x,max){return String(x??'').replace(/\u0000/g,'').trim().slice(0,max)}
function validBranch(b){return branches.some(x=>x.key===b)}
function loadBranches(){
  const s=readText(HTML); const out=[];
  // Extrae las ramas del objeto de ramas del HTML actual.
  // No depende de un nombre concreto del objeto; busca el patrón real
  // key:{label:'...', ... q:'...'} usado por DUCEET.
  const re=/\b([a-z0-9_]+):\{[^}]*?label:'([^']+)'[^}]*?q:'([^']+)'[^}]*?\}/g;
  let m;
  while((m=re.exec(s))) out.push({key:m[1],label:m[2],q:m[3]});
  const seen=new Set();
  return out.filter(b=>!seen.has(b.key)&&seen.add(b.key));
}
const branches=loadBranches();
function loadModelRules(){
  const html=readText(HTML); const out={};
  const m=html.match(/const MODEL_RULES\s*=\s*(\{[\s\S]*?\});/);
  if(m){ try { return Function('return '+m[1])(); } catch {} }
  return out;
}
const MODEL_RULES=loadModelRules();
const GROUP_OF=(()=>{try{const m=readText(HTML).match(/const GROUPS\s*=\s*(\{[^\n]*\});/);const g=JSON.parse(m[1]),o={};for(const [k,v] of Object.entries(g))for(const b of v.branches)o[b]=k;return o}catch{return {}}})();
const GENERIC_BRANCH_NORMS={
  constitucional:['Constitución Política del Perú','Código Procesal Constitucional'], administrativo:['TUO de la Ley 27444','reglamentos y normas sectoriales'], civil:['Código Civil','Código Procesal Civil'], penal:['Código Penal','Código Procesal Penal'], procesal:['Código Procesal Civil','Código Procesal Penal','normas procesales especiales'], laboral:['legislación laboral vigente','Nueva Ley Procesal del Trabajo'], seguridad_social:['normativa previsional vigente','seguridad social'], tributario:['Código Tributario','legislación tributaria vigente'], financiero:['Ley General del Sistema Financiero','normativa del mercado de valores'], bancario:['Ley General del Sistema Financiero','normativa SBS'], comercial:['Código de Comercio y legislación mercantil vigente','Ley de Títulos Valores'], societario:['Ley General de Sociedades'], corporativo:['Ley General de Sociedades','normativa empresarial aplicable'], informatico:['Ley de Protección de Datos Personales','legislación sobre delitos informáticos'], proteccion_datos:['Ley de Protección de Datos Personales'], medico:['normativa sanitaria vigente','regulación de responsabilidad profesional'], sanitario:['normativa sanitaria vigente'], ambiental:['Ley General del Ambiente','normativa ambiental sectorial'], minero:['Ley General de Minería','normativa minera sectorial'], energetico:['normativa energética sectorial'], familia:['Código Civil','Código de los Niños y Adolescentes cuando corresponda'], sucesiones:['Código Civil','normativa sucesoria vigente'], registral:['Reglamento General de los Registros Públicos','normativa registral especial'], notarial:['Decreto Legislativo del Notariado','reglamento notarial'], consumidor:['Código de Protección y Defensa del Consumidor'], competencia:['Decreto Legislativo 1034','normativa de libre competencia'], propiedad_intelectual:['Decisión 486','normativa de propiedad intelectual aplicable'], arbitraje:['Decreto Legislativo 1071','reglamentos arbitrales aplicables'], concursal:['Ley General del Sistema Concursal'], electoral:['normativa electoral vigente'], municipal:['Ley Orgánica de Municipalidades','normativa municipal'], agrario:['normativa agraria vigente'], pesquero:['Ley General de Pesca','normativa pesquera'], aeronautico:['Ley de Aeronáutica Civil','regulación aeronáutica'], maritimo:['normativa marítima vigente'], internacional_publico:['tratados internacionales vigentes','normas de derecho internacional'], internacional_privado:['Código Civil','normas de derecho internacional privado'], derechos_humanos:['Constitución Política del Perú','tratados de derechos humanos'], humanitario:['Convenios de Ginebra','normas de derecho internacional humanitario'], teoria:['normativa y jurisprudencia pertinente'], investigacion:['normativa universitaria y de investigación aplicable'], criminologia:['Código Penal','política criminal vigente'], penitenciario:['Código de Ejecución Penal'], deportivo:['normativa deportiva vigente'], urbanistico:['normativa urbanística y de edificaciones'], recursos_naturales:['Ley Orgánica para el Aprovechamiento Sostenible de los Recursos Naturales'], comercio_internacional:['normativa de comercio exterior y tratados vigentes'], aduanero:['Ley General de Aduanas','reglamento aduanero'], telecomunicaciones:['Ley de Telecomunicaciones','regulación sectorial'], farmaceutico:['normativa farmacéutica vigente'], agrario:['normativa agraria vigente']
};
function modelCatalogForBranch(branch){
  const specific=Object.entries(MODEL_RULES).filter(([id,r])=>r.branch===branch).map(([id,r])=>({id,title:r.title||id}));
  return specific;
}
const google=q=>'https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=es-419&gl=PE&ceid=PE:es-419';
const HIST_TERMS='("pleno casatorio" OR "precedente vinculante" OR "doctrina jurisprudencial" OR "sentencia importante" OR "sentencias importantes" OR "casación importante" OR "sentencia plenaria" OR "precedente judicial" OR "resolución relevante" OR "criterio jurisprudencial" OR "cambio de criterio" OR "regla vinculante")';
const YEARS=Array.from({length:20},(_,i)=>2007+i);
const ALIASES={
 administrativo:'administrativo OR contencioso-administrativo OR "derecho administrativo" OR "acto administrativo" OR "procedimiento administrativo"',
 civil:'civil OR "derecho civil" OR obligaciones OR contratos OR propiedad OR sucesiones OR familia',
 penal:'penal OR "derecho penal" OR delito OR criminal OR imputación OR casación penal',
 laboral:'laboral OR "derecho laboral" OR trabajo OR trabajador OR empleador OR NLPT',
 constitucional:'constitucional OR "derecho constitucional" OR "derechos fundamentales"',
 procesal:'procesal OR "derecho procesal" OR procedimiento OR competencia OR casación',
 tributario:'tributario OR "derecho tributario" OR impuesto OR tributo OR SUNAT',
 financiero:'financiero OR "derecho financiero" OR bancario OR banca OR "mercado de valores"',
 corporativo:'corporativo OR societario OR sociedades OR empresas OR accionistas',
 comercial:'comercial OR mercantil OR "derecho comercial" OR "títulos valores" OR "letra de cambio" OR pagaré OR cheque OR endoso OR aval OR "contrato mercantil"',
 informatico:'informático OR informatico OR "derecho informático" OR ciberseguridad OR "delito informático" OR software',
 medico:'médico OR medico OR "derecho médico" OR "responsabilidad médica" OR sanitario OR salud',
 ambiental:'ambiental OR "derecho ambiental" OR medioambiental OR minería OR recursos naturales',
 minero:'minero OR minería OR "derecho minero" OR concesiones',
 competencia:'competencia OR "libre competencia" OR antitrust OR "barreras burocráticas"',
 consumidor:'consumidor OR "protección al consumidor" OR INDECOPI',
 propiedad_intelectual:'"propiedad intelectual" OR marcas OR patentes OR copyright',
 aduanero:'aduanero OR aduanas OR "derecho aduanero"',
 arbitraje:'arbitraje OR "derecho arbitral" OR laudo OR "convenio arbitral"',
 internacional_publico:'"derecho internacional público" OR tratado OR "responsabilidad internacional"',
 internacional_privado:'"derecho internacional privado" OR "conflicto de leyes" OR exequátur',
 derechos_humanos:'"derechos humanos" OR CIDH OR "Corte Interamericana"',
 familia:'familia OR "derecho de familia" OR divorcio OR alimentos OR filiación',
 sucesorio:'sucesorio OR sucesiones OR herencia OR testamento OR colación',
 registral:'registral OR SUNARP OR registro OR "derecho registral"',
 notarial:'notarial OR notario OR "derecho notarial"',
 inmobiliario:'inmobiliario OR "derecho inmobiliario" OR predio OR inmueble',
 agrario:'agrario OR agricultura OR "derecho agrario" OR tierras',
 pesquero:'pesquero OR pesca OR "derecho pesquero"',
 telecomunicaciones:'telecomunicaciones OR OSIPTEL OR "derecho de telecomunicaciones"',
 energetico:'energía OR energia OR electricidad OR hidrocarburos OR "derecho energético"',
 contratacion_publica:'"contratación pública" OR "contrataciones del estado" OR OSCE OR OECE OR SEACE',
 regulatorio:'regulatorio OR regulación OR organismo regulador',
 municipal:'municipal OR municipalidad OR "derecho municipal" OR ordenanza',
 electoral:'electoral OR JNE OR ONPE OR elecciones OR "derecho electoral"',
 concursal:'concursal OR INDECOPI OR insolvencia OR reestructuración',
 bancario:'bancario OR bancos OR "derecho bancario"',
 seguros:'seguros OR aseguradora OR "derecho de seguros"',
 penitenciario:'penitenciario OR prisión OR interno OR INPE OR "derecho penitenciario"',
 seguridad_social:'"seguridad social" OR pensiones OR ONP OR AFP',
 laboral_publico:'"servicio civil" OR SERVIR OR "empleo público" OR funcionario'
};
function branchQuery(b){return ALIASES[b.key]||b.q||b.label;}

const CONV_FEEDS=[
 ['Talento Perú · SERVIR', 'site:talentoperu.servir.gob.pe convocatoria CAS empleo prácticas Perú 2026', 'em'],
 ['SERVIR', 'site:servir.gob.pe convocatoria CAS concurso empleo prácticas Perú 2026', 'em'],
 ['Poder Judicial', 'site:pj.gob.pe convocatoria CAS concurso empleo prácticas abogados 2026', 'em'],
 ['Ministerio Público', 'site:fiscalia.gob.pe convocatoria CAS concurso empleo prácticas abogados 2026', 'em'],
 ['Tribunal Constitucional', 'site:tc.gob.pe convocatoria concurso empleo prácticas 2026', 'em'],
 ['MINJUSDH', 'site:gob.pe/minjus convocatoria CAS concurso abogados 2026', 'em'],
 ['SUNAFIL', 'site:gob.pe/sunafil convocatoria CAS concurso empleo 2026', 'em'],
 ['SUNAT', 'site:sunat.gob.pe convocatoria CAS concurso empleo 2026', 'em'],
 ['SBS', 'site:sbs.gob.pe convocatoria concurso empleo derecho 2026', 'em'],
 ['SMV', 'site:smv.gob.pe convocatoria concurso empleo derecho 2026', 'em'],
 ['INDECOPI', 'site:indecopi.gob.pe convocatoria CAS concurso empleo derecho 2026', 'em'],
 ['OECE / OSCE', 'site:gob.pe/oece OR site:osce.gob.pe convocatoria CAS concurso derecho 2026', 'em'],
 ['Defensoría del Pueblo', 'site:defensoria.gob.pe convocatoria empleo CAS concurso abogados 2026', 'em'],
 ['Contraloría', 'site:contraloria.gob.pe convocatoria CAS concurso abogados 2026', 'em'],
 ['Universidades públicas', 'convocatoria abogado asesor legal universidad pública Perú CAS concurso 2026', 'em'],
 ['Prácticas jurídicas', 'prácticas preprofesionales derecho Perú convocatoria 2026', 'pr'],
 ['Prácticas profesionales', 'prácticas profesionales derecho Perú convocatoria 2026', 'pr'],
 ['Concursos públicos', 'concurso público Poder Judicial Ministerio Público convocatoria abogados Perú 2026', 'co']
];

function feeds(){
 const out=[
  ['PJ · Jurisprudencia vinculante',OFFICIAL.pjVinc,null,true],
  ['PJ · Servicios de jurisprudencia',OFFICIAL.pjJuris,null,true],
  ['PJ · Casaciones y sentencias importantes',OFFICIAL.pjImportant,null,true],
  ['PJ · Sala Civil · Sentencias importantes',OFFICIAL.pjCivil,'civil',true],
  ['PJ · NLPT · Sentencias importantes',OFFICIAL.pjLaboral,'laboral',true],
  ['PJ · Observatorio · Contencioso administrativo',OFFICIAL.pjObservatorio,'administrativo',true],
  ['Tribunal Constitucional',OFFICIAL.tc,'constitucional',true],
  ['LP Derecho','https://lpderecho.pe/feed/',null,false],
  ['Legis.pe','https://legis.pe/feed/',null,false]
 ].map(([name,url,branch,official])=>({name,url,branch,official}));
 for(const b of branches){
  const q=branchQuery(b);
  out.push({name:`Actual · ${b.label}`,branch:b.key,url:google(`(site:pj.gob.pe OR site:lpderecho.pe OR site:legis.pe OR site:gob.pe) (${q}) (casación OR sentencia OR ejecutoria OR jurisprudencia OR precedente) Perú after:2024-01-01`)});
  out.push({name:`Hitos · ${b.label}`,branch:b.key,historical:true,url:google(`(site:pj.gob.pe OR site:lpderecho.pe OR site:legis.pe OR site:gob.pe) (${q}) ${HIST_TERMS} Perú after:2007-01-01`)});
 }
 // Refuerzo explícito de Derecho Comercial con medios jurídicos peruanos y fuentes judiciales.
 out.push({name:'Comercial · Medios jurídicos',branch:'comercial',url:google('site:lpderecho.pe OR site:legis.pe Perú ("títulos valores" OR "derecho comercial" OR mercantil OR "letra de cambio" OR pagaré OR cheque OR endoso OR aval) after:2007-01-01')});
 out.push({name:'Comercial · Títulos valores y contratación mercantil',branch:'comercial',url:google('site:pj.gob.pe OR site:lpderecho.pe OR site:legis.pe Perú ("títulos valores" OR "letra de cambio" OR pagaré OR cheque OR endoso OR aval OR "contrato mercantil") (casación OR sentencia OR jurisprudencia OR precedente) after:2007-01-01')});
 for(const b of branches){const first=String(ALIASES[b.key]||'').split(/\s+OR\s+/)[0].replace(/["']/g,'').trim()||String(b.label).replace(/^Derecho\s+/i,'').toLowerCase();const term=encodeURIComponent(first+' jurisprudencia');out.push({name:`LP Derecho · ${b.label}`,branch:b.key,url:`https://lpderecho.pe/?s=${term}&feed=rss2`});out.push({name:`Legis.pe · ${b.label}`,branch:b.key,url:`https://legis.pe/?s=${term}&feed=rss2`});}
 for(const y of YEARS) out.push({name:`Archivo de hitos ${y}`,historical:true,url:google(`site:pj.gob.pe ${HIST_TERMS} Perú after:${y}-01-01 before:${y+1}-01-01`)});
 out.push({name:'TC · Jurisprudencia histórica',historical:true,branch:'constitucional',url:google('site:tc.gob.pe jurisprudencia sentencia precedente vinculante Perú after:2007-01-01')});
 return out;
}
function load(){
 const candidates=[...new Set([DATA,path.join(ROOT,'duceet-tracker-data-v13.json'),OLD_DATA,path.join(ROOT,'duceet-tracker-data-v10.json'),OLD_DATA9,path.join(ROOT,'duceet-tracker-data-v9.json')])];
 // Mezcla todos los archivos heredados disponibles. No se detiene en el primer JSON válido,
 // porque uno reciente puede tener solo una parte del archivo histórico.
 let merged={items:[],convos:[],lastRun:0,lastConvRun:0,ok:0,total:0,errors:[],feedStats:[],historyInitialized:false};
 const loaded=[];
 for(const file of candidates){
  try{
   const x=JSON.parse(fs.readFileSync(file,'utf8'));
   if(!x||typeof x!=='object'||!Array.isArray(x.items))continue;
   merged.items=mergeStoredItems(merged.items,x.items);
   merged.convos=mergeStoredItems(merged.convos,x.convos||[]);
   if(Number(x.lastRun||0)>=Number(merged.lastRun||0)){merged.lastRun=Number(x.lastRun||0);merged.ok=Number(x.ok||0);merged.total=Number(x.total||0);merged.errors=Array.isArray(x.errors)?x.errors:merged.errors;merged.feedStats=Array.isArray(x.feedStats)?x.feedStats:merged.feedStats;}
   merged.lastConvRun=Math.max(Number(merged.lastConvRun||0),Number(x.lastConvRun||0));
   merged.historyInitialized=merged.historyInitialized||!!x.historyInitialized;
   merged.modelAlerts=mergeStoredItems(merged.modelAlerts||[],x.modelAlerts||[]);
   merged.convoMeta={...(merged.convoMeta||{}),...(x.convoMeta||{})};
   merged.lastImportAt=merged.lastImportAt||x.lastImportAt||null;
   merged.migratedFrom=merged.migratedFrom|| (path.resolve(file)===path.resolve(DATA)?(x.migratedFrom||null):path.basename(file));
   loaded.push(file);
  }catch{}
 }
 merged.items=mergeStoredItems([],merged.items);merged.convos=mergeStoredItems([],merged.convos);
 merged.migratedFiles=loaded.map(f=>path.basename(f));
 return merged;
}
function save(x){fs.mkdirSync(DATA_DIR,{recursive:true});fs.writeFileSync(DATA,JSON.stringify(x,null,2));}
function mergeStoredItems(existing,incoming){
 const byKey=new Map();
 const keyOf=x=>{const id=String(x?.id||'');if(id.startsWith('base-'))return 'base:'+id;const u=String(x?.link||x?.url||'').trim().replace(/#.*$/,'').replace(/\/$/,'').toLowerCase();return u?'url:'+u:(id?'id:'+id:'title:'+String(x?.title||'').toLowerCase().trim())};
 for(const x of [...(Array.isArray(existing)?existing:[]),...(Array.isArray(incoming)?incoming:[])]){if(!x||!x.title)continue;const k=keyOf(x),old=byKey.get(k);if(!old){byKey.set(k,{...x});continue;}const oldSummary=String(old.summary||old.rawSummary||''),newSummary=String(x.summary||x.rawSummary||'');const z={...old,...x};if(oldSummary.length>newSummary.length){z.summary=old.summary||oldSummary;z.rawSummary=old.rawSummary||oldSummary;}if(!x.ts&&old.ts)z.ts=old.ts;byKey.set(k,z);}
 return [...byKey.values()].sort((a,b)=>(Number(b.ts||0)-Number(a.ts||0))).slice(0,20000);
}
function clean(s){
 let x=String(s||'').replace(/\u00a0/g,' ')
   .replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
   .replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
   .replace(/&amp;/gi,'&');
 x=x.replace(/<script[\s\S]*?<\/script>/gi,' ')
   .replace(/<style[\s\S]*?<\/style>/gi,' ')
   .replace(/<[^>]+>/g,' ');
 return x.replace(/&nbsp;/gi,' ').replace(/\s+/g,' ').trim();
}
function tag(xml,name){const re=new RegExp('<'+name+'[^>]*>([\\s\\S]*?)<\\/'+name+'>','i');const m=xml.match(re);return m?clean(m[1]):'';}
function itemsFromXml(xml,feed){return [...xml.matchAll(/<item[\s\S]*?<\/item>/gi)].map(m=>m[0]).map(x=>({title:tag(x,'title'),link:tag(x,'link'),summary:tag(x,'description'),ts:Date.parse(tag(x,'pubDate'))||Date.now(),source:feed.name,branch:feed.branch||null,historical:!!feed.historical,official:!!feed.official})).filter(x=>x.title&&x.link);}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function fetchText(url,accept){let last='sin respuesta';for(let a=0;a<3;a++){try{const r=await fetch(url,{headers:{'user-agent':UA,accept},signal:AbortSignal.timeout(25000),redirect:'follow'});if(r.status===429||r.status>=500){last='HTTP '+r.status;await sleep(2000*(a+1));continue}if(!r.ok)throw Error('HTTP '+r.status);return await r.text()}catch(e){last=String(e.message||e);if(a<2)await sleep(1200*(a+1))}}throw Error(last)}
function itemsFromHtml(html,feed){const out=[],seen=new Set();let base;try{base=new URL(feed.url)}catch{return out}
 const kw=/casaci|pleno|acuerdo|precedente|sentencia|ejecutoria|resoluci|doctrina|jurisprudencia|\brtf\b|\bstc\b|expediente|sala plena|observancia/i;
 for(const m of html.matchAll(/<a\s[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const txt=clean(m[2]);if(txt.length<18||!kw.test(txt))continue;if(/^(javascript|mailto|tel):/i.test(m[1]))continue;
  let link;try{link=new URL(m[1].replace(/&amp;/g,'&'),base).href}catch{continue}
  if(seen.has(link))continue;seen.add(link);
  const y=txt.match(/\b(20[0-2]\d)\b/);
  out.push({title:txt.slice(0,300),link,summary:'',ts:y?Date.UTC(Number(y[1]),5,1):Date.now(),noDate:!y,source:feed.name,branch:feed.branch||null,historical:!!feed.historical,official:!!feed.official});}
 return out;}
async function fetchFeed(feed){const text=await fetchText(feed.url,'application/rss+xml,application/xml,text/xml,text/html;q=0.9,*/*;q=0.8');let items=feed.html?[]:itemsFromXml(text,feed);if(!items.length&&/<a\s/i.test(text))items=itemsFromHtml(text,feed);return items;}
const BRANCH_PRIORITY_RULES=[
 ['tributario',['precios de transferencia','transfer pricing','fiscalizacion tributaria','fiscalizacion parcial','fiscalizacion definitiva','codigo tributario','obligacion tributaria','administracion tributaria','sunat','tribunal fiscal','prescripcion tributaria','deuda tributaria','impuesto a la renta','igv','impuesto predial']],
 ['civil',['sala civil permanente','sala civil','prescripcion adquisitiva de dominio','prescripcion adquisitiva','usucapion','derechos reales','obligaciones civiles','responsabilidad civil','desalojo','arrendamiento','reivindicacion','propiedad inmueble']],
 ['laboral',['sala laboral','derecho laboral','despido','remuneracion','remuneraciones','cts','gratificacion','beneficios sociales','relacion laboral','contrato de trabajo','trabajador','empleador','sunafil','materia laboral','horas extras']],
 ['penal',['sala penal','derecho penal','delito','imputado','acusacion fiscal','prision preventiva','lavado de activos','homicidio','robo','extorsion','organizacion criminal']],
 ['familia',['derecho de familia','alimentos','filiacion','tenencia','patria potestad','divorcio','violencia familiar']],
 ['sucesorio',['derecho sucesorio','sucesion intestada','testamento','heredero','legitima hereditaria','colacion hereditaria']],
 ['registral',['sunarp','partida registral','inscripcion registral','registro de predios','registro publico','derecho registral']],
 ['notarial',['notario','escritura publica','acta notarial','derecho notarial']],
 ['consumidor',['proteccion al consumidor','idoneidad','libro de reclamaciones','publicidad engañosa','consumidor']],
 ['competencia',['libre competencia','posicion dominante','antimonopolio','concentracion empresarial','barreras burocraticas']],
 ['propiedad_intelectual',['propiedad intelectual','derecho de autor','marca registrada','patente','propiedad industrial']],
 ['informatico',['delito informatico','ciberdelito','evidencia digital','firma digital','comercio electronico','derecho informatico']],
 ['proteccion_datos',['datos personales','proteccion de datos','tratamiento de datos','privacidad','derechos arco']],
 ['ambiental',['impacto ambiental','fiscalizacion ambiental','contaminacion','evaluacion ambiental','medio ambiente']],
 ['minero',['concesion minera','derecho minero','canon minero','actividad minera']],
 ['arbitraje',['convenio arbitral','laudo arbitral','tribunal arbitral','arbitraje']],
 ['administrativo',['contencioso administrativo','acto administrativo','procedimiento administrativo','potestad sancionadora','entidad administrativa','derecho administrativo']],
 ['constitucional',['amparo','habeas corpus','habeas data','inconstitucionalidad','derechos fundamentales','derecho constitucional']],
 ['derechos_humanos',['derechos humanos','corte interamericana','comision interamericana','convencion americana']],
 ['internacional_publico',['tratado internacional','derecho internacional publico','responsabilidad internacional']],
 ['internacional_privado',['conflicto de leyes','ley aplicable','exequatur','derecho internacional privado']],
 ['corporativo',['gobierno corporativo','reorganizacion empresarial','fusion empresarial','adquisicion empresarial','derecho corporativo']],
 ['societario',['sociedad anonima','sociedad comercial','junta de accionistas','directorio','derecho societario']],
 ['comercial',['titulos valores','letra de cambio','pagare','cheque','endoso','aval','derecho comercial']],
 ['bancario',['derecho bancario','operacion bancaria','contrato bancario','credito bancario']],
 ['financiero',['mercado de valores','mercado de capitales','sistema financiero','derecho financiero']],
 ['procesal',['derecho procesal','competencia procesal','carga de la prueba','medida cautelar','recurso de apelacion']],
 ['penitenciario',['derecho penitenciario','ejecucion penal','beneficio penitenciario','regimen penitenciario','establecimiento penitenciario','poblacion penitenciaria','inpe']]
];
function inferBranch(item){
  const t=String((item.title||'')+' '+(item.summary||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  for(const [b,terms] of BRANCH_PRIORITY_RULES){
    if(terms.some(term=>t.includes(term))) return b;
  }
  let best=null,bestScore=0;
  for(const b of branches){
    const words=(ALIASES[b.key]||b.q||b.label).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').split(/\s+OR\s+|\s+/).map(x=>x.replace(/["']/g,'')).filter(x=>x.length>3);
    let score=0;
    for(const w of words) if(t.includes(w)) score += (w.length>=12?4:w.length>=8?2:1);
    if(score>bestScore){bestScore=score;best=b.key;}
  }
  return best || 'procesal';
}
function caseSummary(item){
  const t=(item.title||'').replace(/\s+/g,' ').trim();
  const s=(item.summary||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  if(s && s.length>80) return s.slice(0,360).replace(/\s+[^\s]*$/,'')+'…';
  const m=t.match(/casaci[oó]n\s*(?:n[°º.]?\s*)?([0-9][0-9\-\/]+)/i);
  if(m) return `Casación ${m[1]}: resolución de la Corte Suprema. La materia concreta debe verificarse en la sumilla o resolución oficial enlazada.`;
  return s || 'Resolución jurisprudencial. Revisa la fuente oficial para conocer la materia, hechos y regla jurídica aplicable.';
}
function importance(item){const t=(item.title+' '+item.summary).toLowerCase();let score=0,reasons=[];const tests=[[/pleno casatorio/,45,'Pleno Casatorio'],[/precedente vinculante/,40,'Precedente vinculante'],[/doctrina jurisprudencial/,35,'Doctrina jurisprudencial'],[/sentencia plenaria/,32,'Sentencia plenaria'],[/acuerdo plenario/,30,'Acuerdo plenario'],[/casaci[oó]n importante|sentencias importantes/,26,'Decisión identificada como importante'],[/cambio jurisprudencial|nuevo criterio|nuevo precedente/,28,'Cambio o nuevo criterio jurisprudencial'],[/regla vinculante|car[aá]cter vinculante/,30,'Regla vinculante'],[/uniformidad|predictibilidad|seguridad jur[ií]dica/,12,'Impacto en uniformidad o predictibilidad']];for(const [re,n,r] of tests)if(re.test(t)){score+=n;reasons.push(r)}if(item.historical)score+=5;if(/casaci[oó]n|sentencia|ejecutoria|jurisprudencia|precedente|pleno|acuerdo/.test(t))score+=4;return {importanceScore:score,keyJuris:score>=20,impact:score>=35?'alto':score>=15?'medio':'bajo',hito:score>=28,importantReason:[...new Set(reasons)].slice(0,3).join(' · ')||'Resolución o publicación jurídica para seguimiento.'};}
function juridicalType(title){const t=title.toLowerCase();if(/pleno casatorio/.test(t))return'Pleno Casatorio';if(/acuerdo plenario/.test(t))return'Acuerdo Plenario';if(/precedente vinculante/.test(t))return'Precedente Vinculante';if(/casaci[oó]n/.test(t))return'Casación';if(/ejecutoria/.test(t))return'Ejecutoria';if(/sentencia/.test(t))return'Sentencia';return'Jurisprudencia';}
function isNormativeOrJuris(item){
 const t=(item.title+' '+item.summary).toLowerCase();
 return /\b(ley|decreto legislativo|decreto supremo|decreto de urgencia|resolución|resolucion|reglamento|tuo|precedente vinculante|doctrina jurisprudencial|pleno casatorio|acuerdo plenario|casación|casacion|sentencia|ejecutoria|jurisprudencia|modifica|modifican|deroga|derogan|reforma)\b/.test(t);
}
function dependencyMatches(item){
 const t=(item.title+' '+item.summary).toLowerCase();
 const out=[];
 for(const b of branches){
   const alias=(ALIASES[b.key]||b.q||b.label).toLowerCase();
   const words=alias.split(/\s+OR\s+|\s+/).map(x=>x.replace(/["']/g,'')).filter(x=>x.length>4);
   let score=0;
   for(const w of words) if(t.includes(w)) score += w.length>9?3:1;
   if(item.branch===b.key) score+=2;
   if(score>0) out.push({branch:b.key,score});
 }
 return out.sort((a,b)=>b.score-a.score).slice(0,4);
}
function reclassifyStoredItems(items){
 const out=[];
 for(const item of Array.isArray(items)?items:[]){
  const branch=item.branchLocked&&item.branch?item.branch:inferBranch({title:item.title||'',summary:item.summary||''});
  out.push({...item,branch,group:GROUP_OF[branch]||null});
 }
 return out;
}

function modelImpactFor(item){
 if(!isNormativeOrJuris(item)) return [];
 const matches=dependencyMatches(item), models=[];
 for(const hit of matches){
   const specific=modelCatalogForBranch(hit.branch);
   if(specific.length) specific.forEach(m=>models.push({id:m.id,title:m.title,branch:hit.branch}));
   else models.push({id:'branch:'+hit.branch,title:`Modelos de ${branches.find(b=>b.key===hit.branch)?.label||hit.branch}`,branch:hit.branch});
 }
 return models.slice(0,20);
}
function createModelAlerts(items, state){
 const existing=new Map((state.modelAlerts||[]).map(a=>[a.id,a]));
 const cutoff=state.lastRun ? state.lastRun-5*60*1000 : Date.now()-90*24*60*60*1000;
 for(const item of items){
   if((item.ts||0)<cutoff) continue;
   const models=modelImpactFor(item); if(!models.length) continue;
   const id=hash((item.link||item.title)+'|'+models.map(m=>m.id).join(','));
   if(existing.has(id)) continue;
   const b=branches.find(x=>x.key===item.branch);
   existing.set(id,{id,itemId:item.id||hash(item.link),title:item.title,summary:item.summary,link:item.link,source:item.source,ts:item.ts,branch:item.branch,branchLabel:b?.label||item.branch,juridicalType:item.juridicalType,impact:item.impact,models,status:'pending',createdAt:new Date().toISOString(),reason:item.importantReason||'Nueva publicación jurídica potencialmente relacionada con modelos.'});
 }
 state.modelAlerts=[...existing.values()].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5000);
 return state;
}
async function refresh(){
 const state=load();
 const reclassified=reclassifyStoredItems(state.items||[]);
 const map=new Map(reclassified.map(x=>[x.link,x]));
 const errors=[];let ok=0;const fsx=feeds();
 const feedStats=[];for(let i=0;i<fsx.length;i+=4){if(i)await sleep(700);const batch=fsx.slice(i,i+4);const got=await Promise.allSettled(batch.map(fetchFeed));got.forEach((r,j)=>{if(r.status==='rejected'){errors.push({source:batch[j].name,error:String(r.reason)});feedStats.push({name:batch[j].name,items:0,error:String(r.reason).slice(0,80)});return}ok++;feedStats.push({name:batch[j].name,items:r.value.length});for(const raw of r.value){const branch=raw.branch||inferBranch(raw),imp=importance(raw);const item={...raw,branch,group:GROUP_OF[branch]||null,branchLocked:!!raw.branch,summary:caseSummary(raw),...imp,year:new Date(raw.ts).getFullYear(),juridicalType:juridicalType(raw.title),officialSource:branch==='constitucional'?OFFICIAL.tc:(branch==='administrativo'?OFFICIAL.pjObservatorio:OFFICIAL.pjJuris)};if(!map.has(item.link))map.set(item.link,item);else{const old=map.get(item.link);map.set(item.link,{...old,...item,ts:item.noDate?old.ts:item.ts});}}})}
 const newest=load();
 // Una importación o registro guardado mientras se consultaban las fuentes no debe desaparecer
 // cuando acaba este rastreo. Fusiona otra vez con el estado persistido justo antes de guardar.
 const items=mergeStoredItems(newest.items,[...map.values()]);
 let next={...state,...newest,items,feedStats,lastRun:Date.now(),ok,total:fsx.length,errors:errors.slice(0,80),historyInitialized:true,migratedFrom:newest.migratedFrom||state.migratedFrom||null};
 next=createModelAlerts(items,next);save(next);console.log(new Date().toLocaleString('es-PE')+' · rastreo: '+ok+'/'+fsx.length+' fuentes respondieron · '+items.length+' registros · '+feedStats.filter(x=>!x.items).length+' fuentes vacías (ver /api/status)');return next;
}
function convStatus(item){const t=(item.title+' '+item.summary).toLowerCase();if(/cerrad|finalizad|vencid|resultados finales|adjudicad/.test(t))return 'Posiblemente cerrada';if(/vigente|postulaciones abiertas|hasta el|fecha límite|fecha limite/.test(t))return 'Revisar vigencia';return 'Verificar vigencia en la fuente';}
async function refreshConvos(){
 const state=load(),map=new Map((Array.isArray(state.convos)?state.convos:[]).map(x=>[x.link,x]));
 for(let i=0;i<CONV_FEEDS.length;i+=6){const batch=CONV_FEEDS.slice(i,i+6).map(([name,q,kind])=>({name,kind,url:google(q)}));const got=await Promise.allSettled(batch.map(fetchFeed));got.forEach((r,j)=>{if(r.status!=='fulfilled')return;for(const x of r.value){if(!/convocatoria|pr[aá]ctic|concurso|cas\b|plaza|vacante|abogad|practicante|proceso de selecci/i.test(x.title))continue;const item={id:hash(x.link),title:x.title,source:x.source,link:x.link,ts:x.ts||Date.now(),kind:batch[j].kind,status:convStatus(x)};map.set(item.link,item);}})}
 const latest=load();
 const convos=mergeStoredItems(latest.convos,[...map.values()]).sort((a,b)=>b.ts-a.ts).slice(0,500);
 const next={...state,...latest,items:mergeStoredItems(latest.items,state.items||[]),convos,lastConvRun:Date.now()};save(next);return convos;
}
const hash=s=>{let h=0;for(let i=0;i<String(s).length;i++)h=(h*31+String(s).charCodeAt(i))|0;return 'h'+(h>>>0).toString(36)};
let refreshing=null,refreshingConv=null;
async function refreshOnce(){if(!refreshing)refreshing=refresh().finally(()=>refreshing=null);return refreshing}
async function refreshConvosOnce(){if(!refreshingConv)refreshingConv=refreshConvos().finally(()=>refreshingConv=null);return refreshingConv}
refreshOnce().then(()=>refreshConvosOnce()).catch(()=>{});
setInterval(()=>refreshOnce().then(()=>refreshConvosOnce()).catch(()=>{}),INTERVAL);
function loadSummaries(){return readJson(SUMMARIES,{items:[]})}
function saveSummaries(x){writeJson(SUMMARIES,x)}
function nowPE(){return new Intl.DateTimeFormat('es-PE',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Lima'}).format(new Date())}
function parseBody(req){return new Promise((resolve,reject)=>{let raw='';req.on('data',c=>{raw+=c;if(raw.length>200000)req.destroy()});req.on('end',()=>{try{resolve(JSON.parse(raw||'{}'))}catch(e){reject(e)}});req.on('error',reject)})}
function send(res,status,type,body){res.writeHead(status,{'content-type':type,'access-control-allow-origin':'*','cache-control':'no-store'});res.end(body)}
function json(res,obj,status=200){send(res,status,'application/json; charset=utf-8',JSON.stringify(obj))}
function serve(req,res){const u=new URL(req.url,'http://localhost:'+PORT);const s=load();
 if(u.pathname==='/api/summaries'&&req.method==='GET'){
  const limit=Math.min(Number(u.searchParams.get('limit')||500),1000), q=String(u.searchParams.get('q')||'').toLowerCase(), b=String(u.searchParams.get('branch')||'todas');
  const all=loadSummaries().items||[]; const items=all.filter(x=>(b==='todas'||x.branch===b)&&(!q||`${x.title} ${x.author} ${x.content}`.toLowerCase().includes(q))).sort((a,b)=>String(b.createdIso||'').localeCompare(String(a.createdIso||''))).slice(0,limit);
  return json(res,{items,count:items.length});
}
if(u.pathname==='/api/summaries'&&req.method==='POST'){
  return parseBody(req).then(body=>{
    const title=cleanText(body.title,180), author=cleanText(body.author,120), content=cleanText(body.content,12000), source=cleanText(body.source,500), branch=cleanText(body.branch,80);
    if(!title||!author||!content) return json(res,{ok:false,error:'Título, autoría y contenido son obligatorios.'},400);
    if(!validBranch(branch)) return json(res,{ok:false,error:'Rama jurídica no válida.'},400);
    if(source && !/^https?:\/\//i.test(source)) return json(res,{ok:false,error:'La fuente debe comenzar con http:// o https://.'},400);
    const db=loadSummaries(); db.items=Array.isArray(db.items)?db.items:[];
    const item={id:'sum_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,8),title,author,branch,source,content,createdIso:new Date().toISOString(),createdAt:nowPE(),published:true};
    db.items.unshift(item); db.items=db.items.slice(0,5000); saveSummaries(db); return json(res,{ok:true,item});
  }).catch(e=>json(res,{ok:false,error:String(e.message||e)},400));
}
if(u.pathname==='/api/model-alerts'&&req.method==='GET'){
  const limit=Math.min(Number(u.searchParams.get('limit')||200),1000),status=String(u.searchParams.get('status')||'pending');
  const items=(s.modelAlerts||[]).filter(x=>status==='all'||x.status===status).slice(0,limit);
  return json(res,{items,count:items.length});
 }
 if(u.pathname==='/api/model-alerts'&&req.method==='POST'){
  return parseBody(req).then(body=>{
   const id=cleanText(body.id,180), action=cleanText(body.action,30); const db=load(); const a=(db.modelAlerts||[]).find(x=>x.id===id);
   if(!a)return json(res,{ok:false,error:'Alerta no encontrada.'},404);
   if(!['reviewed','dismissed','pending'].includes(action))return json(res,{ok:false,error:'Acción no válida.'},400);
   a.status=action; a.reviewedAt=action==='pending'?null:new Date().toISOString(); save(db); return json(res,{ok:true,item:a});
  }).catch(e=>json(res,{ok:false,error:String(e.message||e)},400));
 }
 if(u.pathname==='/api/classify'){const q=cleanText(u.searchParams.get('q')||'',5000);const branch=q?inferBranch({title:q,summary:''}):null;const b=branches.find(x=>x.key===branch);return json(res,{ok:!!q,branch,branchLabel:b?.label||null,juridicalType:q?juridicalType(q):null,summary: q?caseSummary({title:q,summary:''}):''});}
 if(u.pathname==='/api/backup/export'&&req.method==='GET'){
  const current=load();const payload={format:'duceet-jurisprudencia-backup-v1',exportedAt:new Date().toISOString(),count:(current.items||[]).length,state:current};
  res.writeHead(200,{'content-type':'application/json; charset=utf-8','content-disposition':'attachment; filename=\"duceet-server-backup.json\"','cache-control':'no-store'});return res.end(JSON.stringify(payload));
 }
 if(u.pathname==='/api/backup/import'&&req.method==='POST'){
  const expected=String(process.env.DUCEET_ADMIN_TOKEN||''),given=String(req.headers.authorization||'').replace(/^Bearer\s+/i,'');
  if(!expected)return json(res,{ok:false,error:'La restauración del servidor está desactivada: configura DUCEET_ADMIN_TOKEN en Render.'},403);
  if(given!==expected)return json(res,{ok:false,error:'Token de administración incorrecto.'},403);
  return parseBody(req).then(body=>{
   const incoming=Array.isArray(body)?body:(body.items||body.state?.items||body.data?.items||[]);
   if(!Array.isArray(incoming)||!incoming.length)return json(res,{ok:false,error:'El respaldo no contiene registros.'},400);
   if(incoming.length>20000)return json(res,{ok:false,error:'El respaldo supera el límite de 20.000 registros.'},413);
   const safe=incoming.filter(x=>x&&typeof x.title==='string'&&x.title.trim()&&/^https?:\/\//i.test(String(x.link||x.url||''))).map(x=>({...x,title:String(x.title).trim().slice(0,500),link:String(x.link||x.url).slice(0,2000)}));
   if(!safe.length)return json(res,{ok:false,error:'No hay registros con título y enlace HTTP/HTTPS válidos.'},400);
   const current=load();current.items=mergeStoredItems(current.items,safe);current.historyInitialized=true;current.lastImportAt=new Date().toISOString();save(current);
   return json(res,{ok:true,imported:safe.length,count:current.items.length,lastImportAt:current.lastImportAt});
  }).catch(e=>json(res,{ok:false,error:String(e.message||e)},400));
 }
 if(u.pathname==='/api/status')return json(res,{lastRun:s.lastRun,lastConvRun:s.lastConvRun,ageMs:s.lastRun?Date.now()-s.lastRun:null,count:s.items?.length||0,convos:s.convos?.length||0,ok:s.ok,total:s.total,errors:s.errors,feedsEmpty:(s.feedStats||[]).filter(x=>!x.items).map(x=>x.name+(x.error?' ['+x.error+']':'')),itemsPorGrupo:Object.fromEntries(Object.entries((s.items||[]).reduce((a,x)=>(a[x.group||'sin_grupo']=(a[x.group||'sin_grupo']||0)+1,a),{})).sort((a,b)=>b[1]-a[1])),itemsPorRama:Object.fromEntries(Object.entries((s.items||[]).reduce((a,x)=>(a[x.branch]=(a[x.branch]||0)+1,a),{})).sort((a,b)=>b[1]-a[1])),branches:branches.length,intervalMs:INTERVAL,historyInitialized:!!s.historyInitialized,summaries:loadSummaries().items?.length||0,modelAlerts:(s.modelAlerts||[]).filter(x=>x.status==='pending').length,version:VERSION});
 if(u.pathname==='/api/items'){const limit=Math.min(Number(u.searchParams.get('limit')||1000),20000),onlyKey=u.searchParams.get('key')==='1';const arr=onlyKey?(s.items||[]).filter(x=>x.keyJuris):(s.items||[]);return json(res,{items:arr.slice(0,limit),lastRun:s.lastRun});}
 if(u.pathname==='/api/convos'){const limit=Math.min(Number(u.searchParams.get('limit')||200),500);return json(res,{items:(s.convos||[]).slice(0,limit),lastRun:s.lastConvRun||0,source:OFFICIAL.talento});}
 if(u.pathname==='/api/sources')return json(res,{official:OFFICIAL,branches,feeds:feeds().length,convFeeds:CONV_FEEDS.length});
 if(u.pathname==='/api/refresh'&&req.method==='POST')return Promise.all([refreshOnce(),refreshConvosOnce()]).then(([a,c])=>json(res,{ok:true,lastRun:a.lastRun,lastConvRun:a.lastConvRun,count:a.items.length,convos:c.length})).catch(e=>json(res,{ok:false,error:String(e)},500));
 if(u.pathname==='/'){try{return send(res,200,'text/html; charset=utf-8',fs.readFileSync(HTML))}catch(e){return send(res,500,'text/plain',String(e))}}
 if(u.pathname.startsWith('/duceet-laboratorio/')){try{const rel=decodeURIComponent(u.pathname.slice(1));const file=path.resolve(ROOT,rel);const base=path.resolve(ROOT,'duceet-laboratorio')+path.sep;if(!file.startsWith(base)||!fs.existsSync(file)||!fs.statSync(file).isFile())return send(res,404,'text/plain','Not found');const ext=path.extname(file).toLowerCase();const types={'.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.json':'application/json; charset=utf-8','.md':'text/markdown; charset=utf-8','.py':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};return send(res,200,types[ext]||'application/octet-stream',fs.readFileSync(file));}catch(e){return send(res,404,'text/plain','Not found')}}
 return send(res,404,'text/plain','Not found');}
http.createServer(serve).listen(PORT,()=>console.log(`DUCEET v16.6 tracker activo · ${branches.length} ramas · ${feeds().length} fuentes/consultas + ${CONV_FEEDS.length} convocatorias · cada 3 horas`));
