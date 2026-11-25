import {constructionFrame,CONSTRUCTION_DURATION,CONSTRUCTION_TASKS} from './constructionSchedule';
test.each([5,10,16,20])('all construction tasks finish independently of %i agents',count=>{
  const end=constructionFrame(CONSTRUCTION_DURATION,count);
  expect(end.complete).toBe(true);
  expect(end.tasks.every(task=>task.progress===1)).toBe(true);
  expect(end.agents.every(agent=>agent.opacity===0)).toBe(true);
  expect(CONSTRUCTION_DURATION).toBeLessThan(15000);
});
test('tasks overlap across independent queues and retain deterministic elapsed state',()=>{
  const frame=constructionFrame(4000,16);
  expect(frame.tasks.filter(t=>t.progress>0&&t.progress<1).length).toBeGreaterThan(2);
  expect(constructionFrame(8000,5)).toEqual(constructionFrame(8000,5));
  expect(new Set(CONSTRUCTION_TASKS.map(t=>t.id)).size).toBe(CONSTRUCTION_TASKS.length);
});
