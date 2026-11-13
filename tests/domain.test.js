import test from 'node:test';
import assert from 'node:assert/strict';
import {validId,recordId,buildRoster,filterRows,csv} from '../public/domain.js';
test('conserva ceros iniciales y separa períodos',()=>{assert.equal(validId('0123456789'),true);assert.equal(validId('123'),false);assert.notEqual(recordId('A','0123456789'),recordId('B','0123456789'));});
test('padrón excluye retirados, eliminados y otras cohortes',()=>{
 const students=[{cedula:'0123456789',nombres:'Uno'},{cedula:'0123456788',eliminado:true}];
 const enrollment={cedula:'0123456789',periodoId:'A',estadoMatricula:'ACTIVO',nombreCarrera:'Carrera histórica'};
 assert.equal(buildRoster(students,[enrollment,{...enrollment,periodoId:'B'},{...enrollment,cedula:'0123456788'}],'A').length,1);
 assert.equal(buildRoster(students,[{...enrollment,retirado:true}],'A').length,0);
 assert.equal(buildRoster(students,[{...enrollment,eliminado:true}],'A').length,0);
 assert.equal(buildRoster(students,[enrollment],'A')[0].carrera,'Carrera histórica');
});
test('filtros combinados consideran tildes, sede y estado',()=>{const rows=[{cedula:'01',nombres:'José',carrera:'Redes',sedeElegida:'Manta'},{cedula:'02',nombres:'Ana',carrera:'Redes',sedeElegida:''}];assert.equal(filterRows(rows,{search:'jose',city:'Manta'}).length,1);assert.equal(filterRows(rows,{status:'pendiente'})[0].nombres,'Ana');assert.equal(filterRows(rows,{search:'jose',status:'pendiente'}).length,0);});
test('CSV escapa comillas y neutraliza fórmulas',()=>{const value=csv([{cedula:'0123456789',nombres:'=HYPERLINK("x")'}]);assert.ok(value.includes('"0123456789"'));assert.ok(value.includes("\"'=HYPERLINK"));assert.ok(value.includes('""x""'));});
