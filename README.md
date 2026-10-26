# Nijmegen Roleplay – Website & Store

De officiële website en donatiestore van **Nijmegen Roleplay**, een Nederlandse FiveM roleplay server.

**Gemaakt door Karel** voor Nijmegen Roleplay.

🌐 Live: https://nijmegen.vercel.app
🎮 Connect: https://cfx.re/join/3yyz898
💬 Discord: https://discord.gg/nijmegen

---

## Wat doet de website?

- **Home** met live spelersaantal, populaire pakketten en een coin-calculator
- **Store** met alle pakketten uit Tebex, categorieën, zoeken en sorteren
- **Winkelmand** en veilig afrekenen via Tebex
- **Inloggen via Cfx.re**, zodat aankopen automatisch aan het juiste account gekoppeld worden
- **Overstappen**-pagina voor staff, overheid en gangs
- Donkere en lichte modus, en een navbar die over de volle breedte loopt en bij scrollen een achtergrond krijgt

## Techniek

| Onderdeel | Gebruikt |
| --- | --- |
| Frontend | Eén `index.html` (HTML, CSS en JavaScript, geen framework) |
| Backend | Vercel Serverless Functions in de map `api/` |
| Betalingen | [Tebex Headless API](https://docs.tebex.io/developers/headless-api/overview) |
| Spelersaantal | Een FiveM-resource pusht de status naar Upstash Redis |

## Projectstructuur

```
├── public/
│   ├── index.html        # De hele website
│   ├── logo.png
│   ├── hero.jpg
│   └── pack-*.png        # Afbeeldingen van de voorbeeldpakketten
├── api/
│   ├── packages.js       # GET   categorieën en pakketten uit Tebex
│   ├── login.js          # POST  start de Cfx.re login
│   ├── session.js        # GET   haalt de ingelogde gebruiker op
│   ├── checkout.js       # POST  maakt een basket en start het afrekenen
│   ├── add-packages.js   # POST  voegt pakketten toe aan een ingelogde basket
│   └── status.js         # GET/POST spelersaantal
└── status-push/          # FiveM-resource (op de gameserver)
    ├── fxmanifest.lua
    └── server.lua
```

## Installatie

### 1. Website op Vercel

1. Zet het project op GitHub en importeer het in [Vercel](https://vercel.com).
2. Voeg onder **Settings → Environment Variables** toe:

| Variabele | Omschrijving |
| --- | --- |
| `TEBEX_PUBLIC_TOKEN` | Publieke webstore-token uit je Tebex-dashboard |
| `STATUS_SECRET` | Lang willekeurig wachtwoord voor het spelersaantal |

3. Maak onder **Storage** een **Upstash Redis**-database aan en koppel die aan het project. Daarmee komen `KV_REST_API_URL` en `KV_REST_API_TOKEN` er automatisch bij.
4. Zet `coinPackageId` in `CONFIG` bovenin `index.html` op het Tebex package-ID van je coin-pakket.
5. Deploy het project.

### 2. FiveM-resource (spelersaantal)

1. Zet de map `status-push/` in `resources/[local]/` op je server.
2. Zet in `server.lua` bij `SECRET` dezelfde waarde als `STATUS_SECRET` in Vercel.
3. Voeg `ensure status-push` toe aan je `server.cfg` en herstart de server.

De resource stuurt elke 30 seconden het aantal spelers naar `/api/status`. Is de server offline, dan toont de site na twee minuten vanzelf `--`.

## Aanpassen

Bijna alles wat je wilt wijzigen staat in het `CONFIG`-blok bovenin `index.html`: naam, logo, promotiecode, Discord-links, voorbeeldpakketten en de tekst van de overstap-pagina.

## Problemen oplossen

| Probleem | Oplossing |
| --- | --- |
| Spelersaantal toont `--` | Check `https://nijmegen.vercel.app/api/status` (zonder `#`). Staat er een `debug`-melding, dan mist de Upstash-koppeling of is er niet opnieuw gedeployed. |
| Inloggen of afrekenen mislukt | Controleer `TEBEX_PUBLIC_TOKEN` en de Vercel-logs van de `api/`-functies. |
| Wijzigingen zijn niet zichtbaar | Een nieuwe environment variable werkt pas na een **Redeploy**. |

## Credits

Website, store en integraties: **Karel**
Server: **Nijmegen Roleplay**, opgericht door Portak-NL

© Nijmegen Roleplay. Alle rechten voorbehouden.
