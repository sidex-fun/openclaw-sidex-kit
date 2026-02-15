#!/usr/bin/env node
/**
 * Fetch AgentBets prediction markets
 * Use market odds as trading signals for SIDEX
 */

const API_URL = 'https://agentbets-api-production.up.railway.app';

async function fetchMarkets() {
  const res = await fetch(`${API_URL}/markets`);
  const data = await res.json();
  return data.markets;
}

async function fetchOpportunities() {
  const res = await fetch(`${API_URL}/opportunities`);
  const data = await res.json();
  return data.opportunities;
}

async function main() {
  console.log('=== AgentBets Markets ===\n');
  
  const markets = await fetchMarkets();
  
  for (const m of markets) {
    console.log(`${m.question}`);
    console.log(`  Odds: ${m.probabilities.join(' / ')}`);
    console.log(`  Pool: ${m.totalPoolSol} SOL`);
    console.log(`  Resolves: ${new Date(m.resolutionDate).toLocaleDateString()}`);
    console.log('');
  }
  
  console.log('=== Opportunities (+EV bets) ===\n');
  
  const opps = await fetchOpportunities();
  
  if (opps.length === 0) {
    console.log('No mispriced markets found.\n');
  } else {
    for (const o of opps) {
      console.log(`${o.market}: ${o.edge}% edge on ${o.outcome}`);
    }
  }
}

main().catch(console.error);
