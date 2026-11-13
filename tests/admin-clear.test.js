import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function adminHarness({permit=true}={}){
 const elements=new Map();
 const element=id=>{
   if(!elements.has(id))elements.set(id,{
     value:id==='adminPeriod'?'2026-04':'',hidden:false,textContent:'',innerHTML:'',
     disabled:false,addEventListener(){},reset(){}
   });
   return elements.get(id);
 };
 const id='2026-04__0123456789';
 let response={cedula:'0123456789',nombres:'ANA',carrera:'Redes',periodoId:'2026-04',sedeOrigen:'',sedeElegida:'Quito'};
 let roster={cedula:'0123456789',nombres:'ANA',carrera:'Redes',periodoId:'2026-04',sedeOrigen:'',activo:false};
 const operations=[];
 let callbacks;
 const snap=(id,data)=>({id,data:()=>data,exists:()=>data!=null});
 const docs=(items)=>({docs:items});
 const context=vm.createContext({
   document:{getElementById:element},
   location:{pathname:'/admin.html'},
   sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},
   setupAdmin(args){callbacks=args;return {render(){},clear(){}};},
   initializeApp:()=>({}),getFirestore:()=>({}),console:{error(){}},
   doc:(_,name,id)=>({name,id}),collection:(_,name)=>name,query:name=>name,where:()=>({}),
   getDoc:async ref=>snap(ref.id,ref.name==='incorporaciones_config'?null:ref.name==='incorporaciones_respuestas'?response:null),
   getDocs:async ref=>{
     if(ref==='periodos')return docs([snap('2026-04',{label:'Abril 2026'})]);
     if(ref==='Estudiante')return docs([snap('0123456789',{nombres:'ANA',cedula:'0123456789'})]);
     if(ref==='incorporaciones_padron')return docs([snap(id,roster)]);
     if(ref==='incorporaciones_respuestas')return docs(response?[snap(id,response)]:[]);
     return docs([]);
   },
   runTransaction:async(_db,fn)=>fn({
     get:async ref=>snap(ref.id,ref.name==='incorporaciones_respuestas'?response:null),
     set:(ref,data)=>{operations.push({kind:'set',name:ref.name});if(ref.name==='incorporaciones_padron')roster={...roster,...data};},
     delete:ref=>{operations.push({kind:'delete',name:ref.name});if(ref.name==='incorporaciones_respuestas')response=null;}
   }),
   confirm:()=>permit,serverTimestamp:()=>42,setTimeout,clearTimeout
 });
 const source=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(source,context);
 return {context,element,operations,init:async()=>{
   await vm.runInContext("authorized=true; loadPeriods()",context);
   await vm.runInContext("loadAdmin()",context);
 },remove:async()=>callbacks.onClearChoice({id,cedula:'0123456789',nombres:'ANA',carrera:'Redes',periodoId:'2026-04',sedeElegida:'Quito'},element('clearButton')),
 response:()=>response,roster:()=>roster};
}

test('administrador borra solo la elección y mantiene estudiante pendiente',async()=>{
 const h=adminHarness();await h.init();
 await h.remove();
 assert.equal(h.response(),null);
 assert.equal(h.roster().activo,true);
 assert.deepEqual(h.operations.map(o=>o.kind+':'+o.name),[
   'set:incorporaciones_padron','delete:incorporaciones_respuestas'
 ]);
 assert.equal(vm.runInContext('rows.length',h.context),1);
 assert.equal(vm.runInContext('rows[0].sedeElegida',h.context),'');
 assert.match(h.element('notice').textContent,/Se borró la elección/);
});

test('si se cancela la confirmación no se borra la elección',async()=>{
 const h=adminHarness({permit:false});await h.init();await h.remove();
 assert.equal(h.response().sedeElegida,'Quito');
 assert.deepEqual(h.operations,[]);
});

test('el botón de anulación está conectado a la acción de administración',()=>{
 const source=readFileSync(new URL('../public/admin-ui.js',import.meta.url),'utf8');
 assert.match(source,/data-clear-choice/);
 assert.match(source,/onClearChoice\(row,clear\)/);
});
