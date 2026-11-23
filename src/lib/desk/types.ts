// Copy of server/src/types.ts — keep the two files identical.

export type TF = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';
export const TIMEFRAMES: TF[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
export const TF_SECONDS: Record<TF, number> = {
  M1: 60,
  M5: 300,
  M15: 900,
  H1: 3600,
  H4: 14400,
  D1: 86400,
};

export type Dir = 'bull' | 'bear';
export type Trend = Dir | 'neutral';

/** time = candle open time, unix seconds */
export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Swing {
  time: number;
  price: number;
  kind: 'high' | 'low';
  label: 'HH' | 'HL' | 'LH' | 'LL' | 'H' | 'L';
}

export interface StructureEvent {
  type: 'BOS' | 'CHoCH';
  dir: Dir;
  price: number;
  /** time of the swing that was broken */
  fromTime: number;
  /** time of the candle that closed through it */
  time: number;
}

export interface OrderBlockFactors {
  displacement: boolean;
  fvg: boolean;
  sweep: boolean;
  /** bullish block in discount / bearish block in premium */
  goodLocation: boolean;
  fresh: boolean;
}

export interface OrderBlock {
  id: string;
  dir: Dir;
  top: number;
  bottom: number;
  time: number;
  createdTime: number;
  origin: 'BOS' | 'CHoCH';
  mitigated: boolean;
  mitigatedTime?: number;
  factors: OrderBlockFactors;
  /** 0–5, number of quality checks passed */
  score: number;
}

/** An order block that price closed through; it now acts in the opposite direction. */
export interface Breaker {
  id: string;
  dir: Dir;
  top: number;
  bottom: number;
  time: number;
  flippedTime: number;
}

export interface FVG {
  id: string;
  dir: Dir;
  top: number;
  bottom: number;
  time: number;
  mitigated: boolean;
}

export type LiquidityKind = 'EQH' | 'EQL' | 'PDH' | 'PDL' | 'PWH' | 'PWL' | 'SWING';

export interface LiquidityLevel {
  id: string;
  /** buy = buy-side liquidity resting above highs, sell = below lows */
  side: 'buy' | 'sell';
  kind: LiquidityKind;
  price: number;
  fromTime: number;
  swept: boolean;
}

export interface InducementLevel {
  id: string;
  obId: string;
  dir: Dir;
  price: number;
  fromTime: number;
  swept: boolean;
  sweptTime?: number;
}

export interface Sweep {
  time: number;
  price: number;
  side: 'buy' | 'sell';
}

export interface DealingRange {
  high: number;
  low: number;
  eq: number;
  fromTime: number;
}

export interface SessionBox {
  name: 'asia' | 'london' | 'newyork';
  start: number;
  end: number;
  high: number;
  low: number;
}

/** ICT Judas swing: a false move that sweeps one side of the Asian range, then closes back inside. */
export interface JudasSwing {
  /** direction of the expected real move, opposite to the sweep */
  dir: Dir;
  /** side of the Asian range that was swept */
  side: 'high' | 'low';
  /** the Asian high or low that was taken */
  level: number;
  /** furthest price of the false move */
  extreme: number;
  /** candle that closed back inside the range */
  time: number;
}

export interface KeyLevel {
  /** DO = UTC daily open, NYO = New York 00:00 open, WO = weekly open, ROUND = round number */
  kind: 'DO' | 'NYO' | 'WO' | 'ROUND';
  price: number;
  fromTime: number;
}

export interface OteZone {
  dir: Dir;
  top: number;
  bottom: number;
  fromTime: number;
}

export interface SmtSignal {
  dir: Dir;
  peer: string;
  inverse: boolean;
  time: number;
  primaryFrom: number;
  primaryTo: number;
  peerFrom: number;
  peerTo: number;
}

export type CheckKey = 'structure' | 'htf' | 'location' | 'displacement' | 'fvg' | 'sweep' | 'fresh' | 'killzone' | 'judas' | 'nyo' | 'inducement' | 'smt';
export const CHECK_KEYS: readonly CheckKey[] = [
  'structure',
  'htf',
  'location',
  'displacement',
  'fvg',
  'sweep',
  'fresh',
  'killzone',
  'judas',
  'nyo',
  'inducement',
  'smt',
];
export type TargetKind = LiquidityKind | 'RANGE' | 'FIXED';
export type NoteCode = '' | 'few_candles' | 'no_structure' | 'weak_zones' | 'no_zone';
export type Grade = 'A' | 'B' | 'C';

export interface SetupCheck {
  key: CheckKey;
  ok: boolean;
}

export interface Setup {
  dir: Dir;
  obId: string;
  zoneTop: number;
  zoneBottom: number;
  entry: number;
  stop: number;
  target: number;
  targetKind: TargetKind;
  rr: number;
  grade: Grade;
  checks: SetupCheck[];
  /** price has already returned into the zone */
  tapped: boolean;
}

export interface Analysis {
  symbol: string;
  tf: TF;
  trend: Trend;
  htf: TF | null;
  htfTrend: Trend | null;
  atr: number;
  lastClose: number;
  lastTime: number;
  swings: Swing[];
  events: StructureEvent[];
  orderBlocks: OrderBlock[];
  breakers: Breaker[];
  fvgs: FVG[];
  liquidity: LiquidityLevel[];
  inducements: InducementLevel[];
  sweeps: Sweep[];
  range: DealingRange | null;
  ote: OteZone | null;
  sessions: SessionBox[];
  /** today's finished Asian range (intraday only) */
  asia: SessionBox | null;
  judas: JudasSwing | null;
  smt: SmtSignal | null;
  levels: KeyLevel[];
  setup: Setup | null;
  /** why there is no setup */
  setupNote: NoteCode;
}

export type Bias = Record<TF, Trend>;

// ---- Backtest ----------------------------------------------------------------
export type ExitReason = 'tp' | 'sl' | 'be';
export type SessionKey = 'asia' | 'london' | 'newyork' | 'off';
export type WeekdayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export const SESSION_KEYS: readonly SessionKey[] = ['asia', 'london', 'newyork', 'off'];
export const WEEKDAY_KEYS: readonly WeekdayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export interface BacktestConfig {
  /** Bid/Ask spread in price units */
  spread: number;
  /** Round-trip commission and slippage in R */
  commissionR: number;
  /** Close 50% at +1R when target > 1R */
  partialTp: boolean;
  /** Move stop loss to entry after +1R is reached */
  breakEven: boolean;
}

export interface BacktestTrade {
  dir: Dir;
  grade: Grade;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  signalTime: number;
  entryTime: number;
  exitTime: number;
  /** Realized R after partial TP, break-even and costs */
  resultR: number;
  exitReason?: ExitReason;
  checks?: SetupCheck[];
}

export interface BacktestStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalR: number;
  avgR: number;
  expectancy: number;
  avgWinR: number;
  avgLossR: number;
  profitFactor: number | null;
  maxDrawdownR: number;
  /** setups that never filled */
  cancelled: number;
}

export interface CheckBreakdown {
  passed: BacktestStats;
  failed: BacktestStats;
}

export type CheckWeights = Record<CheckKey, number>;

export interface CalibrationRow {
  key: CheckKey;
  passedTrades: number;
  passedWinRate: number;
  passedAvgR: number;
  failedTrades: number;
  failedWinRate: number;
  failedAvgR: number;
  liftR: number;
  weight: number;
}

export interface WalkForwardSlice {
  candles: number;
  from: number;
  to: number;
  stats: BacktestStats;
  byGrade: Record<Grade, BacktestStats>;
}

export interface WalkForwardReport {
  splitRatio: number;
  splitTime: number;
  tunedWeights: CheckWeights;
  inSample: WalkForwardSlice;
  outOfSample: WalkForwardSlice;
}

export interface BacktestResult {
  symbol: string;
  tf: TF;
  digits: number;
  candles: number;
  from: number;
  to: number;
  config?: BacktestConfig;
  stats: BacktestStats;
  byGrade: Record<Grade, BacktestStats>;
  byCalibratedGrade: Record<Grade, BacktestStats>;
  bySession: Record<SessionKey, BacktestStats>;
  byWeekday: Record<WeekdayKey, BacktestStats>;
  byCheck: Record<CheckKey, CheckBreakdown>;
  calibration: CalibrationRow[];
  weights: CheckWeights;
  walkForward?: WalkForwardReport;
  trades: BacktestTrade[];
}

// ---- Journal -----------------------------------------------------------------
export type TradeStatus = 'pending' | 'open' | 'won' | 'lost' | 'cancelled' | 'closed';
export type Emotion = 'calm' | 'confident' | 'fomo' | 'revenge' | 'fear' | 'bored';

export interface JournalTrade {
  id: string;
  symbol: string;
  tf: TF;
  dir: Dir;
  grade: Grade | null;
  entry: number;
  stop: number;
  target: number;
  rr: number;
  digits: number;
  /** candle-time basis (same clock as the chart), unix seconds */
  createdAt: number;
  filledAt?: number;
  closedAt?: number;
  status: TradeStatus;
  resultR?: number;
  emotion: Emotion;
  note: string;
  source?: 'paper' | 'mt5';
  externalId?: string;
  pnlUsd?: number;
  volume?: number;
  exitPrice?: number;
  chartImage?: string;
}

export interface JournalBucketStats {
  trades: number;
  wins: number;
  winRate: number;
  totalR: number;
  avgR: number;
  totalUsd: number;
  rTrades: number;
  usdTrades: number;
}

export interface JournalEquityPoint {
  time: number;
  cumulativeR: number;
  cumulativeUsd: number;
}

export interface CalendarDayCell {
  date: string;
  weekday: number;
  trades: number;
  wins: number;
  totalR: number;
  totalUsd: number;
}

export type SetupBucketKey = Grade | 'none';

export interface JournalAnalytics {
  overall: JournalBucketStats;
  byGrade: Record<SetupBucketKey, JournalBucketStats>;
  bySession: Record<SessionKey, JournalBucketStats>;
  byWeekday: Record<WeekdayKey, JournalBucketStats>;
  equityCurve: JournalEquityPoint[];
  calendarDays: CalendarDayCell[];
}

export interface AccountSummary {
  login: number;
  server: string;
  currency: string;
  leverage: number;
  balance: number;
  equity: number;
  margin: number;
  marginFree: number;
  profit: number;
}

export interface OpenPosition {
  ticket: number;
  symbol: string;
  dir: Dir;
  volume: number;
  priceOpen: number;
  priceCurrent: number;
  sl: number | null;
  tp: number | null;
  profit: number;
  swap: number;
  time: number;
  digits: number;
  comment: string;
}

export interface Mt5Deal {
  ticket: number;
  positionId: number;
  symbol: string;
  side: 'buy' | 'sell';
  entry: number;
  volume: number;
  price: number;
  profit: number;
  commission: number;
  swap: number;
  time: number;
  digits: number;
  comment: string;
}

export interface AccountSnapshot {
  account: AccountSummary | null;
  positions: OpenPosition[];
  deals: Mt5Deal[];
  updatedAt: number;
}

export interface SymbolInfo {
  symbol: string;
  digits: number;
  tradeTickValue: number;
  tradeTickSize: number;
  tradeContractSize: number;
  volumeMin: number;
  volumeMax: number;
  volumeStep: number;
  currencyProfit: string;
}

export interface PositionSizeResult {
  lots: number;
  loss: number;
  exact: boolean;
  riskMoney: number;
}

export interface ScanRow {
  symbol: string;
  tf: TF;
  digits: number;
  price: number;
  trend: Trend;
  setup: { dir: Dir; grade: Grade; entry: number; rr: number; distance: number; tapped: boolean } | null;
}

// ---- Price & Zone Alerts -----------------------------------------------------
export type AlertCondition = 'above' | 'below' | 'zone_ob' | 'zone_fvg';

export interface PriceAlert {
  id: string;
  symbol: string;
  tf: TF;
  condition: AlertCondition;
  targetPrice: number | null;
  digits: number;
  note: string;
  active: boolean;
  createdAt: number;
  triggeredAt: number | null;
  lastMessage?: string;
}

// ---- WebSocket ---------------------------------------------------------------
export type ServerMessage =
  | {
      type: 'snapshot';
      symbol: string;
      tf: TF;
      digits: number;
      source: 'mock' | 'mt5';
      candles: Candle[];
      analysis: Analysis;
      bias: Bias;
      reaction: ReactionBrief | null;
    }
  | { type: 'tick'; symbol: string; tf: TF; candle: Candle }
  | { type: 'analysis'; symbol: string; tf: TF; analysis: Analysis; bias: Bias; reaction: ReactionBrief | null }
  | { type: 'alert'; alert: PriceAlert; message: string }
  | { type: 'error'; message: string };

export type ClientMessage = { type: 'subscribe'; symbol: string; tf: TF };

// ---- Economic News Calendar --------------------------------------------------
export type NewsImpact = 'High' | 'Medium' | 'Low';

export interface EconomicEvent {
  id: string;
  title: string;
  country: string;
  date: string;
  timestamp: number; // unix seconds
  impact: NewsImpact;
  forecast?: string;
  previous?: string;
}

export interface NewsAlert {
  active: boolean;
  event: EconomicEvent;
  minutesUntil: number; // negative if recently occurred
  level: 'warning' | 'caution';
}

export interface NewsResponse {
  events: EconomicEvent[];
  upcomingHighImpact: EconomicEvent[];
  nextEvent?: EconomicEvent | null;
  alert: NewsAlert | null;
}

export interface RiskGuardStatus {
  dayStartSec: number;
  tradesToday: number;
  maxTrades: number;
  /** Realized net R today (negative = net loss) */
  netR: number;
  /** Realized daily drawdown in R (>= 0) */
  lostR: number;
  /** Realized net P&L in USD today */
  netUsd: number;
  /** Floating P&L USD across open MT5 positions */
  floatingUsd: number;
  /** Effective loss in R including any negative floating drawdown */
  effectiveLostR: number;
  maxLossR: number;
  openPositions: number;
  riskMoneyUsd: number;
  tradesLimitHit: boolean;
  lossLimitHit: boolean;
  anyLimitHit: boolean;
}

export interface CurrencyStrengthRow {
  currency: string;
  /** 0–100 normalized strength (50 = neutral) */
  score: number;
  /** Average pairwise percentage change over lookback */
  changePct: number;
  pairsUsed: number;
}

export interface StrengthResponse {
  tf: TF;
  lookback: number;
  updatedAt: number;
  currencies: CurrencyStrengthRow[];
}


// ---- Reaction Zones ----------------------------------------------------------
export type ZoneGroup = 'ob' | 'fvg' | 'breaker' | 'ote' | 'liquidity' | 'asia' | 'level';
/** support = price came down into the zone (expected turn up); resistance = came up into it */
export type ZoneSide = 'support' | 'resistance';
export type ReactionOutcome = 'react' | 'fail' | 'timeout';
export type HtfAlign = 'with' | 'against' | 'none';
export type LocationBucket = 'discount' | 'premium' | 'none';
export type AdrBucket = 'lt50' | 'r50_80' | 'r80_100' | 'gt100' | 'na';
export type ObScoreBucket = 'low' | 'mid' | 'high' | 'na';
export type ConfluenceBucket = 'c0' | 'c1' | 'c2plus';

export interface TouchFeatures {
  htf: HtfAlign;
  location: LocationBucket;
  session: SessionKey;
  touchNo: 'first' | 'repeat';
  obScore: ObScoreBucket;
  adr: AdrBucket;
  confluence: ConfluenceBucket;
}

export interface ZoneTouch {
  /** candle time of the bar that entered the zone */
  time: number;
  group: ZoneGroup;
  /** OB, FVG, BRK, OTE, a LiquidityKind, ASIA_H, ASIA_L or a KeyLevel kind */
  kind: string;
  side: ZoneSide;
  outcome: ReactionOutcome;
  /** also travelled the second-tier distance before the zone failed */
  reactedTwo: boolean;
  /** reacted after piercing the far edge of a level band (liquidity sweep) */
  sweepReverse: boolean;
  /** deepest point as a fraction of zone height; above 1 = beyond the far edge */
  penetration: number;
  /** largest favourable move in ATR */
  mfeAtr: number;
  barsToReact: number | null;
  features: TouchFeatures;
}

export interface RateCell {
  n: number;
  reactions: number;
  /** shrunk reaction rate, 0–1 */
  rate: number;
  /** Wilson 95% interval of the raw rate */
  low: number;
  high: number;
  reactedTwo: number;
  sweepReverse: number;
  depthMedian: number;
  runMedian: number;
}

export interface CalibrationBin {
  lo: number;
  hi: number;
  n: number;
  predicted: number;
  realised: number;
}

export interface ReactionValidation {
  trainTouches: number;
  testTouches: number;
  /** out-of-sample Brier score of the per-kind base rate */
  brierBase: number | null;
  /** out-of-sample Brier score of base rate plus feature lifts */
  brierModel: number | null;
  /** feature lifts beat the base rate out of sample */
  validated: boolean;
  bins: CalibrationBin[];
}

export interface ReactionModel {
  version: number;
  symbol: string;
  tf: TF;
  builtAt: number;
  from: number;
  to: number;
  touches: number;
  overall: RateCell;
  /** keyed `${group}:${side}` */
  groups: Record<string, RateCell>;
  /** keyed `${kind}:${side}` */
  kinds: Record<string, RateCell>;
  /** log-odds lift per `${feature}:${bucket}` */
  lifts: Record<string, number>;
  validation: ReactionValidation;
}
export type ReactionReport = ReactionModel;

export interface AdrState {
  adr: number;
  /** today's range so far divided by ADR */
  used: number;
  todayHigh: number;
  todayLow: number;
  projectedLow: number;
  projectedHigh: number;
  days: number;
}

export interface ReactionZone {
  id: string;
  side: ZoneSide;
  group: ZoneGroup;
  kinds: string[];
  top: number;
  bottom: number;
  /** ATR distance from price to the near edge */
  distanceAtr: number;
  /** 0–1, null when there are too few past touches */
  probability: number | null;
  low: number | null;
  high: number | null;
  n: number;
  basis: 'kind' | 'group' | 'none';
  /** feature lifts applied (model validated out of sample) */
  adjusted: boolean;
  /** chance today's range stretches far enough to get there */
  reach: number | null;
  depthMedian: number | null;
  runMedian: number | null;
  /** zones merged into this cluster */
  members: number;
}

export interface ReactionBrief {
  price: number;
  atr: number;
  time: number;
  above: ReactionZone[];
  below: ReactionZone[];
  adr: AdrState | null;
  validated: boolean;
  touches: number;
  builtAt: number;
}

export type ExplainLang = 'en' | 'bn';

export interface ExplainResponse {
  configured: boolean;
  lang: ExplainLang;
  model: string | null;
  text: string | null;
  generatedAt: number;
}
