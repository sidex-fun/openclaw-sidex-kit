/**
 * Solder Cortex Integration for SIDEX
 * Conviction scoring for trading decisions.
 * 
 * Before executing trades, check wallet conviction across DeFi + prediction markets.
 * High conviction = trader has real skin in the game.
 * 
 * Demo: http://76.13.193.103/
 * GitHub: https://github.com/metalmcclaw/solder-cortex
 */

const CORTEX_API = process.env.CORTEX_API_URL || 'http://76.13.193.103/api';

async function getWalletConviction(wallet) {
  try {
    const res = await fetch(`${CORTEX_API}/conviction/${wallet}`);
    return res.ok ? await res.json() : null;
  } catch (e) {
    console.error('Cortex error:', e.message);
    return null;
  }
}

async function shouldFollowTrade(wallet, minConviction = 0.7) {
  const c = await getWalletConviction(wallet);
  if (!c) return { follow: false, reason: 'Could not fetch conviction' };
  return c.score >= minConviction 
    ? { follow: true, reason: `High conviction (${c.score.toFixed(2)})`, conviction: c }
    : { follow: false, reason: `Low conviction (${c.score.toFixed(2)})`, conviction: c };
}

module.exports = { getWalletConviction, shouldFollowTrade, CORTEX_API };
