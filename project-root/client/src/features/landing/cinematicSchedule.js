const clamp = v => Math.max(0, Math.min(1, v));
const smooth = v => {const t=clamp(v);return t*t*(3-2*t);};
const mix = (a,b,t)=>a+(b-a)*t;
export const STORY_STAGES = ['Independent information','A considered collection','Protected by design','Authorized connections','One working space'];
export function cinematicFrame(progress) {
  const p=clamp(progress), organize=smooth(p/.28), protect=smooth((p-.25)/.2), connect=smooth((p-.48)/.22), workspace=smooth((p-.72)/.25);
  const loose=[[70,50,-13],[310,24,11],[450,180,-7],[250,320,8]];
  return {organize, protect, connect, workspace, stage:Math.min(4,Math.floor(p*5)),
    cards:loose.map(([x,y,angle],i)=>({x:mix(mix(x,180+(i%2)*135,organize),222+(i%2)*118,workspace), y:mix(mix(y,105+Math.floor(i/2)*155,organize),130+Math.floor(i/2)*125,workspace), angle:mix(angle,0,organize), scale:mix(1,.78,workspace)}))};
}
