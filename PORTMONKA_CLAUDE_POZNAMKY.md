# PORTMONKA — CLAUDE POZNÁMKY
## Průběžné technické review a supervize (živý dokument)

**Poslední aktualizace:** 1. 10. 2026
**Autor:** Claude (Anthropic), na vyžádání Myrdy
**Účel:** Nezávislé druhé oči nad architekturou a rozhodnutími Portmonky. Nenahrazuje MASTER CONTEXT, 07 MASTER, technickou specifikaci ani audit — doplňuje je o průběžné poznámky z pohledu implementace a o zkušenosti z ostatních Myrdových appek, které mám k dispozici.

> Živý dokument — Claude ho při každém dalším review přepisuje/doplňuje, nezakládá nový číslovaný checkpoint. Datum nahoře říká, jak čerstvý je obsah.

---

## 1. Stav k 1. 10. 2026 — po review funkčního CORE

**Verdikt: CORE je reálně funkční a ověřený end-to-end** (Google login → Firestore → případ → splátka → fakturace → platba → Příjem → Souhrn). Žádný architektonický červený praporek. Jedno z dřívějších doporučení (integer `amountMinor` místo desetinných částek) bylo mezitím implementováno — dobrá disciplína.

Review proběhlo přímo nad obsahem GitHub repa (`index.html`, `firestore.rules`, `app.js` aj.), ne jen nad textovými checkpointy.

### ✅ Vyřešeno od minulého review
- Repo uklizeno: `app.js`, `styles.css`, `README-1.md` (pozůstatky staré localStorage verze appky, nereferencované ze současného `index.html`, `README-1.md` navíc aktivně zavádějící) — smazáno.
- `PORTMONKA_DATOVY_MODEL_v2_MM_DOMOVEO.md` doplněn do repa (dřív citován v hierarchii zdrojů, ale chyběl).

### 🟡 Otevřené nálezy — k řešení s ChatGPT

**1. GOORN: potvrzené pevné částky se ještě nepropsaly do kódu ani specifikace**
Myrda potvrdil: GOORN provize jsou **pevné částky 3 190 Kč (1. část) / 2 530 Kč (2. část) za instalaci**, ne procento z proměnlivé celkové částky. Aktuální `index.html` (SOURCES objekt + formulář) i `PORTMONKA_TECHNICKA_SPECIFIKACE_v1.1_CORE.md` (sekce 8.2) pořád počítají GOORN jako **% split (výchozí 50/50) z ručně zadané celkové provize**.
→ Potřeba přepracovat formulář/data model pro GOORN: místo "Celková provize + %" nabídnout rovnou dvě pevné částky (3 190 / 2 530 Kč) jako výchozí, s možností úpravy pro budoucí případ, kdyby se částky změnily.

**2. Chybí "upravit/opravit údaje" u případu**
`PORTMONKA_07_MASTER.md` (kap. 12) tuhle akci u detailu případu výslovně požaduje. Aktuální CORE umí vytvořit, zobrazit, označit stav a smazat celý případ — ale ne upravit existující údaje (např. opravit překlep v názvu nebo částce bez smazání a založení znovu). Není to ani v seznamu "CO NENÍ HOTOVÉ" — vypadá to jako přehlédnutí, ne vědomé odložení.

**3. Sloučení více zakázek do jedné faktury — stále nikde**
Požadavek z Myrdova zadání ("více zakázek lze později spojit do jedné faktury, původní zakázky zůstanou zachované") se zatím neobjevil v datovém modelu ani v `TECHNICKA_SPECIFIKACE_v1.1`. Nejde o aktuální prioritu, ale mělo by to být zapsané jako otevřený bod, ať se na to nezapomene.

**4. Security Rules hlídají jen vlastnictví, ne obsah zápisu**
`firestore.rules` správně odmítne přístup k cizím datům (`userId == auth.uid`), ale nijak nevaliduje *obsah* zápisu v rámci vlastního prostoru — klient si teoreticky může zapsat `paidAt` bez `invoicedAt`, zápornou částku, nebo přeskočit stavy. U jednoho uživatele, co appku sám proti sobě nehackuje, to teď není riziko, ale je to přesně ten typ věci, co se má doladit **před** jakoukoliv úvahou o multi-userovi nebo sdíleném přístupu, ne až po ní. Checkpoint 03 to už sám pojmenoval jako "co zatím nedokazuje" — tahle poznámka jen zvedá prioritu.

---

## 2. Dřívější poznatky, které zůstávají v platnosti

| Poznatek | Zdroj | Relevance |
|---|---|---|
| Firebase Storage vyžaduje od 2026 placený Blaze plán | AI kouč | Řešit jen pokud appka bude potřebovat nahrávání souborů |
| Cloudflare Worker jako proxy na Claude API by měl mít silnější ochranu než jen CORS | AI kouč | Platí až pro budoucí AI vrstvu Portmonky |
| `signInWithPopup` pro základní Firebase Google přihlášení funguje spolehlivě na Android/Opera; širší OAuth scope (Drive/Kalendář) může mít jiné chování | GOORN, ověřeno Auth Spike | Řešit, až/pokud appka bude potřebovat více než jen přihlášení |

---

## 3. Doporučený další krok

Žádný z nálezů výše neohrožuje funkční CORE — všechno jde přidat jako další "JEDEN KROK", ne návrat na začátek. Navrhované pořadí:
1. Rozhodnout a zapsat GOORN pevné částky (nález 1) — ovlivňuje reálná data, nejvyšší priorita
2. Doplnit editaci případu (nález 2) — malý kousek UX slíbený v MASTERu
3. Zapsat invoice-merging jako otevřený bod do technické specifikace (nález 3)
4. Field-level validace v Security Rules — před jakýmkoliv krokem k multi-userovi (nález 4)

---

## 4. Jak tenhle soubor používat
- ChatGPT: cituj nebo shrnuj cokoliv odsud.
- Myrda: při dalším review Claude tenhle soubor znovu přepíše/doplní — datum nahoře říká, jak čerstvý je obsah.
