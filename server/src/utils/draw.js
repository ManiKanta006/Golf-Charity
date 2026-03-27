function uniqueSorted(numbers) {
  return [...new Set(numbers)].sort((a, b) => a - b);
}

function toInt(value) {
  return Number.parseInt(value, 10);
}

export function normalizeUserNumbers(scores) {
  return uniqueSorted(scores.map((s) => toInt(s.score)).filter((n) => n >= 1 && n <= 45)).slice(0, 5);
}

export function randomDrawNumbers() {
  const pool = Array.from({ length: 45 }, (_, i) => i + 1);
  const result = [];
  while (result.length < 5 && pool.length) {
    const pick = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(pick, 1)[0]);
  }
  return uniqueSorted(result);
}

export function algorithmicDrawNumbers(allScores) {
  const freq = new Map();
  for (const row of allScores) {
    const n = toInt(row.score);
    if (n >= 1 && n <= 45) {
      freq.set(n, (freq.get(n) || 0) + 1);
    }
  }

  const ranked = Array.from({ length: 45 }, (_, i) => i + 1)
    .map((n) => ({ n, f: freq.get(n) || 0 }))
    .sort((a, b) => a.f - b.f || a.n - b.n);

  // Bias toward less frequent values to keep draw distribution fresh.
  return uniqueSorted(ranked.slice(0, 5).map((x) => x.n));
}

export function countMatches(userNumbers, winningNumbers) {
  const set = new Set(winningNumbers);
  return userNumbers.filter((n) => set.has(n)).length;
}

export function calculatePrizeTiers(totalPrizePool, carryover = 0) {
  const base = Number(totalPrizePool || 0);
  const jackpot = base * 0.4 + Number(carryover || 0);
  const fourMatch = base * 0.35;
  const threeMatch = base * 0.25;

  return {
    5: Number(jackpot.toFixed(2)),
    4: Number(fourMatch.toFixed(2)),
    3: Number(threeMatch.toFixed(2))
  };
}

export function buildDrawPreview({ users, winningNumbers, totalPrizePool, carryover }) {
  const tierWinners = { 5: [], 4: [], 3: [] };

  for (const user of users) {
    const parsed = JSON.parse(user.numbers_json || "[]");
    const matches = countMatches(parsed, winningNumbers);
    if (matches >= 3) {
      tierWinners[matches].push({
        userId: user.user_id,
        name: user.name,
        numbers: parsed,
        matches
      });
    }
  }

  const tierPools = calculatePrizeTiers(totalPrizePool, carryover);
  const payouts = [5, 4, 3].map((tier) => {
    const winners = tierWinners[tier].length;
    const perWinner = winners > 0 ? tierPools[tier] / winners : 0;
    return {
      tier,
      winners,
      totalPool: Number(tierPools[tier].toFixed(2)),
      perWinner: Number(perWinner.toFixed(2))
    };
  });

  const nextCarryover = payouts[0].winners === 0 ? payouts[0].totalPool : 0;

  return {
    winningNumbers,
    payouts,
    nextCarryover,
    tierWinners
  };
}
