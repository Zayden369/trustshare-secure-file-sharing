import {activateRegions,advanceConstruction} from './pageConstructionSchedule';
import {cinematicFrame} from './cinematicSchedule';
const region=(top,id)=>({top,started:null,tasks:[{id,progress:0,weight:2,duration:1000,delay:0}]});
test('fast scrolling activates passed regions without falsely completing work',()=>{
  const regions=[region(0,'hero'),region(2000,'middle'),region(8000,'footer')];
  activateRegions(regions,0,800,false,0);
  expect(advanceConstruction(regions,500).percent).toBe(0);
  activateRegions(regions,8000,800,true,500);
  expect(advanceConstruction(regions,500).percent).toBe(0);
  expect(regions.map(r=>r.started)).toEqual([0,500,500]);
  expect(advanceConstruction(regions,1100).percent).toBe(33);
  expect(advanceConstruction(regions,1600).percent).toBe(100);
});
test('reverse scrolling never resets activated timelines',()=>{
  const regions=[region(0,'hero'),region(1000,'next')];
  activateRegions(regions,1000,800,false,0);advanceConstruction(regions,1100);
  activateRegions(regions,0,800,false,1200);
  expect(advanceConstruction(regions,1200).percent).toBe(100);
});
test('dependent work follows structural completion and weights completed tasks only',()=>{
  const regions=[{top:0,started:0,tasks:[{id:'shell',weight:1,progress:0,duration:300,delay:0},{id:'art',after:'shell',weight:3,progress:0,duration:1000,delay:100}]}];
  expect(advanceConstruction(regions,350).percent).toBe(25);
  expect(regions[0].tasks[1].progress).toBe(0);
  expect(advanceConstruction(regions,1400).percent).toBe(100);
});
test('cinematic scenes form a reversible narrative with distinct document types',()=>{
  const start=cinematicFrame(0),middle=cinematicFrame(.55),end=cinematicFrame(1);
  expect(start.stage).toBe(0);expect(start.protect).toBe(0);
  expect(middle.organize).toBe(1);expect(middle.protect).toBe(1);
  expect(end.workspace).toBe(1);expect(end.connect).toBe(1);expect(end.stage).toBe(4);
  expect(start.cards[0].x).not.toBe(end.cards[0].x);
  expect(cinematicFrame(0)).toEqual(start);
});
