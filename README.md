# Discord Crypto Bot

Bot Discord untuk konversi harga cryptocurrency ke USD, IDR, dan VND.

## Fitur

- 💵 Konversi harga ke 3 mata uang (USD, IDR, VND)
- 📊 Support 60+ cryptocurrency populer
- 📈 Perubahan harga 24 jam
- 💎 Data market cap, ATH, supply
- ⚡ Real-time data dari CoinGecko API
- 🎨 Discord embed dengan warna dinamis

## Cara Penggunaan

```
<jumlah> <symbol>
```

**Contoh:**
```
1 btc
100 eth
1000 sol
```

## Setup

1. Clone repository
```bash
git clone https://github.com/vionanadhira75/discord-crypto-bot.git
cd discord-crypto-bot
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp .env.example .env
```

Edit `.env` dan isi dengan token Discord bot kamu:
```env
DISCORD_TOKEN=your_discord_bot_token_here
COINGECKO_API_KEY=optional_api_key
```

4. Jalankan bot
```bash
npm start
```

## Supported Tokens

Bot mendukung 60+ cryptocurrency:
- BTC, ETH, SOL, BNB, XRP, ADA
- USDT, USDC
- DOGE, SHIB, PEPE, WIF, BONK
- AVAX, DOT, LINK, MATIC/POL
- Dan banyak lagi...

Lihat `tokenMap.js` untuk daftar lengkap.

## Tech Stack

- Node.js
- Discord.js v14
- CoinGecko API

## License

MIT
