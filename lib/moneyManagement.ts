// lib/moneyManagement.ts

export type GroupType = "Gruppo Live" | "Gruppo Elite Pro" | "Bot";

export type MoneyManagementConfig = {
  baseRiskPercent: number;       // es. 0.01 = 1% per trade
  kellyFactor: number;           // es. 0.25 = 25% del Kelly
  maxDailyLossPercent: number;   // es. 0.04 = 4% equity/giorno
  maxConsecutiveLosses: number;  // es. 3 perdite di fila
  // ⭐ nuovi campi aggiunti
  stakeMinimo: number;         // minimo in €
  recoveryReduction: number;   // riduzione dello stake in modalità recovery (0.7 = 70%)
};



export type StatsInput = {
  equity: number;
  winRateUser: number;
  winRateGroup: number;
  payout: number;           // es. 0.84 = 84%
  consecutiveLosses: number;
  dailyPnLPercent: number;  // es. -0.03 = -3% nel giorno
};

export type StakeSuggestion = {
  allowed: boolean;
  reason?: string;
  suggestedStake: number;
  baseStake: number;
  kellyStake: number;
  usedRiskPercent: number;
  combinedWinRate: number;
};

export function calculateStakeSuggestion(
  config: MoneyManagementConfig,
  stats: StatsInput
): StakeSuggestion {
  const safeEquity = stats.equity > 0 ? stats.equity : 0;

  const baseRisk = Math.max(config.baseRiskPercent, 0);
  const baseStake = safeEquity * baseRisk;

  // Winrate combinato (60% tuo, 40% del gruppo)
  const combinedWRRaw =
    stats.winRateUser * 0.6 + stats.winRateGroup * 0.4;

  // Clamp tra 1% e 99% per evitare numeri strani
  const combinedWinRate = Math.min(Math.max(combinedWRRaw, 0.01), 0.99);

  const b = stats.payout; // payout (0.8 / 0.9 / ecc.)
  let kellyFraction = 0;

  if (b > 0) {
    kellyFraction = (combinedWinRate * (b + 1) - 1) / b;
  }

  if (!isFinite(kellyFraction) || kellyFraction < 0) {
    kellyFraction = 0;
  }

  const adjustedKelly = kellyFraction * config.kellyFactor; // Kelly ridotto
  const usedRiskPercent = Math.max(baseRisk, adjustedKelly);
  const kellyStake = safeEquity * adjustedKelly;
  const suggestedStake = safeEquity * usedRiskPercent;

  // Sicurezza: limiti
  if (stats.dailyPnLPercent <= -config.maxDailyLossPercent) {
    return {
      allowed: false,
      reason: "Limite di perdita giornaliera raggiunto",
      suggestedStake: 0,
      baseStake,
      kellyStake,
      usedRiskPercent: 0,
      combinedWinRate,
    };
  }

  if (stats.consecutiveLosses >= config.maxConsecutiveLosses) {
    return {
      allowed: false,
      reason: "Limite di perdite consecutive raggiunto",
      suggestedStake: 0,
      baseStake,
      kellyStake,
      usedRiskPercent: 0,
      combinedWinRate,
    };
  }

  return {
    allowed: true,
    suggestedStake,
    baseStake,
    kellyStake,
    usedRiskPercent,
    combinedWinRate,
  };
}
