import {initializeApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getFirestore, collection, doc, getDoc, getDocs, setDoc, query, where, writeBatch, serverTimestamp, runTransaction} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import {setupAdmin} from './admin-ui.js?v=20261113-5';
import {validId, recordId, buildRoster, filterRows, csv} from './domain.js';
const firebaseConfig={apiKey:'AIzaSyCaHf1C0BB0X_H3BDZ1o-UDAsPmLTjsZLA',authDomain:'utet-4387a.firebaseapp.com',projectId:'utet-4387a',storageBucket:'utet-4387a.firebasestorage.app',messagingSenderId:'902848131454',appId:'1:902848131454:web:47f515eb6480834724c32f'};
const db=getFirestore(initializeApp(firebaseConfig));
const $=id=>document.getElementById(id);
const adminPage=location.pathname.endsWith('/admin.html');
const configCollection='incorporaciones_config', rosterCollection='incorporaciones_padron', responsesCollection='incorporaciones_respuestas';
let adminUI=null,adminLoadVersion=0;
let periods=[], configs=new Map(), selected=null, rows=[], currentConfig={}, adminPeriod='', authorized=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function notice(text,error=false){$('notice').textContent=text;$('notice').className=error?'error':'';$('notice').hidden=!text;}
function explain(error){console.error(error);if(error.code==='permission-denied')return 'Firebase rechazó el acceso. Revisa los permisos de Firestore.';if(error.code==='unavailable')return 'No se pudo conectar. Comprueba tu conexión e inténtalo nuevamente.';return error.message || 'No se pudo completar la operación.';}
async function busy(button,fn){const text=button.textContent;button.disabled=true;button.textContent='Procesando…';notice('');try{await fn();}catch(e){notice(explain(e),true);}finally{button.disabled=false;button.textContent=text;}}
async function list(name){return (await getDocs(collection(db,name))).docs.map(d=>({...d.data(),id:d.id}));}
async function loadPeriods(){
  periods=(await list('periodos')).filter(p=>!p.eliminado).sort((a,b)=>b.id.localeCompare(a.id));
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
    // Every non-deleted institutional student may choose a site, without roster or opening prerequisites.
    const profile=await getDoc(doc(db,'Estudiante',cedula));
    if(!current())return;
    if(!profile.exists()||profile.data().eliminado)throw Error('No encontramos tu cédula. Comunícate con Titulación.');
    const data=profile.data();
    $('studentData').innerHTML=`<strong>${esc(data.nombres)}</strong><span>${esc(data.nombreCarreraActual||'')}</span>`;
    $('student').hidden=false;$('answer').hidden=true;$('receipt').hidden=false;
    $('receipt').textContent='Preparando elección de sede…';
    await loadPeriods();if(!current())return;
    if(!periods.length)throw Error('No hay períodos disponibles para registrar tu elección. Comunícate con Titulación.');
    const [enrollmentDocs,rosters]=await Promise.all([
      getDocs(query(collection(db,'matriculas'),where('cedula','==',cedula))),
      Promise.all(periods.map(async p=>{
        const snapshot=await getDoc(doc(db,rosterCollection,recordId(p.id,cedula)));
        return snapshot.exists()?{...snapshot.data(),periodoId:p.id}:null;
      }))
    ]);
    if(!current())return;
    const enrollments=enrollmentDocs.docs.map(d=>d.data());
    const knownPeriods=new Set([...enrollments.map(m=>m.periodoId),...rosters.filter(Boolean).map(r=>r.periodoId)]);
    const period=periods.find(p=>knownPeriods.has(p.id))||periods.find(p=>configs.get(p.id)?.abierta)||periods[0];
    const enrollment=enrollments.find(m=>m.periodoId===period.id);
    const roster=rosters.find(r=>r?.periodoId===period.id);
    const student={
      id:recordId(period.id,cedula),cedula,nombres:data.nombres||roster?.nombres||'',
      carrera:enrollment?.nombreCarrera||roster?.carrera||data.nombreCarreraActual||'',
      periodoId:period.id,sedeOrigen:enrollment?.sede||roster?.sedeOrigen||data.sede||'',activo:true
    };
    const response=await getDoc(doc(db,responsesCollection,student.id));
    if(!current())return;
    selected=student;
    $('studentData').innerHTML=`<strong>${esc(student.nombres)}</strong><span>${esc(student.carrera)}</span>`;
    $('answer').hidden=response.exists();$('receipt').hidden=!response.exists();
    if(response.exists())showReceipt(response.data().sedeElegida);
  }catch(e){if(current()){$('receipt').hidden=true;notice(explain(e),true);}}
  finally{if(current()){$('lookupButton').disabled=false;$('lookupButton').textContent='Consultar';}}
}
function showReceipt(city,justSaved=false){
  $('answer').hidden=true;$('receipt').hidden=false;
  const heading=justSaved?`Elegiste la sede ${esc(city)}.`:`Tu sede es ${esc(city)}.`;
  const detail=justSaved?'Tu elección quedó registrada correctamente.':'Tu elección ya está registrada.';
  $('receipt').innerHTML=`<strong>${heading}</strong><br>${detail} Si necesitas cambiarla, comunícate con Titulación.`;
}
$('answer').addEventListener('submit',e=>{e.preventDefault();busy($('sendButton'),async()=>{
  if(!selected)throw Error('Consulta tus datos nuevamente.');
  const target={...selected},city=new FormData($('answer')).get('sede');
  if(!['Quito','Manta'].includes(city)||!$('consent').checked)throw Error('Selecciona una sede y confirma tu elección.');
  if(!confirm(`¿Confirmas que deseas incorporarte en ${city}?`))return;
  await runTransaction(db,async tx=>{
    const institutional=await tx.get(doc(db,'Estudiante',target.cedula));
    const responseRef=doc(db,responsesCollection,target.id),existing=await tx.get(responseRef);
    if(!institutional.exists()||institutional.data().eliminado)throw Error('La cédula ya no figura en la base institucional.');
    if(existing.exists())throw Error('Tu respuesta ya está registrada. Consulta nuevamente tu cédula.');
    const {cedula,nombres,carrera,periodoId,sedeOrigen}=target;
    tx.set(doc(db,rosterCollection,target.id),{cedula,nombres,carrera,periodoId,sedeOrigen,activo:true},{merge:true});
    tx.set(responseRef,{cedula,nombres,carrera,periodoId,sedeOrigen,sedeElegida:city,consentimiento:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});
  });
  if(selected?.id===target.id){showReceipt(city,true);notice('');}
});});
$('login').addEventListener('submit',e=>{e.preventDefault();if($('password').value!=='5626'){notice('PIN incorrecto.',true);$('password').value='';return;}authorized=true;sessionStorage.setItem('inc_admin','1');$('password').value='';openAdmin();});
$('logout').addEventListener('click',()=>{authorized=false;sessionStorage.removeItem('inc_admin');rows=[];adminLoadVersion++;adminUI?.clear();$('rows').replaceChildren();$('dashboard').hidden=true;$('logout').hidden=true;$('login').hidden=false;notice('Sesión cerrada.');});
async function openAdmin(){if(!authorized)return;$('login').hidden=true;$('dashboard').hidden=false;$('logout').hidden=false;notice('');try{await loadPeriods();await loadAdmin();}catch(e){notice(explain(e),true);}}
async function loadAdmin(){
  if(!authorized)return;
  adminPeriod=$('adminPeriod').value;if(!adminPeriod)throw Error('No hay períodos activos en Firebase.');
  const period=adminPeriod,version=++adminLoadVersion;
  rows=[];adminUI?.render();$('toggle').disabled=true;
  const [config,roster,responses,students]=await Promise.all([getDoc(doc(db,configCollection,period)),getDocs(query(collection(db,rosterCollection),where('periodoId','==',period))),getDocs(query(collection(db,responsesCollection),where('periodoId','==',period))),list('Estudiante')]);
  if(!authorized||$('adminPeriod').value!==period||version!==adminLoadVersion)return;
  $('toggle').disabled=false;
  const contacts=new Map(students.filter(s=>!s.eliminado).map(s=>[String(s.cedula||s.id).trim(),s]));
  currentConfig=config.exists()?config.data():{abierta:false};
  const answers=new Map(responses.docs.map(d=>[d.id,d.data()]));
  const joined=new Map(roster.docs.filter(d=>d.data().activo).map(d=>[d.id,d.data()]));
  // Include respondents who were not synchronized or were later marked inactive.
  for(const d of responses.docs)if(!joined.has(d.id))joined.set(d.id,{...d.data(),activo:true});
  rows=[...joined].map(([id,student])=>{const a=answers.get(id),contact=contacts.get(student.cedula)||{};return {...student,celular:contact.celular||'',correoPersonal:contact.correoPersonal||'',correoInstitucional:contact.correoInstitucional||'',id,sedeElegida:a?.sedeElegida||'',fecha:a?.createdAt?.toDate?.().toLocaleString('es-EC',{timeZone:'America/Guayaquil'})||''};});
  $('toggle').textContent=currentConfig.abierta?'Cerrar encuesta':'Abrir encuesta';
  $('configStatus').textContent=`Acceso libre para estudiantes registrados · ${rows.length} estudiantes en el listado de este período. La sincronización es opcional.`;
  renderRows();
}
async function clearChoice(row){
  // Remove only the selected period's answer. Keep the student in the list as pending.
  if(!authorized||!row||row.periodoId!==adminPeriod||!row.sedeElegida)throw Error('Actualiza el listado antes de borrar esta elección.');
  if(!confirm(`¿Borrar la sede ${row.sedeElegida} elegida por ${row.nombres} (${row.cedula})? El estudiante podrá volver a elegir.`))return;
  const id=recordId(row.periodoId,row.cedula),answerRef=doc(db,responsesCollection,id);
  await runTransaction(db,async tx=>{
    const existing=await tx.get(answerRef);
    if(!existing.exists()||existing.data().sedeElegida!==row.sedeElegida)throw Error('La elección cambió o ya fue eliminada. Actualiza el listado.');
    const {cedula,nombres,carrera,periodoId,sedeOrigen}=existing.data();
    tx.set(doc(db,rosterCollection,id),{cedula,nombres,carrera,periodoId,sedeOrigen:sedeOrigen||'',activo:true},{merge:true});
    tx.delete(answerRef);
  });
  await loadAdmin();
  notice(`Se borró la elección de ${row.nombres}. Puede volver a escoger Quito o Manta.`);
}
function filtered(){return filterRows(rows,{search:$('search').value,city:$('city').value,career:$('career').value,status:$('status').value});}
function renderRows(){adminUI?.render();}
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
    await loadAdmin();notice(`Padrón sincronizado: ${roster.length} estudiantes activos. Todos los estudiantes registrados pueden elegir sede sin habilitación previa.`);
  }catch(e){await loadAdmin().catch(()=>{});throw Error(`${explain(e)} La sincronización no se completó, pero los estudiantes registrados pueden seguir eligiendo sede.`);}finally{$('adminPeriod').disabled=false;$('toggle').disabled=false;$('toggle').textContent=currentConfig.abierta?'Cerrar encuesta':'Abrir encuesta';}
}));
$('export').addEventListener('click',()=>{if(!authorized)return;const blob=new Blob([csv(filtered())],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`incorporaciones_${adminPeriod}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('survey').hidden=adminPage;$('admin').hidden=!adminPage;
if(adminPage){adminUI=setupAdmin({getRows:()=>rows,getPeriodLabel:()=>periods.find(p=>p.id===adminPeriod)?.label||adminPeriod,isAuthorized:()=>authorized,notice,onClearChoice:(row,button)=>busy(button,()=>clearChoice(row))});authorized=sessionStorage.getItem('inc_admin')==='1';if(authorized)openAdmin();}
