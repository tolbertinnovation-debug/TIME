// UI routing only. The API independently checks the database role for every request.
export function portalPage(role){
 return ({student:'student-login.html',lecturer:'lecturer-login.html',admin:'admin-login.html'})[role]||'account.html';
}
export function portalAccess(portal,role){
 return ['student','lecturer','admin'].includes(portal)&&portal===role;
}
