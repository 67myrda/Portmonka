# PORTMONKA --- TECHNICKÁ SPECIFIKACE

## Navazující specifikace k PORTMONKA 07 --- MASTER

**Verze:** 1.0.1\
**Datum:** září 2026, upraveno 5. 10. 2026\
**Stav:** pracovní technická specifikace před implementací

> **Změna 1.0.1 (5. 10. 2026):** GOORN provize jsou potvrzené pevné
> částky 3 190 Kč + 2 530 Kč (celkem 5 720 Kč). Upraveny §8.2 a §34.

> Tento dokument převádí schválené produktové a UX principy Portmonky do
> technického návrhu. Neřeší neuzavřená produktová rozhodnutí; ta jsou
> výslovně označena jako TBD.

------------------------------------------------------------------------

# 1. Cíl technické specifikace

Technická architektura musí umožnit:

1.  spolehlivou evidenci případů a splátek,
2.  deterministické výpočty,
3.  oddělení plánovaných a skutečných peněz,
4.  automatickou fakturovatelnost podle pravidel,
5.  skutečné datum platby,
6.  budoucí integraci Prodejního Taháku a `goorn-zak`,
7.  Časový stroj nad stejnými daty,
8.  Objevitele nad strukturovanými daty,
9.  AI interpretaci bez možnosti měnit finanční pravdu,
10. Laboratoř „Co kdyby..." bez změny reality,
11. bezpečný provoz na Android tabletu,
12. postupný vývoj po jednotlivých testovatelných krocích.

------------------------------------------------------------------------

# 2. Zásadní architektonické pravidlo

``` text
                    ┌──────────────────────┐
                    │       ZDROJE         │
                    │ Tahák / goorn-zak    │
                    └──────────┬───────────┘
                               │ událost
                               ▼
                    ┌──────────────────────┐
                    │      PORTMONKA       │
                    │  případy + splátky   │
                    └──────────┬───────────┘
                               │
                 ┌─────────────┼──────────────┐
                 ▼             ▼              ▼
           FINANCE          ČAS /           ANALÝZA
           výpočty        scénáře          + AI
                 │             │              │
                 └─────────────┴──────────────┘
                               ▼
                         uživatelské UX
```

Zdrojové aplikace jsou autoritativní pro vznik obchodní události.

Portmonka je autoritativní pro svou vlastní evidenci případu, splátek a
stavu fakturace/platby.

AI není autoritou pro žádná finanční čísla.

------------------------------------------------------------------------

# 3. Doporučená technologická architektura

## Klient

Webová aplikace optimalizovaná pro:

-   Android tablet,
-   touch-first ovládání,
-   Opera,
-   případně Chrome.

První implementace může zůstat jednoduchou webovou aplikací, pokud tím
neutrpí datová architektura.

## Backend

Backend je nutný minimálně pro:

-   bezpečné API klíče,
-   integrace zdrojových aplikací,
-   AI volání,
-   případnou autentizaci a autorizaci.

Preferovaná kandidátní varianta:

``` text
Firebase
 ├── Authentication
 ├── Firestore
 └── Cloud Functions
```

Alternativou je serverová vrstva na Cloudflare.

**Konečné rozhodnutí Firebase vs. Cloudflare = TBD.**

## Databáze

Preferovaný koncept:

**samostatný Firebase projekt Portmonky**

Oddělený od:

-   `goorn-prehled-zakazek`,
-   databází Pro-Factoru,
-   ostatních zdrojových systémů.

------------------------------------------------------------------------

# 4. Datový model

Finanční model nesmí být založen pouze na agregovaných částkách.

## 4.1 Case / Případ

``` json
{
  "id": "case_...",
  "source": "goorn",
  "title": "Novák – instalace",
  "triggerDate": "2026-09-13",
  "triggerType": "installation",
  "totalAmount": 40000,
  "currency": "CZK",
  "createdAt": "...",
  "updatedAt": "..."
}
```

Poznámka:

`currency` může být technicky uložen jako ISO kód `CZK`, ale UI nesmí
obsahovat rublový symbol ani jeho grafickou podobu.

## 4.2 Installment / Splátka

``` json
{
  "id": "inst_...",
  "caseId": "case_...",
  "amount": 20000,
  "claimDate": "2026-09-13",
  "invoicedAt": null,
  "paidAt": null,
  "status": "READY"
}
```

Stav není vhodné ukládat jako jedinou nekontrolovanou hodnotu, pokud jej
lze deterministicky odvodit z dat.

Doporučení:

-   základní data jsou autoritativní,
-   `status` je odvozená hodnota,
-   případné ruční výjimky mají být explicitně uloženy.

------------------------------------------------------------------------

# 5. Stavový automat splátky

Canonical states:

``` text
WAITING
   ↓
READY
   ↓
INVOICED
   ↓
PAID
```

České UI:

``` text
ČEKÁ
LZE FAKTUROVAT
VYFAKTUROVÁNO
PROPLACENO
```

## Přechody

### WAITING → READY

Automaticky, pokud nastane podmínka nároku.

### READY → INVOICED

Ruční akce uživatele.

Uloží se:

`invoicedAt`.

### INVOICED → PAID

Ruční potvrzení skutečné platby.

Uloží se:

`paidAt`.

### READY → PAID

Technicky může být povoleno jako zkratka pouze tehdy, pokud uživatel
skutečně potvrzuje, že platba dorazila. V UI musí být zřejmé, že tím se
přeskočil mezikrok fakturace.

------------------------------------------------------------------------

# 6. Deterministické finanční funkce

Základní výpočty mají být čisté funkce bez AI.

## Celkem případu

``` text
case.totalAmount = Σ installment.amount
```

## Skutečný příjem

``` text
paidIncome(period)
= Σ installment.amount
  kde paidAt ∈ period
```

## Lze fakturovat

``` text
readyToInvoice
= Σ installment.amount
  kde status = READY
```

## Budoucí nárok

``` text
futureClaim
= Σ installment.amount
  kde claimDate > today
  a status != PAID
```

## Zbývá

``` text
remaining
= totalAmount - Σ paid installment.amount
```

## Kontrola integrity

Pro každý případ musí platit:

``` text
Σ splátek = totalAmount
```

Pokud neplatí, případ je datově nekonzistentní a systém ho nesmí tiše
opravit.

------------------------------------------------------------------------

# 7. Skutečný cash flow vs. plán

Portmonka musí striktně rozlišovat:

``` text
NÁROK
   ≠
FAKTURACE
   ≠
PLATBA
```

Datum nároku určuje, kdy lze částku podle pravidel řešit.

Datum fakturace říká, že uživatel fakturaci provedl.

Datum platby je jediný základ pro skutečný cash flow.

Příjem nesmí být navýšen pouze proto, že byla částka vyfakturována.

------------------------------------------------------------------------

# 8. Pravidla zdrojů

## 8.1 Pro-Factor

Model:

``` text
Case
 ├── 75 % — claim = triggerDate
 └── 25 % — claim = triggerDate + 4 měsíce
```

Spouštěč:

**datum uzavření města**

Obě části jsou samostatné splátky.

Přesná technická integrační událost z Prodejního Taháku = TBD.

## 8.2 GOORN

Model:

``` text
Case
 ├── část 1
 └── část 2
```

**Potvrzené pravidlo (rozhodl Myrda 5. 10. 2026):** provize za jednu
zakázku jsou pevné částky, nikoli procentní poměr.

``` text
Case (5 720 Kč)
 ├── část 1 — 3 190 Kč — claim = datum instalace
 └── část 2 — 2 530 Kč — claim = datum splnění podmínky (přechod do PPO)
```

Hodnoty odpovídají konstantě `FIN` v aplikaci `goorn-zak`
(`due1` = 3 190 Kč, `due2` = 2 530 Kč, `paidAll` = 5 720 Kč).

Dřívější nastavitelný poměr s výchozí hodnotou 50/50 z prototypu
se ruší.

Datum druhé části se předem nepočítá. Splátka vzniká jako blokovaná
podmínkou (`blockingCondition`) bez data nároku a datum se doplní,
až `goorn-zak` přepne zakázku na `due2`. Podrobnosti a návrh
integračního kontraktu jsou v `claude/PORTMONKA_CLAUDE_POZNAMKY.md`, bod 1.

## 8.3 Domoveo.cz

``` text
Case
 └── 1 installment
```

Bez časového rozložení.

Ruční zadání.

## 8.4 Grafika

``` text
Case
 └── 1+ installments podle konkrétní zakázky
```

Ruční zadání.

------------------------------------------------------------------------

# 9. Datové události

Portmonka by měla interně pracovat s událostmi.

Příklady:

``` text
CASE_CREATED
INSTALLMENT_CREATED
CLAIM_BECAME_READY
INSTALLMENT_INVOICED
INSTALLMENT_PAID
CASE_UPDATED
```

Integrační události:

``` text
SOURCE_CASE_CREATED
SOURCE_CASE_UPDATED
```

Událost z externí aplikace musí být idempotentní.

To znamená, že opakované doručení stejné události nesmí vytvořit
duplicitní případ.

------------------------------------------------------------------------

# 10. Integrační kontrakt

Preferovaný jednoduchý kontrakt:

``` json
{
  "eventId": "unique-event-id",
  "source": "goorn",
  "eventType": "CASE_CREATED",
  "occurredAt": "2026-09-13T12:30:00+02:00",
  "externalId": "source-record-id",
  "payload": {
    "title": "Novák – instalace",
    "triggerDate": "2026-09-13",
    "totalAmount": 42000
  }
}
```

## Povinné vlastnosti

-   `eventId`
-   `source`
-   `eventType`
-   `occurredAt`
-   `externalId`
-   `payload`

`externalId` + `source` musí umožnit deduplikaci.

------------------------------------------------------------------------

# 11. Integrace zdrojových aplikací

## Prodejní Tahák → Portmonka

``` text
město uzavřeno
      ↓
událost
      ↓
backend Portmonky
      ↓
Case
      ↓
75 % + 25 %
```

## goorn-zak → Portmonka

``` text
instalace
      ↓
událost
      ↓
backend Portmonky
      ↓
Case
      ↓
část 1 + část 2
```

Portmonka nemá číst interní databázi zdrojové aplikace přímo.

------------------------------------------------------------------------

# 12. Idempotence a integrita

Každý integrační zápis musí být bezpečný proti opakování.

Příklad:

``` text
eventId = goorn-123-installation
```

Pokud stejná událost přijde dvakrát:

``` text
1. přijetí → vytvořit
2. přijetí → ignorovat jako duplicitu
```

Nikdy:

``` text
1. přijetí → 1 případ
2. přijetí → 2 případy
```

------------------------------------------------------------------------

# 13. API vrstvy

Doporučené logické endpointy:

``` text
POST   /api/events
GET    /api/cases
GET    /api/cases/:id
POST   /api/cases
PATCH  /api/cases/:id

POST   /api/installments/:id/invoice
POST   /api/installments/:id/payment

GET    /api/summary
GET    /api/cashflow
GET    /api/timeline

POST   /api/scenarios
POST   /api/insights
```

Konkrétní hosting a implementace endpointů = TBD.

------------------------------------------------------------------------

# 14. Akce fakturace a platby

## Fakturace

Request:

``` json
{
  "invoicedAt": "2026-09-13"
}
```

Server ověří:

-   splátka existuje,
-   případ existuje,
-   splátka není PAID,
-   akce je oprávněná,
-   datum je validní.

## Platba

Request:

``` json
{
  "paidAt": "2026-09-14"
}
```

Server ověří:

-   splátka existuje,
-   částka je známá,
-   datum je validní.

Po uložení musí být všechny agregace přepočitatelné z primárních dat.

------------------------------------------------------------------------

# 15. Časový stroj

Časový stroj nesmí měnit produkční data.

Má vytvořit virtuální časový kontext:

``` text
REAL DATA
   +
SCENARIO PARAMETERS
   ↓
SIMULATED STATE
```

Příklad:

``` json
{
  "timeOffsetDays": 30,
  "paymentOffsetDays": -30,
  "goornRateMultiplier": 1
}
```

Simulace musí používat stejné deterministické finanční funkce jako
realita.

Rozdíl je pouze v parametrech.

------------------------------------------------------------------------

# 16. Laboratoř

Laboratoř nesmí zapisovat scénář do reality.

``` text
REALITY
   │
   ├── scenario A
   ├── scenario B
   └── scenario C
```

Každý scénář má:

-   identifikátor,
-   vstupní parametry,
-   vypočtený výsledek,
-   rozdíl oproti realitě.

Příklad:

``` json
{
  "scenario": {
    "paymentOffsetDays": -30
  },
  "result": {
    "cashflow30d": 48200,
    "deltaVsReality": 28000
  }
}
```

------------------------------------------------------------------------

# 17. Objevitel

Objevitel dostává strukturovaná data, nikoli přístup k libovolnému
databázovému prostoru.

Detekce základních jevů má být pokud možno deterministická:

-   opakování,
-   odchylka,
-   koncentrace,
-   časová mezera,
-   průsečík,
-   změna trendu.

Výsledek:

``` json
{
  "insightId": "ins_...",
  "type": "PATTERN",
  "title": "Možný opakující se vzorec",
  "evidence": [
    "...",
    "..."
  ],
  "confidence": 0.72
}
```

AI může následně vytvořit lidské vysvětlení.

------------------------------------------------------------------------

# 18. AI kontrakt

AI nesmí dostat pravomoc měnit finanční data.

Preferovaný tok:

``` text
Firestore / výpočty
        ↓
Insight data transfer object
        ↓
server
        ↓
Claude API
        ↓
interpretace
```

AI vstup má obsahovat pouze potřebná strukturovaná data.

Příklad:

``` json
{
  "period": "2026-01-01/2026-09-13",
  "sources": [
    {
      "name": "GOORN",
      "caseCount": 12,
      "paidTotal": 84000,
      "averageCase": 7000
    }
  ],
  "pattern": {
    "type": "PAYMENT_DELAY",
    "evidence": [...]
  }
}
```

AI výstup:

``` json
{
  "headline": "...",
  "explanation": "...",
  "hypothesis": "...",
  "questions": ["..."],
  "suggestedScenario": "..."
}
```

AI výstup se nesmí přímo použít jako finanční výpočet.

------------------------------------------------------------------------

# 19. Predikce

Predikce musí být technicky oddělená od skutečného cash flow.

Například:

``` text
actualCashflow
predictedCashflow
```

Nikdy nesmí dojít k jejich sloučení.

UI musí predikci označit:

**ODHAD · NE GARANCE**

Konkrétní predikční model je TBD.

První verze může používat transparentní pravidlový model. Složitější AI
predikce se mají přidat až po stabilizaci dat.

------------------------------------------------------------------------

# 20. UI datové vrstvy

Doporučené rozhraní klienta:

``` text
Domain model
     ↓
Selectors / calculations
     ↓
View models
     ↓
UI components
```

UI komponenta nesmí obsahovat vlastní finanční logiku.

Například:

``` text
SummaryCard
```

má dostat již vypočtenou hodnotu:

``` text
paidTotal = 35500
```

a nemá sama hledat splátky a rozhodovat, co je zaplaceno.

------------------------------------------------------------------------

# 21. Hlavní obrazovky

## TEĎ

Data:

``` text
readyToInvoice
nextExpected
actionCount
timeline
prediction
insight
```

## PŘÍJEM

Data:

``` text
paidIncome(period)
bySource
trend
recentPayments
```

## PŘÍPADY

Data:

``` text
cases[]
filters
search
```

## SOUHRN

Data:

``` text
total
paid
remaining
bySource
```

## ČAS

Data:

``` text
timeContext
timeline
simulatedMetrics
```

## OBJEVITEL

Data:

``` text
insights[]
evidence
hypothesis
```

## LABORATOŘ

Data:

``` text
scenarioParameters
baseline
scenarioResult
delta
```

------------------------------------------------------------------------

# 22. Navigace

Finanční základ:

``` text
TEĎ
PŘÍJEM
PŘÍPADY
SOUHRN
```

Experimentální vrstva:

``` text
ČAS
OBJEVITEL
LABORATOŘ
```

Přesný způsob navigace 07 MASTER se může ještě vizuálně doladit, ale
základní finanční pohledy musí zůstat snadno dostupné.

------------------------------------------------------------------------

# 23. Responsivita

Primární breakpoint:

**tablet portrait / landscape**

Sekundární:

**telefon**

Minimální požadavek:

-   žádné horizontální posouvání hlavního obsahu,
-   dostatečně velké touch targety,
-   čitelné částky,
-   ovládání použitelné jednou rukou tam, kde to dává smysl,
-   spodní navigace nesmí překrývat obsah.

------------------------------------------------------------------------

# 24. Identita a assety

Zakázáno:

**rublový symbol ani žádná jeho grafická podoba.**

To platí pro:

-   logo,
-   hlavičku,
-   favicon,
-   ikony,
-   ilustrace,
-   dekorativní prvky.

Současný nevhodný znak z technického prototypu se nesmí převzít.

Identita 07 MASTER má používat neutrální originální značku Portmonky.

------------------------------------------------------------------------

# 25. Persistence a offline chování

První fáze může používat lokální testovací data.

Produkční stav má používat persistentní backend.

Doporučení:

``` text
Firestore = source of truth
local cache = UX/offline cache
```

Offline změna musí být řešena explicitně; nesmí dojít k tichému
konfliktu dat.

------------------------------------------------------------------------

# 26. Autentizace a autorizace

Portmonka pracuje s osobními finančními údaji.

Produkční verze musí mít:

-   autentizaci,
-   autorizaci,
-   pravidla databáze,
-   oddělení uživatelských dat,
-   auditovatelnou změnu stavu.

Předpoklad první verze:

**jeden uživatel / jeden účet**

Multi-user model není potřeba řešit předem.

------------------------------------------------------------------------

# 27. Bezpečnost Claude API

Nikdy:

``` text
browser
   ↓
CLAUDE_API_KEY
```

Správně:

``` text
browser
   ↓
Portmonka backend
   ↓
secret
   ↓
Claude
```

API klíč musí být uložen jako serverový secret.

------------------------------------------------------------------------

# 28. Testovací strategie

Pravidlo projektu:

``` text
JEDEN KROK
   ↓
TEST
   ↓
VYHODNOCENÍ
   ↓
DALŠÍ KROK
```

## Unit testy

Nutné pro:

-   výpočet splátek,
-   výpočet stavu,
-   Pro-Factor +4 měsíce,
-   součty,
-   cash flow,
-   remaining,
-   scénáře,
-   idempotenci.

## Integrační testy

Nutné pro:

-   vytvoření případu,
-   přijetí externí události,
-   opakovanou událost,
-   fakturaci,
-   platbu,
-   agregace.

## UI testy

Nutné minimálně pro:

-   navigaci,
-   vytvoření případu,
-   změnu stavu,
-   zobrazení detailu,
-   Časový stroj,
-   Laboratoř.

------------------------------------------------------------------------

# 29. Referenční testovací data

Pro základní test lze použít současná testovací data:

### Pro-Factor

25 000 Kč

-   18 750 Kč
-   6 250 Kč

### GOORN --- Novák

42 000 Kč

-   21 000 Kč
-   21 000 Kč

### Domoveo.cz

14 500 Kč

### Grafika

8 500 Kč

### Nový test

40 000 Kč

-   20 000 Kč
-   20 000 Kč

Při testu nového případu musí být po přidání správně aktualizováno:

``` text
Celkem
Proplaceno
Zbývá
GOORN
Lze fakturovat
Čeká
```

Tato data jsou testovací, nikoli produkční.

------------------------------------------------------------------------

# 30. Akceptační kritéria finančního jádra

Finanční jádro je hotové až tehdy, když:

-   žádná agregace není závislá na AI,
-   součet splátek odpovídá případu,
-   skutečný příjem používá `paidAt`,
-   fakturace nemění skutečný příjem,
-   opakovaná integrační událost nevytvoří duplicitu,
-   datumové přechody stavů jsou deterministické,
-   chyba dat se neztratí tichou opravou,
-   stejné vstupy vždy dávají stejné výsledky.

------------------------------------------------------------------------

# 31. Akceptační kritéria UX

07 MASTER je implementačně přenesený až tehdy, když uživatel na Android
tabletu bez návodu zvládne:

1.  zjistit, co může fakturovat,
2.  zjistit, co čeká,
3.  zjistit, co skutečně přišlo,
4.  otevřít případ,
5.  pochopit stav splátky,
6.  označit fakturaci,
7.  označit platbu,
8.  zjistit, co se změnilo,
9.  otevřít objev,
10. spustit scénář.

------------------------------------------------------------------------

# 32. Vývojové pořadí

``` text
1. Technická kostra
        ↓
2. Datový model
        ↓
3. Deterministické výpočty
        ↓
4. Testovací data
        ↓
5. PŘÍPADY + detail
        ↓
6. TEĎ
        ↓
7. PŘÍJEM
        ↓
8. SOUHRN
        ↓
9. Živá časová osa
        ↓
10. Integrace
        ↓
11. ČAS
        ↓
12. OBJEVITEL
        ↓
13. AI interpretace
        ↓
14. LABORATOŘ
        ↓
15. produkční zabezpečení
```

Neimplementovat vše najednou.

------------------------------------------------------------------------

# 33. Co je nyní záměrně mimo rozsah

Dokud nebude schváleno jinak:

-   automatické účetnictví,
-   vystavování účetních dokladů,
-   napojení na bankovní účet,
-   multi-user spolupráce,
-   veřejný profil,
-   automatické finanční rozhodování AI,
-   komplexní ML predikční model,
-   přímé čtení interních databází zdrojových aplikací.

------------------------------------------------------------------------

# 34. Neuzavřená technická rozhodnutí

Tyto body zůstávají TBD:

1.  Firebase vs. Cloudflare jako hlavní backend.
2.  Přesná Firestore struktura kolekcí.
3.  Přesný autentizační mechanismus.
4.  Přesné API endpointy.
5.  Přesný mechanismus webhooků z Prodejního Taháku.
6.  Přesný mechanismus webhooků z `goorn-zak`.
7.  ~~GOORN pravidlo druhé splátky.~~ Uzavřeno 5. 10. 2026: pevné
    částky 3 190 + 2 530 Kč, viz §8.2.
8.  Predikční model.
9.  Finální navigace ČAS / OBJEVITEL / LABORATOŘ.
10. Finální identita Portmonky.

Tyto body nesmí být při implementaci svévolně „dopočítány".

------------------------------------------------------------------------

# 35. První implementační milestone

První skutečný vývojový milestone má být:

> **PORTMONKA CORE**

Musí obsahovat pouze:

-   backend / persistentní datový základ,
-   Case,
-   Installment,
-   stavový automat,
-   deterministické výpočty,
-   TEĎ,
-   PŘÍPADY,
-   PŘÍJEM,
-   SOUHRN,
-   detail případu,
-   testovací data.

Bez AI.

Bez Časového stroje.

Bez Laboratoře.

Bez integrací.

Teprve po úspěšném testu CORE se přidávají další vrstvy.

------------------------------------------------------------------------

# 36. Definition of Done pro CORE

CORE je hotový, když:

``` text
VYTVOŘIT PŘÍPAD
       ↓
VYTVOŘIT SPLÁTKY
       ↓
ČEKÁ
       ↓
LZE FAKTUROVAT
       ↓
VYFAKTUROVÁNO
       ↓
PROPLACENO
       ↓
PŘÍJEM
       ↓
SOUHRN
```

a všechny hodnoty jsou konzistentní po:

-   obnovení stránky,
-   změně obrazovky,
-   opakovaném načtení dat,
-   změně stavu,
-   změně data.

------------------------------------------------------------------------

# 37. Shrnutí architektury v jedné stránce

``` text
┌───────────────────────────────────────────────┐
│                 PORTMONKA UI                  │
│                                               │
│ TEĎ │ PŘÍJEM │ PŘÍPADY │ SOUHRN              │
│                                               │
│ ČAS │ OBJEVITEL │ LABORATOŘ                  │
└──────────────────────┬────────────────────────┘
                       │
                View models
                       │
                Domain logic
                       │
        ┌──────────────┴──────────────┐
        │                             │
  Deterministické                 AI interpretace
  finanční funkce                  a hypotézy
        │                             │
        └──────────────┬──────────────┘
                       │
                 Backend/API
                       │
              Firestore / DB
                       │
        ┌──────────────┴──────────────┐
        │                             │
 Prodejní Tahák                   goorn-zak
        │                             │
        └────────── events ───────────┘
```

------------------------------------------------------------------------

# 38. Závěrečné pravidlo

> **Nejdříve pravdivá data. Potom správné výpočty. Potom dobré UX. Potom
> objevy. A teprve potom AI.**

Portmonka má být zajímavá právě proto, že její hravá a inteligentní
vrstva stojí na pevném finančním základu.
