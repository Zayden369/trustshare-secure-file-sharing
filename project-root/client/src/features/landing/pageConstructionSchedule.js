export const fraction = value => Math.max(0, Math.min(1, value));

export const INTRO_DEADLINE = 20000;
export const INTRO_TOUR_DURATION = 19000;

export function viewportTour(pageHeight, viewportHeight) {
  const maximum = Math.max(0, pageHeight - viewportHeight);
  const stride = Math.max(240, viewportHeight) * .72;
  const positions = [0];
  while (positions[positions.length - 1] < maximum) positions.push(Math.min(maximum, positions[positions.length - 1] + stride));
  const slot = INTRO_TOUR_DURATION / positions.length;
  const travel = Math.min(360, slot * .28);
  return {positions, travel, hold:slot - travel};
}

// Independent timelines: activation is monotonic, including regions passed in one scroll.
export function activateRegions(regions, scrollTop, viewportHeight, bottom, time) {
  regions.forEach(region => {
    if (region.started === null && (bottom || region.top < scrollTop + viewportHeight * .96)) region.started = time;
  });
}

export function advanceConstruction(regions, time) {
  let total = 0, completed = 0, working = [];
  regions.forEach(region => region.tasks.forEach(task => {
    total += task.weight;
    if (region.started !== null) {
      const dependency = region.tasks.find(item => item.id === task.after);
      const start = region.started + task.delay + (dependency ? dependency.duration : 0);
      task.progress = fraction((time - start) / task.duration);
      if (task.progress > 0 && task.progress < 1) working.push(task);
    }
    if (task.progress === 1) completed += task.weight;
  }));
  // Count completed work, never scroll distance or an optimistic elapsed-time estimate.
  return {percent: total ? Math.floor(completed / total * 100) : 100, working};
}
