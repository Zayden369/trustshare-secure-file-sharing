export const CONSTRUCTION_DURATION = 13500;
const regions = [
  ['shell',0,900,50,48],['sidebar',900,2100,11,45],['navbar',900,2200,59,10],
  ['heading',2200,3300,41,23],['metric-files',3300,4700,33,38],
  ['metric-shares',3300,4800,58,38],['metric-storage',3300,4800,82,38],
  ['file-brief',4700,6700,35,58],['file-notes',4700,6800,35,70],
  ['file-plan',4700,6900,35,82],['chart',4800,8000,77,63],
  ['storage',7900,9800,76,85],['navigation',2100,4300,11,66],
  ['controls',9600,11200,90,23],['details',11000,12200,53,93],
];
export const CONSTRUCTION_TASKS = regions.map(([id,start,end,x,y])=>({id,start,end,x,y}));
export const AGENT_LABELS=['Layout','Navigation','Interface','Typography','Files','Components','Analytics','Detail','Structure','Motion','Controls','Archive','Grid','Alignment','Surface','Finish'];
export const clamp = value=>Math.max(0,Math.min(1,value));
export const ease = value=>{const t=clamp(value);return t*t*(3-2*t);};
export function constructionFrame(elapsed,count) {
  const time=Math.max(0,Math.min(CONSTRUCTION_DURATION,elapsed));
  return {
    complete:time>=CONSTRUCTION_DURATION,
    tasks:CONSTRUCTION_TASKS.map(task=>({...task,progress:ease((time-task.start)/(task.end-task.start))})),
    agents:Array.from({length:count},(_,index)=>{
      const queue=CONSTRUCTION_TASKS.filter((_,i)=>i%count===index);
      const task=queue.find(item=>time<item.end)||queue[queue.length-1];
      if(!task)return {x:50,y:50,opacity:0,working:false};
      const previous=queue[Math.max(0,queue.indexOf(task)-1)];
      const arrival=ease((time-task.start+600)/900);
      const source=previous===task?{x:index%2?102:-2,y:12+index*4}:previous;
      const working=time>=task.start&&time<task.end;
      const stroke=working?Math.sin(clamp((time-task.start)/(task.end-task.start))*Math.PI)*3:0;
      const exit=ease((time-12200)/1300);
      return {x:source.x+(task.x-source.x)*arrival+stroke+exit*(index%2?18:-18),
        y:source.y+(task.y-source.y)*arrival+stroke*.4-exit*12,
        opacity:ease(time/700)*(1-exit),working};
    }),
  };
}
