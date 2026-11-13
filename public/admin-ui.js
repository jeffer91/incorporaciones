import {filterRows} from './domain.js';
import {DEFAULT_SUBJECT,DEFAULT_MESSAGE,emailsFor,allEmails,phoneFor,messageFor,whatsappURL,outlookURL,communicationRows,statsFor,pageRows} from './communications.js';
const $=id=>document.getElementById(id);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function setupAdmin({getRows,getPeriodLabel,isAuthorized,notice}){
 let page=1,previousRows=null;
 const tabs=['estudiantes','comunicaciones','estadisticas','configuracion'];
 function navigate(){const target=location.hash.slice(1),active=tabs.includes(target)?target:'estudiantes';for(const t of tabs){$('page-'+t).hidden=t!==active;document.querySelector(`[data-page="${t}"]`).setAttribute('aria-current',t===active?'page':'false');}}
 window.addEventListener('hashchange',navigate);navigate();
 $('mailSubject').value=DEFAULT_SUBJECT;$('messageBody').value=DEFAULT_MESSAGE;
 function groupRows(){return communicationRows(getRows(),{group:$('commGroup').value,career:$('commCareer').value});}
 function body(row){return messageFor(row,getPeriodLabel(),$('messageBody').value.trim());}
 function mail(rows,global=false){return outlookURL({emails:allEmails(rows),subject:$('mailSubject').value.trim(),body:body(global?null:rows[0]),bcc:global,provider:$('outlookProvider').value});}
 function filters(){return filterRows(getRows(),{search:$('search').value,city:$('city').value,career:$('career').value,status:$('status').value});}
 function careers(){
   const values=[...new Set(getRows().map(r=>r.carrera))].sort((a,b)=>a.localeCompare(b,'es'));
   for(const id of ['career','commCareer']){const previous=$(id).value;$(id).innerHTML='<option value="">Todas las carreras</option>'+values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(previous))$(id).value=previous;}
 }
 function table(){
   const filtered=filters(),size=Number($('pageSize').value)||25,p=pageRows(filtered,page,size);page=p.page;
   $('resultCount').textContent=`${p.start}–${p.end} de ${filtered.length} resultados · ${getRows().length} estudiantes en el período`;
   $('pageInfo').textContent=`Página ${p.page} de ${p.pages}`;$('prevPage').disabled=page===1;$('nextPage').disabled=page===p.pages;
   $('rows').innerHTML=p.items.length?p.items.map(r=>{
     const phone=phoneFor(r.celular),emails=emailsFor(r);
     return `<tr><td><strong>${esc(r.nombres)}</strong><small>${esc(r.cedula)}</small></td><td>${esc(r.carrera)}</td><td><span class="badge ${esc(r.sedeElegida)}">${esc(r.sedeElegida||'Pendiente')}</span></td><td><div class="contact-actions">${phone?`<a class="contact whatsapp" href="${esc(whatsappURL(r,body(r)))}" target="_blank" rel="noopener noreferrer">WhatsApp</a>`:'<span class="contact-missing">Sin teléfono</span>'}${emails.length?`<button class="contact" data-email="${esc(r.id)}" title="${esc(emails.join(' · '))}">Outlook (${emails.length})</button>`:'<span class="contact-missing">Sin correo</span>'}</div></td></tr>`;
   }).join(''):'<tr><td colspan="4">No hay estudiantes en esta vista.</td></tr>';
 }
 function communications(){
   const group=groupRows(),emails=allEmails(group),without=group.filter(r=>!emailsFor(r).length).length;
   $('commCount').textContent=`${group.length} estudiantes · ${emails.length} correos únicos · ${without} sin correo válido`;
   $('emailList').value=emails.join('; ');$('messagePreview').value=body(null);
   $('globalMail').disabled=!emails.length||!isAuthorized();$('copyEmails').disabled=!emails.length||!isAuthorized();
   $('mailHelp').textContent=emails.length&&mail(group,true).length>1800?'El grupo o mensaje supera el tamaño recomendado para un enlace. Al abrir Outlook se mostrarán las instrucciones para copiar CCO y el mensaje.':'';
 }
 function stats(){
   const rows=getRows(),s=statsFor(rows);
   $('metrics').innerHTML=[['Habilitados',s.total],['Quito',s.quito],['Manta',s.manta],['Pendientes',s.pending]].map(([label,value])=>`<div class="metric"><span>${label}</span><strong>${value}</strong></div>`).join('');
   $('participation').value=s.rate;$('participationText').textContent=`${s.answered} de ${s.total} · ${s.rate}%`;
   const groups=new Map();for(const r of rows){if(!groups.has(r.carrera))groups.set(r.carrera,[]);groups.get(r.carrera).push(r);}
   $('careerStats').innerHTML=[...groups.entries()].sort(([a],[b])=>a.localeCompare(b,'es')).map(([career,list])=>{const s=statsFor(list);return `<tr><td>${esc(career)}</td><td>${s.total}</td><td>${s.quito}</td><td>${s.manta}</td><td>${s.pending}</td><td>${s.rate}%</td></tr>`;}).join('')||'<tr><td colspan="6">No hay estudiantes habilitados.</td></tr>';
 }
 function render(){if(previousRows!==getRows()){previousRows=getRows();page=1;careers();}table();communications();stats();}
 function openMail(target,global){
   if(!isAuthorized())return;
   if(!allEmails(target).length){notice('No hay correos válidos para estos destinatarios.',true);return;}
   let url=mail(target,global);
   if(url.length>1800){
     location.hash='comunicaciones';
     $('emailList').value=allEmails(target).join('; ');$('messagePreview').value=body(global?null:target[0]);
     $('mailHelp').textContent=`Se abrió un correo vacío en Outlook. Copia estas ${allEmails(target).length} direcciones en CCO y pega el mensaje de la vista previa. Revisa los destinatarios antes de enviar.`;
     url=outlookURL({subject:$('mailSubject').value.trim(),provider:$('outlookProvider').value});
   }
   window.open(url,'_blank','noopener,noreferrer');
 }
 $('rows').addEventListener('click',event=>{const button=event.target.closest('[data-email]');if(!button)return;const row=getRows().find(r=>r.id===button.dataset.email);if(row)openMail([row],false);});
 $('globalMail').addEventListener('click',()=>openMail(groupRows(),true));
 async function copy(id){if(!isAuthorized())return;const field=$(id);try{await navigator.clipboard.writeText(field.value);notice('Copiado. Puedes pegarlo en Outlook.');}catch{field.focus();field.select();notice('Texto seleccionado. Pulsa Ctrl+C para copiarlo.');}}
 $('copyEmails').addEventListener('click',()=>copy('emailList'));$('copyMessage').addEventListener('click',()=>copy('messagePreview'));
 for(const id of ['search','career','city','status','pageSize'])$(id).addEventListener('input',()=>{page=1;table();});
 $('prevPage').addEventListener('click',()=>{page--;table();});$('nextPage').addEventListener('click',()=>{page++;table();});
 for(const id of ['commGroup','commCareer','outlookProvider','mailSubject','messageBody'])$(id).addEventListener('input',()=>{communications();table();});
 function clear(){page=1;render();$('emailList').value='';$('messagePreview').value='';$('mailHelp').textContent='';}
 return {render,clear};
}
