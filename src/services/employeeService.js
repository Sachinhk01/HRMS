import { getSection, setSection } from './localStorageService';
const key='users'; const all=()=>getSection(key)||[]; const save=v=>setSection(key,v);
const safe=u=>{const {password,...rest}=u;return rest};
export const getEmployees=()=>all().map(safe);
export function addEmployee(actor,data){if(actor?.role!=='HR_ADMIN')throw new Error('Only HR can add employees.'); if(!data.name?.trim()||!data.email?.trim()||!data.password)throw new Error('Name, email and password are required.'); if(all().some(x=>x.email.toLowerCase()===data.email.trim().toLowerCase()))throw new Error('Email already exists.'); const user={id:`user-${Date.now()}`,name:data.name.trim(),email:data.email.trim().toLowerCase(),password:data.password,role:data.role||'EMPLOYEE',title:data.title||'',department:data.department||'',phone:'',location:'',about:'',initials:data.name.trim().split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase(),createdAt:new Date().toISOString()}; save([...all(),user]); return safe(user);}
export function updateEmployee(actor,id,updates){if(actor?.role!=='HR_ADMIN')throw new Error('Only HR can edit employees.'); const next=all().map(x=>x.id===id?{...x,...updates,id}:x); save(next); return safe(next.find(x=>x.id===id));}
export function deleteEmployee(actor,id){if(actor?.role!=='HR_ADMIN')throw new Error('Only HR can delete employees.'); save(all().filter(x=>x.id!==id));}
