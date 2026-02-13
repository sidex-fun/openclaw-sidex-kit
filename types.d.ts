// openclaw-sidex-kit — TypeScript Definitions

import { EventEmitter } from 'events';

// ═══════════════════════════════════════
//  EventBus
// ═══════════════════════════════════════

export interface PriceUpdateEvent {
    symbol: string;
    price: number;
    rsi?: number | null;
    ema20?: number | null;
    ema50?: number | null;
    atr?: number | null;
    volume?: number;
    timestamp: number;
}

export interface SurvivalChangeEvent {
    from: SurvivalState;
    to: SurvivalState;
    ratio: number;
    pnlPercent: number;
    balance: number;
}

export interface PositionEvent {
    id: string;
    symbol: string;
    side: 'buy' | 'sell';
    entryPrice: number;
    size: number;
    leverage: number;
    exchange: string;
    stopLoss: number | null;
    takeProfit: number | null;
    unrealizedPnl: number;
    openedAt: string;
    closedAt: string | null;
    closeReason: string | null;
    exitPrice?: number;
}

export interface AgentShutdownEvent {
    reason: string;
    balance: number;
}

export interface AgentErrorEvent {
    cycle: number;
    error: string;
}

interface AgentEventMap {
    'price:update': (data: PriceUpdateEvent) => void;
    'survival:change': (data: SurvivalChangeEvent) => void;
    'position:opened': (data: PositionEvent) => void;
    'position:closed': (data: PositionEvent) => void;
    'agent:shutdown': (data: AgentShutdownEvent) => void;
    'agent:error': (data: AgentErrorEvent) => void;
    'signal:new': (data: any) => void;
}

export class AgentEventBus extends EventEmitter {
    setDebug(enabled: boolean): void;
    emit<K extends keyof AgentEventMap>(event: K, ...args: Parameters<AgentEventMap[K]>): boolean;
    on<K extends keyof AgentEventMap>(event: K, listener: AgentEventMap[K]): this;
    once<K extends keyof AgentEventMap>(event: K, listener: AgentEventMap[K]): this;
    off<K extends keyof AgentEventMap>(event: K, listener: AgentEventMap[K]): this;
}

export const eventBus: AgentEventBus;

// ═══════════════════════════════════════
//  SurvivalManager
// ═══════════════════════════════════════

export type SurvivalState = 'GROWTH' | 'SURVIVAL' | 'RECOVERY' | 'DEFENSIVE' | 'CRITICAL';

export interface SurvivalManagerConfig {
    initialBalance: number;
    x402Client?: X402Client | null;
    onPanic?: () => void;
    onGrowth?: () => void;
    onSurvival?: () => void;
    onDefensive?: () => void;
    onRecovery?: () => void;
    onCritical?: () => void;
    hysteresisThreshold?: number;
}

export interface SurvivalHistoryEntry {
    from: SurvivalState;
    to: SurvivalState;
    ratio: number;
    timestamp: string;
}

export class SurvivalManager {
    initialBalance: number;
    currentBalance: number;
    state: SurvivalState;
    previousState: SurvivalState | null;
    stateHistory: SurvivalHistoryEntry[];

    constructor(config: SurvivalManagerConfig);
    updateVitalSigns(newBalance: number): SurvivalState;
    getPnL(): number;
    getHealthRatio(): number;
    getHistory(): SurvivalHistoryEntry[];
}

// ═══════════════════════════════════════
//  LLMClient
// ═══════════════════════════════════════

export type LLMProvider = 'ollama' | 'openai' | 'anthropic';
export type TradeAction = 'BUY' | 'SELL' | 'CLOSE' | 'HOLD';
export type Urgency = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LLMClientConfig {
    provider?: LLMProvider;
    model?: string;
    apiBase?: string;
    apiKey?: string;
    timeout?: number;
    maxRetries?: number;
}

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

export interface ChatOptions {
    temperature?: number;
    maxTokens?: number;
}

export interface TradeDecision {
    action: TradeAction;
    symbol: string | null;
    confidence: number;
    reasoning: string;
    leverage: number;
    urgency: Urgency;
    debate?: {
        technician: string;
        sentinel: string;
        guardian: string;
    };
}

export interface DecisionContext {
    marketData?: Record<string, MarketSnapshot>;
    signals?: any[];
    positions?: PositionEvent[];
    survivalState?: SurvivalState;
    balance?: number;
    pnl?: number;
}

export class LLMClient {
    provider: LLMProvider;
    model: string;
    apiBase: string;
    apiKey: string;
    timeout: number;
    maxRetries: number;
    TRADING_SYSTEM_PROMPT: string;
    PERSONA_PROMPTS: Record<string, string>;

    constructor(config?: LLMClientConfig);
    chat(messages: ChatMessage[], options?: ChatOptions): Promise<string>;
    decide(context: DecisionContext): Promise<TradeDecision>;
    decideWithDebate(context: DecisionContext): Promise<TradeDecision>;
}

// ═══════════════════════════════════════
//  MarketDataFeed
// ═══════════════════════════════════════

export interface MarketDataFeedConfig {
    symbols?: string[];
    pollIntervalMs?: number;
    indicatorPeriod?: number;
}

export interface MarketIndicators {
    rsi: number | null;
    ema20: number | null;
    ema50: number | null;
    atr: number | null;
}

export interface MarketSnapshot extends MarketIndicators {
    price: number;
    historyLength: number;
}

export class MarketDataFeed {
    symbols: string[];
    latestPrices: Record<string, number>;
    indicators: Record<string, MarketIndicators>;

    constructor(config?: MarketDataFeedConfig);
    start(): Promise<void>;
    stop(): void;
    getSnapshot(): Record<string, MarketSnapshot>;
    getPrice(symbol: string): number;
}

// ═══════════════════════════════════════
//  PositionManager
// ═══════════════════════════════════════

export interface PositionManagerConfig {
    dataDir?: string;
    onClosePosition?: (position: PositionEvent) => Promise<void>;
}

export interface OpenPositionParams {
    symbol: string;
    side: 'buy' | 'sell';
    entryPrice: number;
    size: number;
    leverage?: number;
    exchange?: string;
    stopLoss?: number;
    takeProfit?: number;
}

export type CloseReason = 'manual' | 'stop_loss' | 'take_profit' | 'survival' | 'shutdown' | 'llm_decision';

export class PositionManager {
    constructor(config?: PositionManagerConfig);
    open(params: OpenPositionParams): PositionEvent;
    close(positionId: string, reason?: CloseReason, exitPrice?: number): PositionEvent | null;
    closeAll(reason?: CloseReason): Promise<(PositionEvent | null)[]>;
    getOpen(): PositionEvent[];
    getBySymbol(symbol: string): PositionEvent[];
    getTotalPnL(): number;
    getTotalExposure(): number;
    getCount(): number;
    updateLevels(positionId: string, levels: { stopLoss?: number; takeProfit?: number }): void;
}

// ═══════════════════════════════════════
//  RiskManager
// ═══════════════════════════════════════

export interface RiskManagerConfig {
    maxPositions?: number;
    maxExposurePercent?: number;
    maxPerAssetPercent?: number;
    defaultRiskPercent?: number;
    maxLeverage?: number;
    minConfidence?: number;
}

export interface Portfolio {
    balance: number;
    totalExposure: number;
    positionCount: number;
    positions?: PositionEvent[];
}

export interface RiskResult {
    allowed: boolean;
    reason: string;
    adjustedLeverage: number;
    adjustedSize: number;
}

export interface EffectiveLimits {
    maxPositions: number;
    maxLeverage: number;
    riskPercent: number;
    minConfidence: number;
    survivalState: SurvivalState;
}

export class RiskManager {
    maxPositions: number;
    maxExposurePercent: number;
    maxPerAssetPercent: number;
    defaultRiskPercent: number;
    maxLeverage: number;
    minConfidence: number;

    constructor(config?: RiskManagerConfig);
    canOpenPosition(signal: TradeDecision, portfolio: Portfolio, survivalState?: SurvivalState): RiskResult;
    calculatePositionSize(balance: number, riskPercent?: number, stopDistancePercent?: number | null): number;
    getStopLoss(entryPrice: number, side: 'buy' | 'sell', atr?: number, multiplier?: number): number;
    getTakeProfit(entryPrice: number, side: 'buy' | 'sell', stopLoss: number, riskRewardRatio?: number): number;
    getEffectiveLimits(survivalState?: SurvivalState): EffectiveLimits;
}

// ═══════════════════════════════════════
//  WalletManager
// ═══════════════════════════════════════

export class WalletManager {
    constructor(chainName?: 'base' | 'polygon');
    getAddress(): string | null;
    signMessage(message: string): Promise<string>;
    sendPayment(to: string, value: bigint, data?: string): Promise<string>;
}

// ═══════════════════════════════════════
//  X402Client
// ═══════════════════════════════════════

export class X402Client {
    wallet: WalletManager;
    constructor();
    fetch(url: string, options?: RequestInit): Promise<Response>;
}

// ═══════════════════════════════════════
//  AgentOrchestrator
// ═══════════════════════════════════════

export interface TradeExecution {
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    leverage: number;
}

export interface AgentOrchestratorConfig {
    initialBalance: number;
    symbols?: string[];
    baseIntervalMs?: number;
    dataDir?: string;
    alphaDbPath?: string;
    llmConfig?: LLMClientConfig;
    riskConfig?: RiskManagerConfig;
    x402Client?: X402Client | null;
    executeTrade?: (trade: TradeExecution) => Promise<void>;
    executeClose?: (position: PositionEvent) => Promise<void>;
}

export class AgentOrchestrator {
    config: AgentOrchestratorConfig;
    llm: LLMClient;
    marketData: MarketDataFeed;
    positionManager: PositionManager;
    riskManager: RiskManager;
    survival: SurvivalManager;

    constructor(config: AgentOrchestratorConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
}

// ═══════════════════════════════════════
//  LiquidationIntelligence
// ═══════════════════════════════════════

export type LiquidationSignalType =
    | 'LIQUIDATION_MAGNET'
    | 'CASCADE_RISK'
    | 'IMBALANCE'
    | 'SQUEEZE_POTENTIAL'
    | 'OI_DIVERGENCE';

export type LiquidationDirection =
    | 'BULLISH'
    | 'BEARISH'
    | 'SHORT_SQUEEZE'
    | 'LONG_SQUEEZE'
    | 'RISING'
    | 'FALLING';

export interface LiquidationSignal {
    type: LiquidationSignalType;
    direction: LiquidationDirection;
    strength: number;
    detail: string;
    data: Record<string, any>;
}

export interface LiquidationLevel {
    price: number;
    side: 'long' | 'short' | 'mixed';
    volumeUsd: number;
    exchange: string;
}

export interface OpenInterestData {
    value: number;
    change24h: number;
    timestamp: number;
}

export interface FundingRateData {
    rate: number;
    markPrice: number;
    indexPrice: number;
    nextFundingTime: number;
    timestamp: number;
}

export interface LongShortRatioData {
    ratio: number;
    longPercent: number;
    shortPercent: number;
    timestamp: number;
}

export interface LiquidationVolume24h {
    long: number;
    short: number;
    total: number;
}

export interface LiquidationContext {
    symbol: string;
    openInterest: OpenInterestData;
    fundingRate: FundingRateData;
    longShortRatio: LongShortRatioData;
    liquidations24h: LiquidationVolume24h;
    heatmap: { source: string; zones: LiquidationLevel[] } | null;
    signals: LiquidationSignal[];
    summary: string;
    lastUpdate: number;
}

export interface CoinGlassConfig {
    apiKey?: string;
    apiBase?: string;
}

export interface X402PremiumConfig {
    client?: X402Client;
    autoPayPremium?: boolean;
    maxPaymentPerDay?: number;
}

export interface LiquidationIntelligenceConfig {
    symbols?: string[];
    pollIntervalMs?: number;
    exchange?: 'binance' | 'bybit';
    coinglass?: CoinGlassConfig;
    x402?: X402PremiumConfig;
    cascadeThresholdUsd?: number;
    squeezeRatioThreshold?: number;
    magnetProximityPercent?: number;
}

export class LiquidationIntelligence {
    symbols: string[];
    data: Record<string, any>;

    constructor(config?: LiquidationIntelligenceConfig);
    start(): Promise<void>;
    stop(): void;
    getContext(symbol: string): LiquidationContext | null;
    getLLMContext(): string;
    getSnapshot(): Record<string, LiquidationContext>;
}

// ═══════════════════════════════════════
//  SDK Factory Functions
// ═══════════════════════════════════════

export function createAgent(options?: {
    initialBalance?: number;
    symbols?: string[];
    intervalMs?: number;
    llm?: LLMClientConfig;
    risk?: RiskManagerConfig;
    dataDir?: string;
    onTrade?: (trade: TradeExecution) => Promise<void>;
    onClose?: (position: PositionEvent) => Promise<void>;
}): AgentOrchestrator;

export function createLLM(options?: LLMClientConfig): LLMClient;
export function createMarketFeed(options?: MarketDataFeedConfig): MarketDataFeed;
export function createRiskManager(options?: RiskManagerConfig & { riskPercent?: number }): RiskManager;
export function createSurvival(initialBalance: number, callbacks?: Partial<SurvivalManagerConfig>): SurvivalManager;
export function createPositionManager(options?: { dataDir?: string; onClose?: (position: PositionEvent) => Promise<void> }): PositionManager;
export function createLiquidationIntel(options?: LiquidationIntelligenceConfig): LiquidationIntelligence;
