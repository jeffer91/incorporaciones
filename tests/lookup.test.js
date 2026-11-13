import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {validId,recordId,chooseEnrollment} from '../public/domain.js';
function setup(getProfile){
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'0123456789',hidden:true,textContent:'',innerHTML:'',addEventListener(){},reset(){}});return elements.get(id);};
 const context=vm.createContext({document:{getElementById:element},location:{pathname:'/'},initializeApp:()=>({}),getFirestore:()=>({}),validId,recordId,chooseEnrollment,console:{error(){}},setTimeout,clearTimeout,doc:(_,name,id)=>({name,id}),collection:(_,name)=>name,getDoc:getProfile,getDocs:async()=>({docs:[]})});
 const code=readFileSync(new URL('../public/app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(code,context);return {context,element};
}
test('muestra nombre y carrera sin períodos abiertos ni padrón',async()=>{
 const {context,element}=setup(async()=>({exists:()=>true,data:()=>({nombres:'ESTUDIANTE',nombreCarreraActual:'Redes'})}));
 await vm.runInContext('lookupStudent()',context);
 assert.equal(element('student').hidden,false);
 assert.match(element('studentData').innerHTML,/ESTUDIANTE/);assert.match(element('studentData').innerHTML,/Redes/);
 assert.equal(element('answer').hidden,true);assert.match(element('receipt').textContent,/aún no está habilitada/);
});
test('no muestra perfiles inexistentes',async()=>{
 const {context,element}=setup(async()=>({exists:()=>false}));await vm.runInContext('lookupStudent()',context);
 assert.equal(element('student').hidden,true);assert.match(element('notice').textContent,/No encontramos/);
});
test('descarta una consulta obsoleta tras cambiar cédula',async()=>{
 let resolve;const {context,element}=setup(()=>new Promise(r=>resolve=r));const pending=vm.runInContext('lookupStudent()',context);
 vm.runInContext('lookupVersion++;resetStudent()',context);resolve({exists:()=>true,data:()=>({nombres:'ANTERIOR'})});await pending;
 assert.equal(element('student').hidden,true);assert.equal(element('studentData').innerHTML,'');
});
