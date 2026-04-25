function scoreJob(job) {
  const ageMinutes = Math.max(0, (Date.now() - new Date(job.enqueuedAt || job.createdAt || Date.now()).getTime()) / 60000);
  const imageBonus = Math.max(1, Number(job.image_count || job.fileCount || 1));
  return Math.round(ageMinutes * 5 + imageBonus * 10);
}

export function selectJobsWithKnapsack(jobs, capacity) {
  const boundedCapacity = Math.max(1, Math.floor(capacity));
  const items = jobs.map((job) => ({
    job,
    weight: Math.max(1, Math.floor(Number(job.image_count || job.fileCount || 1))),
    value: scoreJob(job)
  }));

  const dp = Array.from({ length: items.length + 1 }, () => Array(boundedCapacity + 1).fill(0));

  for (let i = 1; i <= items.length; i += 1) {
    const { weight, value } = items[i - 1];
    for (let current = 0; current <= boundedCapacity; current += 1) {
      dp[i][current] = dp[i - 1][current];
      if (weight <= current) {
        const candidate = dp[i - 1][current - weight] + value;
        if (candidate > dp[i][current]) {
          dp[i][current] = candidate;
        }
      }
    }
  }

  const selected = [];
  let current = boundedCapacity;

  for (let i = items.length; i > 0; i -= 1) {
    if (dp[i][current] !== dp[i - 1][current]) {
      selected.push(items[i - 1].job);
      current -= items[i - 1].weight;
    }
  }

  return selected.reverse();
}
