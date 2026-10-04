# Portmonka: backend (Worker) a Přehled, stav k 4. 10. 2026

Určeno pro ChatGPT (vývoj appky Portmonka) a pro další vlákna s Claudem. Zdroj pravdy o appce zůstává repo `67myrda/Portmonka` a dokumenty MASTER_CONTEXT, 07_MASTER a technická specifikace. Tento dokument je jen doplněk o věcech, které vznikly kolem backendu a nic v appce Portmonka nemění.

## 1. Co vzniklo

**Cloudflare Worker `portmonka-backend`** (privátní repo `67myrda/portmonka-backend`, větev main, nasazuje se přes Cloudflare Workers Builds, soubor `index.js` v kořeni, konfigurace v `wrangler.json`).

Adresy:
- `GET /health` vrací `{"status":"ok","service":"portmonka-backend"}`.
- `POST /api/events` je příjem událostí z appek GOORN a Tahák (idempotentní, chráněno sdíleným tajemstvím). Zatím nikdo neposílá.
- `POST /mcp/<tajná cesta>` je MCP konektor "Portmonka" pro Claude, jen čtení. Špatná cesta vrací 404.

Přístup k datům: Worker se do Firestore přihlašuje servisním účtem `firebase-adminsdk-fbsvc@portmonka-951967.iam.gserviceaccount.com` (podpis RS256 přes Web Crypto, REST API). Tajné hodnoty jsou v Cloudflare secrets: `FIREBASE_SERVICE_ACCOUNT_JSON`, `INGEST_SHARED_SECRET`, `MCP_PATH_TOKEN`, `PORTMONKA_USER_ID`. Žádná hodnota se nikdy nesmí dostat do repa ani do dokumentů.

## 2. Nástroje MCP (všechny jen čtení)

| Nástroj | Co vrací |
|---|---|
| `get_overview` | Souhrn Portmonky: k fakturaci, vyfakturované a čekající na platbu, nejbližší nároky, blokované, zaplaceno tento měsíc, příjem po týdnech |
| `list_installments` | Splátky, volitelně podle odvozeného stavu (waiting, ready, invoiced, paid) |
| `get_tahak` | Aktuální neuzamčená kampaň Taháku (bez `frozenAt`): obsazenost ploch, tržby, dny kampaně (uplynulé, pracovní, aktivní) |
| `get_goorn` | GOORN zakázky od roku 2026 bez duplicit: rozpracované (Zavolat, Domluvený termín, Přemýšlí, Follow-up), provize k vyfakturování, nejbližší návštěvy |
| `get_market` | Kurzy ČNB, Fear & Greed, ceny ONO (pomocná data pro dashboard Přehled) |

Tahák a GOORN čte Worker přímo z jejich Firestore projektů (`pf-tahak-tahax67`, `goorn-prehled-zakazek`). Servisní účet Portmonky tam má jen roli Cloud Datastore Viewer. Nic se do nich nezapisuje.

## 3. Pravidla výpočtu, která si uživatel zvolil

- Tahák: platí jen neuzamčená kampaň. "Aktivní dny" jsou dny, které si uživatel ručně zaškrtává v Kalendáři kampaně (záložka Shrnutí). Prodané typy jsou N, S, Z, J, K, volné V, nerozhodnuté "?".
- GOORN: starší zakázky než rok 2026 se ignorují, duplicity se ignorují. Provize: stav `due1` je 1. část 3 190 Kč, stav `due2` je 2. část 2 530 Kč.
- Portmonka: stav splátky se vždy odvozuje z dat (waiting, ready, invoiced, paid), nikdy se neukládá.

## 4. Otevřené body pro ChatGPT a uživatele (rozhodnutí potřebujeme)

1. **Pojmenování polí splátky.** Prototyp `app.js` používá `dueDate`, `invoicedDate`, `paymentDate`. Backend a specifikace používají `claimDate`, `invoicedAt`, `paidAt`. Rozhodnout, které se drží, a sjednotit.
2. **Splatnost.** Portmonka dnes nemá pojem data splatnosti faktury. Přehled proto ukazuje "vyfakturováno, čeká na platbu (N dní)". Pokud se splatnost zavede, Přehled se upraví.
3. **Úložiště.** Prototyp ukládá do localStorage, backend čte Firestore. Skutečná funkční appka zatím neexistuje, ve Firestore jsou jen testovací data (např. záznam "Test core – Litomyšl", jedna zaplacená splátka 7 500 Kč). Rozhodnout, kdy se appka napojí na Firestore.
4. **Události z Taháku a GOORNu.** Příjem `/api/events` existuje, ale appky ho nevolají. Prozatím to řeší přímé čtení. Událostí se využije až pro zápis nároků do Portmonky.

## 5. Dashboard Přehled (ne součást appky Portmonka)

Samostatná webová stránka (artefakt v Claudovi, soukromá) pro ranní přehled na tabletu. Čte přes konektory: Google Kalendář, Crypto.com, AccuWeather a konektor Portmonka (výše). Portmonku ukazuje zatím s testovacími daty a nic do ní nezapisuje. Rozvoj Přehledu se děje mimo repo Portmonky.

## 6. Doporučení pro další práci

- Jakýkoli zásah do pojmenování polí nebo datového modelu Portmonky nejdřív promítnout do `PORTMONKA_TECHNICKA_SPECIFIKACE.md` a až poté do Workeru, jinak se `get_overview` rozbije.
- Při změně Firestore schématu dát vědět, ať se upraví čtení ve Workeru (`loadPortfolio`, `deriveStatus`, `buildOverview`).
- Změny ve Workeru se nahrávají přes GitHub (upload `index.js`), Cloudflare nasazuje samo.
