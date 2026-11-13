import test from 'node:test';
import assert from 'node:assert/strict';
import {emailsFor,allEmails,phoneFor,messageFor,whatsappURL,outlookURL,communicationRows,statsFor,pageRows} from '../public/communications.js';
const row={nombres:'María Pérez',carrera:'Enfermería',celular:'099 123 4567',correoPersonal:' MARIA@example.com ',correoInstitucional:'maria@instituto.edu.ec'};
test('incluye ambos correos y deduplica direcciones sin distinguir mayúsculas',()=>{
 assert.deepEqual(emailsFor(row),['maria@example.com','maria@instituto.edu.ec']);
 assert.deepEqual(allEmails([row,{correoPersonal:'maria@EXAMPLE.com',correoInstitucional:'inválido'}]),emailsFor(row));
 assert.deepEqual(emailsFor({correoPersonal:'a@x.com;evil@x.com'}),[]);
});
test('WhatsApp normaliza Ecuador, conserva números internacionales explícitos y omite inválidos',()=>{
 assert.equal(phoneFor(row.celular),'593991234567');assert.equal(phoneFor('+593 99 123 4567'),'593991234567');
 assert.equal(phoneFor('991234567'),'593991234567');assert.equal(phoneFor('+1 (202) 555-0123'),'12025550123');
 assert.equal(phoneFor('abc0991234567'),'');assert.equal(phoneFor('123'),'');
 assert.match(whatsappURL(row,'Hola & gracias'),/^https:\/\/wa.me\/593991234567\?text=Hola%20%26%20gracias$/);
});
test('Outlook global solo usa CCO y conserva cuerpo, asunto y caracteres especiales',()=>{
 const url=new URL(outlookURL({emails:emailsFor(row),bcc:true,subject:'Invitación & sede',body:'Hola\nQuito / Manta'}));
 assert.equal(url.hostname,'outlook.office.com');assert.equal(url.searchParams.has('to'),false);
 assert.equal(url.searchParams.get('bcc'),'maria@example.com;maria@instituto.edu.ec');assert.equal(url.searchParams.get('body'),'Hola\nQuito / Manta');
 const individual=new URL(outlookURL({emails:emailsFor(row),provider:'personal'}));assert.equal(individual.hostname,'outlook.live.com');assert.equal(individual.searchParams.get('to'),emailsFor(row).join(';'));
});
test('mensajes individuales contienen nombre, carrera y período; global no incluye datos personales',()=>{
 const message=messageFor(row,'Abril a Septiembre 2026','Texto');assert.match(message,/María Pérez/);assert.match(message,/Enfermería/);assert.match(message,/Abril a Septiembre 2026/);
 assert.doesNotMatch(messageFor(null,'Periodo','Texto'),/María/);
});
test('paginación no limita el grupo global y filtra pendientes por carrera',()=>{
 const rows=Array.from({length:60},(_,i)=>({...row,correoPersonal:`a${i}@example.com`,sedeElegida:i<20?'Quito':i<40?'Manta':''}));
 assert.equal(pageRows(rows,2,25).items.length,25);assert.equal(pageRows(rows,3,25).items.length,10);assert.equal(pageRows(rows,999,25).page,3);
 assert.equal(communicationRows(rows,{group:'pendiente',career:'Enfermería'}).length,20);assert.equal(allEmails(communicationRows(rows,{})).length,61);
 assert.deepEqual(statsFor(rows),{total:60,quito:20,manta:20,pending:20,answered:40,rate:67});assert.equal(statsFor([]).rate,0);
});
