require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const TOKEN_MAP = require('./tokenMap');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CG_API_KEY = process.env.COINGECKO_API_KEY;
const CG_BASE = process.env.COINGECKO_BASE_URL || 'https://api.coingecko.com/api/v3';

if (!DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN belum diset di .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const PRICE_PATTERN = /^(\d+(?:[.,]\d+)?)\s+([a-zA-Z0-9]{1,15})$/;

const cache = new Map();
const CACHE_TTL_MS = 30_000;

async function resolveCoinId(symbol) {
  const key = symbol.toLowerCase();
  if (TOKEN_MAP[key]) return TOKEN_MAP[key];

  const url = new URL(`${CG_BASE}/search`);
  url.searchParams.set('query', symbol);
  if (CG_API_KEY) url.searchParams.set('x_cg_demo_api_key', CG_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`CoinGecko search error ${res.status}`);
  const data = await res.json();

  const matches = (data.coins || []).filter(
    (c) => c.symbol.toLowerCase() === key
  );
  if (matches.length === 0) return null;

  matches.sort((a, b) => {
    const ra = a.market_cap_rank ?? Infinity;
    const rb = b.market_cap_rank ?? Infinity;
    return ra - rb;
  });

  return matches[0].id;
}

async function fetchCoinData(coinId) {
  const cached = cache.get(coinId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data;
  }

  const url = new URL(`${CG_BASE}/coins/${coinId}`);
  url.searchParams.set('localization', 'false');
  url.searchParams.set('tickers', 'false');
  url.searchParams.set('market_data', 'true');
  url.searchParams.set('community_data', 'false');
  url.searchParams.set('developer_data', 'false');
  if (CG_API_KEY) url.searchParams.set('x_cg_demo_api_key', CG_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`CoinGecko error ${res.status}`);
  }
  const data = await res.json();
  cache.set(coinId, { data, ts: Date.now() });
  return data;
}

function formatUSD(n) {
  if (n === null || n === undefined) return 'N/A';
  const abs = Math.abs(n);
  const digits = abs < 1 ? 6 : 2;
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function formatIDR(n) {
  if (n === null || n === undefined) return 'N/A';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID');
}

function formatVND(n) {
  if (n === null || n === undefined) return 'N/A';
  return '₫' + Math.round(n).toLocaleString('vi-VN');
}

function formatCompactNumber(n, prefix) {
  if (n === null || n === undefined) return 'N/A';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  let out;
  if (abs >= 1e9) out = (abs / 1e9).toFixed(2) + 'B';
  else if (abs >= 1e6) out = (abs / 1e6).toFixed(2) + 'M';
  else if (abs >= 1e3) out = (abs / 1e3).toFixed(2) + 'K';
  else out = abs.toFixed(2);
  return sign + (prefix || '') + out;
}

function build24hIndicator(pct) {
  if (pct === null || pct === undefined) return 'N/A';
  const arrow = pct >= 0 ? '▲' : '▼';
  return `${arrow} ${Math.abs(pct).toFixed(2)}% (24h)`;
}

function buildStatTable(rows) {
  const labelWidth = Math.max(...rows.map((r) => r.label.length));
  const lines = [];
  rows.forEach((r, i) => {
    const label = r.label.padEnd(labelWidth);
    lines.push(`${label} | ${r.value}`);
    if (i < rows.length - 1) {
      lines.push('-' + '+' + '-'.repeat(labelWidth + r.value.length + 1));
    }
  });
  return '```\n' + lines.join('\n') + '\n```';
}

async function handlePriceQuery(message, amount, symbol) {
  let coinId;
  try {
    coinId = await resolveCoinId(symbol);
  } catch (err) {
    await message.reply(`Gagal cari token "${symbol.toUpperCase()}": ${err.message}`);
    return;
  }

  if (!coinId) {
    await message.reply(`Token "${symbol.toUpperCase()}" tidak ditemukan.`);
    return;
  }

  let data;
  try {
    data = await fetchCoinData(coinId);
  } catch (err) {
    await message.reply(`Gagal ambil data untuk ${symbol.toUpperCase()}: ${err.message}`);
    return;
  }

  const md = data.market_data;
  const priceUsd = md.current_price.usd;
  const priceIdr = md.current_price.idr;
  const priceVnd = md.current_price.vnd;
  const athUsd = md.ath.usd;
  const athChangePct = md.ath_change_percentage.usd;
  const change24h = md.price_change_percentage_24h;
  const marketCap = md.market_cap.usd;
  const circulating = md.circulating_supply;
  const maxSupply = md.max_supply;
  const rank = data.market_cap_rank;
  const symbolUpper = data.symbol.toUpperCase();

  const amountNum = parseFloat(amount.replace(',', '.'));
  const totalUsd = amountNum * priceUsd;
  const totalIdr = amountNum * priceIdr;
  const totalVnd = amountNum * priceVnd;

  const table = buildStatTable([
    { label: 'Market Cap', value: formatCompactNumber(marketCap, '$') },
    { label: 'All Time High', value: `${formatUSD(athUsd)}  ${athChangePct >= 0 ? '+' : ''}${athChangePct.toFixed(1)}%` },
    { label: 'Circulating', value: `${formatCompactNumber(circulating, '')} ${symbolUpper}` },
    { label: 'Max Supply', value: maxSupply ? `${formatCompactNumber(maxSupply, '')} ${symbolUpper}` : '∞' },
  ]);

  const description = [
    `**${amountNum.toFixed(2)} ${symbolUpper}**`,
    '',
    `${formatUSD(totalUsd)}`,
    `${formatIDR(totalIdr)}`,
    `${formatVND(totalVnd)} · ${build24hIndicator(change24h)}`,
    '',
    table,
  ].join('\n');

  const embed = new EmbedBuilder()
    .setColor(change24h >= 0 ? 0x22c55e : 0xef4444)
    .setAuthor({
      name: `${data.name}${rank ? ` · #${rank}` : ''}`,
      iconURL: data.image?.small,
    })
    .setDescription(description);

  await message.reply({ embeds: [embed] });
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const match = message.content.trim().match(PRICE_PATTERN);
  if (!match) return;

  const [, amount, symbol] = match;
  await handlePriceQuery(message, amount, symbol);
});

client.once('clientReady', () => {
  console.log(`Bot aktif sebagai ${client.user.tag}`);
});

client.login(DISCORD_TOKEN);
