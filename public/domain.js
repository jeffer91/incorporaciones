export const cleanId = value => String(value || '').trim();
export const validId = value => /^\d{10}$/.test(cleanId(value));
export const recordId = (periodo, cedula) => `${periodo}__${cedula}`;
export const activeEnrollment = m => !m.eliminado && !m.retirado && String(m.estadoMatricula).toUpperCase() === 'ACTIVO';
export function buildRoster(students, enrollments, period) {
  const byId = new Map(students.filter(s => !s.eliminado).map(s => [cleanId(s.cedula || s.id), s]));
  const roster = new Map();
  for (const m of enrollments) {
    const s = byId.get(cleanId(m.cedula));
    if (m.periodoId !== period || !activeEnrollment(m) || !s || !validId(m.cedula)) continue;
    const row = {cedula: cleanId(m.cedula), nombres:s.nombres || '', carrera:m.nombreCarrera || s.nombreCarreraActual || '', periodoId:period, sedeOrigen:m.sede || s.sede || '', activo:true};
    roster.set(recordId(period, row.cedula), row);
  }
  return [...roster.values()];
}
export function filterRows(rows, {search='', city='', career='', status=''}) {
  const normalize = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  return rows.filter(r => (!search || normalize(`${r.cedula} ${r.nombres} ${r.carrera}`).includes(normalize(search))) && (!city || r.sedeElegida===city) && (!career || r.carrera===career) && (!status || (status==='pendiente' ? !r.sedeElegida : !!r.sedeElegida)));
}
export function csv(rows) {
  const cell = value => '"'+String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replaceAll('"','""')+'"';
  const keys = ['cedula','nombres','carrera','periodoId','sedeOrigen','sedeElegida','fecha'];
  return '\ufeff'+[keys,...rows.map(r=>keys.map(k=>r[k]||''))].map(row=>row.map(cell).join(';')).join('\r\n');
}

// Prefer the latest eligible open enrollment when a student belongs to multiple cohorts.
export function chooseEnrollment(matches) {
  return matches.filter(r=>r?.activo).sort((a,b)=>b.periodoId.localeCompare(a.periodoId))[0] || null;
}
