import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validId,recordId} from '../public/domain.js';
function setup(getProfile){
 const elements=new Map(),events=new Map();
 const element=id=>{
   if(!elements.has(id))elements.set(id,{value:id==='cedula'?'0123456789':'',hidden:true,checked:id==='consent',textContent:'',innerHTML:'',addEventListener(event,fn){events.set(id+':'+event,fn);},reset(){}});
   return elements.get(id);
 };
 const writes=[];
 const context=vm.createContext({
   document:{getElementById:element},location:{pathname:'/'},initializeApp:()=>({}),getFirestore:()=>({}),validId,recordId,
   console:{error(){}},setTimeout,clearTimeout,
   doc:(_,name,id)=>({name,id}),collection:(_,name)=>name,query:(name)=>({name}),where:()=>({}),
   getDoc:async ref=>ref.name==='Estudiante'?getProfile():{exists:()=>false},
   getDocs:async ref=>({docs:ref==='periodos'?[{id:'2026-04',data:()=>({label:'Abril 2026',activo:true})}]:[]}),
   runTransaction:async(_db,fn)=>fn({get:async ref=>ref.name==='Estudiante'?getProfile():{exists:()=>false},set:(ref,data)=>writes.push({ref,data})}),
   confirm:()=>true,serverTimestamp:()=>42,FormData:class{get(){return 'Manta';}}
 });
 const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(code,context);return {context,element,events,writes};
}
const profile=()=>({exists:()=>true,data:()=>({nombres:'ESTUDIANTE',nombreCarreraActual:'Redes'})});
test('permite elegir sede con matrícula o padrón ausentes y encuesta no abierta',async()=>{
 const {context,element}=setup(profile);
 await vm.runInContext('lookupStudent()',context);
 assert.equal(element('student').hidden,false);
 assert.match(element('studentData').innerHTML,/ESTUDIANTE/);
 assert.match(element('studentData').innerHTML,/Redes/);
 assert.equal(element('answer').hidden,false);
 assert.equal(element('receipt').hidden,true);
});
test('guarda automáticamente padrón y respuesta sin configuración abierta',async()=>{
 const {context,element,events,writes}=setup(profile);
 await vm.runInContext('lookupStudent()',context);
 events.get('answer:submit')({preventDefault(){}});
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(writes.length,2);
 assert.equal(writes[0].ref.name,'incorporaciones_padron');
 assert.equal(writes[0].data.activo,true);
 assert.equal(writes[1].ref.name,'incorporaciones_respuestas');
 assert.equal(writes[1].data.sedeElegida,'Manta');
 assert.match(element('receipt').innerHTML,/Manta/);
});
test('no muestra perfiles inexistentes',async()=>{
 const {context,element}=setup(async()=>({exists:()=>false}));
 await vm.runInContext('lookupStudent()',context);
 assert.equal(element('student').hidden,true);assert.match(element('notice').textContent,/No encontramos/);
});
test('descarta una consulta obsoleta tras cambiar cédula',async()=>{
 let resolve;const {context,element}=setup(()=>new Promise(r=>resolve=r));const pending=vm.runInContext('lookupStudent()',context);
 vm.runInContext('lookupVersion++;resetStudent()',context);resolve({exists:()=>true,data:()=>({nombres:'ANTERIOR'})});await pending;
 assert.equal(element('student').hidden,true);assert.equal(element('studentData').innerHTML,'');
});
