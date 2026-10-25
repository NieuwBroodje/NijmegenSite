# FiveM Roleplay website + Tebex (Vercel)

Statische site (`public/`) + serverless functies (`api/`) die de Tebex Headless API gebruiken.

## Lokaal testen
```
npm i -g vercel
cp .env.example .env     # vul je Tebex keys in
vercel dev
```

## Deployen op Vercel
1. Zet de map op GitHub en kies **Add New > Project** in Vercel (Framework: *Other*).
2. Voeg onder **Settings > Environment Variables** toe: `TEBEX_PUBLIC_TOKEN`, `TEBEX_PRIVATE_KEY`, optioneel `FIVEM_CFX_CODE`.
3. Deploy. Of via CLI: `vercel --prod`.

## Aanpassen
Naam, teksten, links, vehicles en regels staan bovenaan het script in `public/index.html` (`CONFIG`). Zet je eigen `hero.jpg` (achtergrond) en `logo.svg` in `public/`.
Producten en categorieen komen automatisch uit je Tebex-webshop.
De private key staat alleen in de serverless functies en komt nooit in de browser.
