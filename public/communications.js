export const SURVEY_URL='https://jeffer91.github.io/incorporaciones/';
export const DEFAULT_SUBJECT='Elección de sede para la incorporación · ITSQMET';
export const DEFAULT_MESSAGE=`Selecciona la sede en la que deseas incorporarte: Quito o Manta.\n\nLa incorporación se realizará entre el 14 y el 16 de diciembre de 2026. La fecha exacta se comunicará posteriormente.\n\nIngresa con tu cédula: ${SURVEY_URL}\n\nUnidad de Titulación y Eficiencia Terminal · ITSQMET`;
export function emailsFor(row){
 return [...new Set([row.correoPersonal,row.correoInstitucional].map(x=>String(x||'').trim().toLowerCase()).filter(x=>/^[^\s@;,<>]+@[^\s@;,<>]+\.[^\s@;,<>]+$/.test(x)))];
}
export function allEmails(rows){return [...new Set(rows.flatMap(emailsFor))];}
export function phoneFor(value){
 let raw=String(value||'').trim();if(!raw||/[^\d+()\s.-]/.test(raw))return '';
 let n=raw.replace(/\D/g,'');
 if(n.startsWith('00'))n=n.slice(2);
 if(/^09\d{8}$/.test(n))return '593'+n.slice(1);
 if(/^9\d{8}$/.test(n))return '593'+n;
 if(/^5939\d{8}$/.test(n))return n;
 if((raw.startsWith('+')||raw.startsWith('00'))&&/^[1-9]\d{9,14}$/.test(n))return n;
 return '';
}
export function messageFor(row,periodLabel,body){
 return row?`Hola, ${row.nombres}.\nCarrera: ${row.carrera}.\nPeríodo: ${periodLabel}.\n\n${body}`:`Estimados estudiantes:\nPeríodo: ${periodLabel}.\n\n${body}`;
}
export function whatsappURL(row,message){const phone=phoneFor(row.celular);return phone?`https://wa.me/${phone}?text=${encodeURIComponent(message)}`:'';}
export function outlookURL({emails=[],subject='',body='',bcc=false,provider='office'}){
 const origin=provider==='personal'?'https://outlook.live.com/mail/0/deeplink/compose':'https://outlook.office.com/mail/deeplink/compose';
 const params=new URLSearchParams({subject,body});if(emails.length)params.set(bcc?'bcc':'to',emails.join(';'));
 return `${origin}?${params}`;
}
export function communicationRows(rows,{group='',career=''}){
 return rows.filter(r=>(!career||r.carrera===career)&&(!group||(group==='pendiente'?!r.sedeElegida:group==='respondio'?!!r.sedeElegida:r.sedeElegida===group)));
}
export function statsFor(rows){
 const result={total:rows.length,quito:0,manta:0,pending:0,answered:0,rate:0};
 for(const r of rows){if(r.sedeElegida==='Quito')result.quito++;else if(r.sedeElegida==='Manta')result.manta++;else result.pending++;}
 result.answered=result.quito+result.manta;result.rate=result.total?Math.round(result.answered/result.total*100):0;return result;
}
export function pageRows(rows,page=1,size=25){
 const pages=Math.max(1,Math.ceil(rows.length/size)),current=Math.max(1,Math.min(page,pages));
 return {items:rows.slice((current-1)*size,current*size),page:current,pages,start:rows.length?(current-1)*size+1:0,end:Math.min(current*size,rows.length)};
}
