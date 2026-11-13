import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getFirestore, collection, doc, getDoc, getDocs, setDoc, query, where, writeBatch, serverTimestamp, runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {validId, recordId, buildRoster, filterRows, csv, chooseEnrollment} from './domain.js';
const firebaseConfig={apiKey:'AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA',authDomain:'utet-4387a.firebaseapp.com',projectId:'utet-4387a',storageBucket:'utet-4387a.firebasestorage.app',messagingSenderId:'902848131454',appId:'1:902848131454:web:47f515eb6480834724c32f'};
const db=getFirestore(initializeApp(firebaseConfig));
const $=id=>document.getElementById(id);
const adminPage=location.pathname.endsWith('/admin.html');
const configCollection='incorporaciones_config', rosterCollection='incorporaciones_padron', responsesCollection='incorporaciones_respuestas';
let periods=[], configs=new Map(), selected=null, rows=[], currentConfig={}, adminPeriod='', authorized=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(text,error=false){$('notice').textContent=text;$('notice').className=error?'error':'';$('notice').hidden=!text;}
function explain(error){console.error(error);if(error.code==='permission-denied')return 'Firebase rechazó el acceso. Revisa los permisos de Firestore.';if(error.code==='unavailable')return 'No se pudo conectar. Comprueba tu conexión e inténtalo nuevamente.';return error.message || 'No se pudo completar la operación.';}
async function busy(button,fn){const text=button.textContent;button.disabled=true;button.textContent='Procesando…';notice('');try{await fn();}catch(e){notice(explain(e),true);}finally{button.disabled=false;button.textContent=text;}}
async function list(name){return (await getDocs(collection(db,name))).docs.map(d=>({...d.data(),id:d.id}));}
async function loadPeriods(){
  periods=(await list('periodos')).filter(p=>!p.eliminado&&p.activo!==false).sort((a,b)=>b.id.localeCompare(a.id));
  configs=new Map((await list(configCollection)).map(c=>[c.id,c]));
  $('adminPeriod').innerHTML=periods.map(p=>`<option value="${esc(p.id)}">${esc(p.label||p.id)}</option>`).join('');
  if(adminPeriod&&periods.some(p=>p.id===adminPeriod))$('adminPeriod').value=adminPeriod;
}
function resetStudent(){selected=null;$('student').hidden=true;$('answer').reset();}
let lookupVersion=0, lookupTimer;
$('cedula').addEventListener('input',()=>{
  clearTimeout(lookupTimer);lookupVersion++;resetStudent();notice('');
  $('lookupButton').disabled=false;$('lookupButton').textContent='Consultar';
  if(validId($('cedula').value.trim()))lookupTimer=setTimeout(lookupStudent,300);
});
$('lookup').addEventListener('submit',e=>{e.preventDefault();clearTimeout(lookupTimer);lookupStudent();});
async function lookupStudent(){
  const version=++lookupVersion,cedula=$('cedula').value.trim();
  const current=()=>version===lookupVersion;
  resetStudent();notice('');
  if(!validId(cedula)){notice('Ingresa una cédula de 10 dígitos.',true);return;}
  $('lookupButton').disabled=true;$('lookupButton').textContent='Buscando…';
  try{
    // Institutional data is visible independently of survey opening and roster synchronization.
    const profile=await getDoc(doc(db,'Estudiante',cedula));
    if(!current())return;
    if(!profile.exists()||profile.data().eliminado)throw Error('No encontramos tu cédula. Comunícate con Titulación.');
    const data=profile.data();
    $('studentData').innerHTML=`<strong>${esc(data.nombres)}</strong><span>${esc(data.nombreCarreraActual||'')}</span>`;
    $('student').hidden=false;$('answer').hidden=true;$('receipt').hidden=false;
    $('receipt').textContent='Consultando disponibilidad…';
    await loadPeriods();if(!current())return;
    const open=periods.filter(p=>configs.get(p.id)?.abierta);
    const matches=await Promise.all(open.map(async p=>{
      const id=recordId(p.id,cedula),snapshot=await getDoc(doc(db,rosterCollection,id));
      return snapshot.exists()?{...snapshot.data(),id}:null;
    }));
    if(!current())return;
    const student=chooseEnrollment(matches);
    if(!student){$('receipt').textContent='Tus datos están registrados. La encuesta aún no está habilitada para ti.';return;}
    const response=await getDoc(doc(db,responsesCollection,student.id));
    if(!current())return;
    selected=student;
    $('studentData').innerHTML=`<strong>${esc(selected.nombres)}</strong><span>${esc(selected.carrera)}</span>`;
    $('answer').hidden=response.exists();$('receipt').hidden=!response.exists();
    if(response.exists())showReceipt(response.data().sedeElegida);
  }catch(e){if(current()){$('receipt').hidden=true;notice(explain(e),true);}}
  finally{if(current()){$('lookupButton').disabled=false;$('lookupButton').textContent='Consultar';}}
}
function showReceipt(city){$('answer').hidden=true;$('receipt').hidden=false;$('receipt').innerHTML=`<strong>Tu preferencia está registrada: ${esc(city)}.</strong><br>Gracias por responder. Para solicitar un cambio, comunícate con Titulación.`;}
$('answer').addEventListener('submit',e=>{e.preventDefault();busy($('sendButton'),async()=>{
  if(!selected)throw Error('Consulta tus datos nuevamente.');
  const target={...selected},city=new FormData($('answer')).get('sede');
  if(!['Quito','Manta'].includes(city)||!$('consent').checked)throw Error('Selecciona una sede y confirma tu elección.');
  if(!confirm(`¿Confirmas que deseas incorporarte en ${city}?`))return;
  await runTransaction(db,async tx=>{
    const config=await tx.get(doc(db,configCollection,target.periodoId));
    const roster=await tx.get(doc(db,rosterCollection,target.id));
    const ref=doc(db,responsesCollection,target.id),existing=await tx.get(ref);
    if(!config.exists()||!config.data().abierta)throw Error('La encuesta se ha cerrado.');
    if(!roster.exists()||!roster.data().activo)throw Error('Tu registro ya no está habilitado.');
    if(existing.exists())throw Error('Tu respuesta ya está registrada. Consulta nuevamente tu cédula.');
    const {cedula,nombres,carrera,periodoId,sedeOrigen}=roster.data();
    tx.set(ref,{cedula,nombres,carrera,periodoId,sedeOrigen,sedeElegida:city,consentimiento:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  });
  if(selected?.id===target.id)showReceipt(city);
  notice('Tu preferencia se guardó correctamente.');
});});
$('login').addEventListener('submit',e=>{e.preventDefault();if($('password').value!=='5626'){notice('PIN incorrecto.',true);$('password').value='';return;}authorized=true;sessionStorage.setItem('inc_admin','1');$('password').value='';openAdmin();});
$('logout').addEventListener('click',()=>{authorized=false;sessionStorage.removeItem('inc_admin');rows=[];$('rows').replaceChildren();$('dashboard').hidden=true;$('logout').hidden=true;$('login').hidden=false;notice('Sesión cerrada.');});
async function openAdmin(){if(!authorized)return;$('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;notice('');try{await loadPeriods();await loadAdmin();}catch(e){notice(explain(e),true);}}
async function loadAdmin(){
  if(!authorized)return;
  adminPeriod=$('adminPeriod').value;if(!adminPeriod)throw Error('No hay períodos activos en Firebase.');
  const period=adminPeriod;
  const [config,roster,responses]=await Promise.all([getDoc(doc(db,configCollection,period)),getDocs(query(collection(db,rosterCollection),where('periodoId','==',period))),getDocs(query(collection(db,responsesCollection),where('periodoId','==',period)))]);
  if(!authorized||$('adminPeriod').value!==period)return;
  currentConfig=config.exists()?config.data():{abierta:false};
  const answers=new Map(responses.docs.map(d=>[d.id,d.data()]));
  rows=roster.docs.filter(d=>d.data().activo).map(d=>{const a=answers.get(d.id);return {...d.data(),id:d.id,sedeElegida:a?.sedeElegida||'',fecha:a?.createdAt?.toDate?.().toLocaleString('es-EC',{timeZone:'America/Guayaquil'})||''};});
  $('toggle').textContent=currentConfig.abierta?'Cerrar encuesta':'Abrir encuesta';
  $('configStatus').textContent=`Estado: ${currentConfig.abierta?'ABIERTA':'CERRADA'} · ${rows.length} estudiantes habilitados. Las respuestas de registros deshabilitados se conservan en Firebase.`;
  const previous=$('career').value;$('career').innerHTML='<option value="">Todas las carreras</option>'+[...new Set(rows.map(r=>r.carrera))].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if([...$('career').options].some(o=>o.value===previous))$('career').value=previous;
  const q=rows.filter(r=>r.sedeElegida==='Quito').length,m=rows.filter(r=>r.sedeElegida==='Manta').length;
  $('metrics').innerHTML=[['Habilitados',rows.length],['Prefieren Quito',q],['Prefieren Manta',m],['Pendientes',rows.length-q-m]].map(([label,value])=>`<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');renderRows();
}
function filtered(){return filterRows(rows,{search:$('search').value,city:$('city').value,career:$('career').value,status:$('status').value});}
function renderRows(){const result=filtered();$('resultCount').textContent=`${result.length} de ${rows.length} estudiantes · Las cifras superiores corresponden a todo el período.`;$('rows').innerHTML=result.length?result.map(r=>`<tr><td><strong>${esc(r.nombres)}</strong><small>${esc(r.cedula)}</small></td><td>${esc(r.carrera)}</td><td>${esc(r.sedeOrigen)}</td><td><span class="badge ${esc(r.sedeElegida)}">${esc(r.sedeElegida||'Pendiente')}</span></td><td>${esc(r.fecha||'—')}</td></tr>`).join(''):'<tr><td colspan="5">No hay estudiantes que coincidan con estos filtros.</td></tr>';}
for(const id of ['search','career','city','status'])$(id).addEventListener('input',renderRows);
$('adminPeriod').addEventListener('change',()=>busy($('refresh'),loadAdmin));
$('refresh').addEventListener('click',()=>busy($('refresh'),loadAdmin));
$('toggle').addEventListener('click',()=>busy($('toggle'),async()=>{if(!authorized)return;const period=$('adminPeriod').value;if(currentConfig.abierta===false&&!rows.length)throw Error('Sincroniza primero los estudiantes de este período.');await setDoc(doc(db,configCollection,period),{abierta:!currentConfig.abierta,updatedAt:serverTimestamp()},{merge:true});await loadAdmin();}).then(()=>{$('toggle').textContent=currentConfig.abierta?'Cerrar encuesta':'Abrir encuesta';}));
$('sync').addEventListener('click',()=>busy($('sync'),async()=>{
  if(!authorized)return;const period=$('adminPeriod').value;if(!period)throw Error('Selecciona un período.');
  if(!confirm('¿Sincronizar las matrículas activas de este período? Las respuestas existentes se conservarán.'))return;
  $('adminPeriod').disabled=true;$('toggle').disabled=true;
  try{
    const configRef=doc(db,configCollection,period), prior=await getDoc(configRef);
    const wasOpen=prior.exists()&&prior.data().abierta===true;
    await setDoc(configRef,{abierta:false,updatedAt:serverTimestamp()},{merge:true});
    const [students,enrollments,old]=await Promise.all([list('Estudiante'),getDocs(query(collection(db,'matriculas'),where('periodoId','==',period))),getDocs(query(collection(db,rosterCollection),where('periodoId','==',period)))]);
    const roster=buildRoster(students,enrollments.docs.map(d=>d.data()),period),ids=new Set(roster.map(r=>recordId(period,r.cedula)));
    const writes=[...roster.map(r=>({ref:doc(db,rosterCollection,recordId(period,r.cedula)),data:r})),...old.docs.filter(d=>!ids.has(d.id)).map(d=>({ref:d.ref,data:{...d.data(),activo:false}}))];
    for(let start=0;start<writes.length;start+=400){const batch=writeBatch(db);for(const w of writes.slice(start,start+400))batch.set(w.ref,w.data);await batch.commit();}
    await setDoc(configRef,{abierta:wasOpen&&roster.length>0,sincronizadoEn:serverTimestamp(),updatedAt:serverTimestamp()},{merge:true});
    await loadAdmin();notice(`Padrón sincronizado: ${roster.length} estudiantes activos. ${wasOpen?'Se restauró la apertura.':'Ahora puedes abrir la encuesta.'}`);
  }catch(e){await loadAdmin().catch(()=>{});throw Error(`${explain(e)} La encuesta queda cerrada; vuelve a sincronizar antes de abrirla.`);}finally{$('adminPeriod').disabled=false;$('toggle').disabled=false;$('toggle').textContent=currentConfig.abierta?'Cerrar encuesta':'Abrir encuesta';}
}));
$('export').addEventListener('click',()=>{if(!authorized)return;const blob=new Blob([csv(filtered())],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`incorporaciones_${adminPeriod}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('survey').hidden=adminPage;$('admin').hidden=!adminPage;
if(adminPage){authorized=sessionStorage.getItem('inc_admin')==='1';if(authorized)openAdmin();}
