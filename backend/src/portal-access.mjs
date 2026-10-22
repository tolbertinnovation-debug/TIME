// UI routing only. The API independently checks the database role for every request.
export function portalPage(role){
 const page=({student:'student-login.html',lecturer:'lecturer-login.html',admin:'admin-login.html'})[role]||'account.html';
 return page+'?v=20261022-course-access';
}
export function portalAccess(portal,role){
 return ['student','lecturer','admin'].includes(portal)&&portal===role;
}
