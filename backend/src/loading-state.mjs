// Keep the indicator visible until every overlapping request has settled.
export function createLoadingTracker(render){
 const pending=new Map();let next=0;
 const update=()=>render(pending.size?[...pending.values()].at(-1):null);
 return async(message,operation)=>{
  const id=++next;pending.set(id,message);update();
  try{return await operation();}finally{pending.delete(id);update();}
 };
}
