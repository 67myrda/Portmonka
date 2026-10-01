# PORTMONKA — DATOVÝ MODEL v2
## M&M + reálný model Domoveo

**Datum aktualizace:** 23. 9. 2026  
**Stav:** návrh pro implementaci CORE — není ještě produkční schéma  
**Navazuje na:** PORTMONKA MASTER CONTEXT, PORTMONKA 07 — MASTER, technickou specifikaci a CHECKPOINT 03 — Firestore Foundation + Security Rules

---

## 1. Proč model aktualizujeme

Původní model Portmonky vznikal pro čtyři zdroje příjmů a předpokládal, že Domoveo je nejjednodušší zdroj s jednou provizní částí.

Reálné zapojení do Domovea tento předpoklad zpřesnilo.

Nově víme, že:

- Portmonka bude sledovat **společné finance M&M**;
- formální příjem může být veden na Moniku, ale pro Portmonku je finančním celkem M&M;
- Domoveo rozlišuje firemního a vlastního klienta;
- provize je 17 % nebo 25 % z ceny zakázky bez DPH;
- nárok na provizi vzniká podpisem objednávky;
- výplata je podmíněna provedením servisu;
- měsíc se uzavírá 10.;
- 11. ráno přichází e-mailem podklad s částkou pro fakturaci;
- Domoveo bude v první verzi zadáváno do Portmonky ručně;
- pozdější automatizace z e-mailu je možná, ale není součástí CORE.

Tato aktualizace proto **nemění základní princip PŘÍPAD → SPLÁTKY**, ale zpřesňuje vlastnictví financí, původ případu a časovou logiku nároku, fakturace a skutečné platby.

---

## 2. Základní finanční jednotka

Portmonka pracuje s jedním finančním prostorem:

```text
M&M
Myrda + Monča
společné finance
```

Nejde tedy o oddělené osobní účetnictví Myrdy a Moniky.

To, komu je formálně vystavena faktura nebo na koho je vedený účet ve zdrojové aplikaci, je doplňková informace. Pro základní finanční přehled Portmonky je rozhodující společný finanční celek M&M.

### Důležité oddělení pojmů

```text
TECHNICKÝ UŽIVATEL
Firebase Auth → userId

        ≠

FINANČNÍ VLASTNICTVÍ
M&M → společný finanční prostor
```

V první verzi zůstává technická autentizace a Firestore izolace založená na `userId`, protože CHECKPOINT 03 ji již ověřil.

Tato aktualizace proto **nevyžaduje změnu Security Rules**.

Budoucí možnost, aby se do stejného finančního prostoru přihlásili samostatně Myrda i Monika, zůstává otevřená. To bude samostatné rozhodnutí a samostatná změna bezpečnostního modelu.

---

## 3. Datový model

Základ zůstává:

```text
FINANČNÍ PROSTOR M&M
        │
        └── PŘÍPAD
              ├── zdroj
              ├── označení
              ├── klient
              ├── zdrojová událost
              ├── metadata zdroje
              └── SPLÁTKY / NÁROKY
                    ├── částka
                    ├── vznik nároku
                    ├── podmínka
                    ├── datum splnění podmínky
                    ├── datum fakturace
                    ├── očekávaná platba
                    ├── skutečná platba
                    └── stav
```

Pojem „splátka“ zůstává zachován kvůli kompatibilitě s dosavadním MASTER modelem.

Pro Domoveo však jedna splátka znamená prakticky **jeden nárok na provizi**, nikoli nutně klasickou splátku rozdělenou na části.

---

# 4. PŘÍPAD

Minimální společná struktura:

```text
Case
├── id
├── financeSpaceId
├── source
├── title
├── clientName
├── triggerDate
├── triggerType
├── totalAmount
├── sourceData
├── createdAt
└── installments[]
```

### `financeSpaceId`

Identifikace finančního prostoru.

Pro současný projekt:

```text
M&M
```

Technická hodnota nemusí být nutně zobrazovaný text „M&M“.

### `source`

Zdroj příjmu:

```text
PRO_FACTOR
GOORN
DOMOVEO
GRAFIKA
```

### `title`

Krátké lidské označení případu.

Například:

```text
Novák – servis oken
Trutnov – plakáty
Dvořák – GOORN
A5 leták
```

### `clientName`

Volitelný název klienta.

U některých zdrojů může být vhodnější jiné označení případu; proto není klientská identita povinnou podmínkou existence Case.

### `triggerDate`

Datum hlavní události, která případ vytvořila nebo spustila jeho finanční logiku.

Například:

- Pro-Factor → uzavření města,
- GOORN → relevantní obchodní událost podle pravidel GOORN,
- Domoveo → podpis objednávky,
- Grafika → vznik zakázky.

### `triggerType`

Typ události, aby Portmonka nemusela význam `triggerDate` domýšlet.

Například:

```text
CITY_CLOSED
ORDER_SIGNED
INSTALLATION
JOB_CREATED
```

Přesné enumy budou potvrzeny při implementaci jednotlivých zdrojů.

---

# 5. SPLÁTKA / NÁROK

Dosavadní model měl především:

```text
amount
dueDate
invoicedDate
paymentDate
status
```

Pro skutečné použití Portmonky je vhodné jej zpřesnit.

```text
Installment
├── id
├── label
├── amount
├── claimDate
├── blockingCondition
├── conditionSatisfiedDate
├── invoiceEligibleDate
├── invoicedDate
├── expectedPaymentDate
├── paymentDate
└── status
```

## Význam jednotlivých dat

### `amount`

Deterministicky vypočtená částka nároku.

### `claimDate`

Datum, kdy nárok ekonomicky vznikl.

U Domovea:

```text
podpis objednávky
```

### `blockingCondition`

Volitelná podmínka, která brání fakturaci nebo výplatě.

Například Domoveo:

```text
SERVICE_COMPLETED
```

### `conditionSatisfiedDate`

Datum splnění této podmínky.

U Domovea:

```text
datum provedeného servisu
```

### `invoiceEligibleDate`

Datum, kdy je možné nárok fakturovat.

Toto pole je záměrně oddělené od `claimDate`.

Nárok může existovat dříve, než je možné jej fakturovat.

### `invoicedDate`

Skutečné datum vystavení faktury.

Ruční zadání.

### `expectedPaymentDate`

Očekávané datum platby, pokud je známé nebo deterministicky odvoditelné.

Nemusí být vždy vyplněno.

### `paymentDate`

Skutečné datum přijetí peněz.

To je rozhodující údaj pro skutečný příjem.

---

# 6. Stav

Stav zůstává uživatelsky jednoduchý.

Základní čtyři stavy z MASTERu:

```text
ČEKÁ
LZE FAKTUROVAT
VYFAKTUROVÁNO
PROPLACENO
```

Interně však může Portmonka pracovat s podmínkami a daty, ze kterých stav deterministicky odvodí.

Například Domoveo:

```text
objednávka podepsána
        ↓
nárok vznikl
        ↓
čeká na servis
        ↓
servis proveden
        ↓
lze fakturovat
        ↓
vyfakturováno
        ↓
proplaceno
```

Tím se zachovává jednoduché UX a současně neztrácíme důležitou informaci o tom, proč případ ještě není možné posunout dál.

---

# 7. DOMOVEO — konkrétní pravidlo

Domoveo má nyní potvrzený model:

```text
Cena zakázky bez DPH
        ↓
typ klienta
        ├── FIREMNÍ → 17 %
        └── VLASTNÍ → 25 %
        ↓
provize M&M
```

### Vstupní údaje pro ruční zadání

Minimální formulář:

```text
Zdroj: DOMOVEO

Klient: __________

Datum podpisu objednávky: __________

Typ klienta:
○ Firemní
○ Vlastní klient

Cena zakázky bez DPH: __________
```

Portmonka sama vypočítá:

```text
provize = cena bez DPH × sazba
```

Příklad:

```text
50 000 Kč × 25 % = 12 500 Kč
```

Uživatel částku provize ručně nezadává.

---

# 8. DOMOVEO — život případu

Domoveo Case má jednu základní provizní položku.

```text
CASE
Domoveo / Novák

objednávka podepsána
        ↓
nárok = 12 500 Kč
        ↓
čeká na servis
        ↓
servis proveden
        ↓
nárok je připraven k dalšímu procesu
        ↓
měsíční uzávěrka
        ↓
podklad e-mailem
        ↓
faktura
        ↓
výplata
```

Toto je přesnější než původní představa:

```text
Domoveo = jedna jednoduchá splátka bez časové logiky
```

Domoveo má sice jednu provizní část, ale její životní cyklus obsahuje několik významných událostí.

---

# 9. DOMOVEO — bonus

Bonusový program je evidován jako samostatná budoucí finanční logika.

Podle dostupných údajů závisí na současném splnění:

- objemu,
- průměrného počtu doporučení.

Bonus je společný pro M&M.

Například dostupná tabulka obsahuje:

```text
400 000 Kč + 8 ref. → 8 000 Kč
400 000 Kč + 10 ref. → 10 000 Kč
400 000 Kč + 12 ref. → 15 000 Kč

500 000 Kč + 8 ref. → 10 000 Kč
500 000 Kč + 10 ref. → 15 000 Kč
500 000 Kč + 12 ref. → 20 000 Kč

600 000 Kč + 8 ref. → 15 000 Kč
600 000 Kč + 10 ref. → 20 000 Kč
600 000 Kč + 12 ref. → 30 000 Kč
```

Tato pravidla zatím **nebudou implementována do CORE**.

Nejdříve potřebujeme ověřit jejich praktickou interpretaci a způsob, jakým Domoveo bonus skutečně připisuje.

Bonus proto zatím není součástí základního výpočtu Domoveo Case.

---

# 10. Ostatní zdroje

## Pro-Factor

Zůstává:

```text
PŘÍPAD
 ├── 75 % – první část
 └── 25 % – druhá část
```

Spouštěč druhé části:

```text
uzavření města + 4 měsíce
```

Přesná technická integrační událost zůstává otevřená.

---

## GOORN

Zůstává:

```text
PŘÍPAD
 ├── 1. část
 └── 2. část
```

Poměr částí zatím není potvrzen jako jednotné systémové pravidlo.

Proto zůstává case-by-case, dokud nebude potvrzen opak.

---

## Grafika

Jednorázový případ:

```text
PŘÍPAD
 └── jedna položka
```

Ruční zadání.

---

# 11. Zdroj dat

Nově je stav:

| Zdroj | První verze | Později |
|---|---|---|
| Domoveo | ruční zadání | možná automatizace z e-mailu |
| Pro-Factor | ruční / připraveno pro integraci | zápis ze zdrojové aplikace |
| GOORN | ruční / připraveno pro integraci | zápis ze zdrojové aplikace |
| Grafika | ruční | ruční |

Princip zůstává:

> Zdrojová aplikace má při relevantní události předat Portmonce jednoduchý finanční záznam; Portmonka nemá obcházet interní databáze zdrojových aplikací.

U Domovea se v první fázi používá ruční zadání, protože Portmonka nemá přímé API napojení.

Pozdější e-mailová automatizace je možná další fáze, nikoli součást CORE.

---

# 12. Firestore — současný základ

Dosavadní ověřená cesta z CHECKPOINTU 03 zůstává:

```text
users/{userId}/cases/{caseId}/installments/{installmentId}
```

Security Rules jsou založené na:

```text
request.auth.uid == userId
```

To se nyní chápe jako:

```text
Firebase userId
        ↓
technický přístup k Portmonce

financeSpaceId
        ↓
logický finanční celek M&M
```

V první verzi může jeden Firebase účet obsahovat jeden finanční prostor M&M.

Rozšíření na více přihlášených členů stejného finančního prostoru je budoucí změna, nikoli důvod měnit ověřený CHECKPOINT 03.

---

# 13. Deterministické výpočty

Portmonka musí výpočty provádět sama a předvídatelně.

Příklad Domoveo:

```text
baseAmount = cena zakázky bez DPH

rate =
  FIREMNÍ → 0.17
  VLASTNÍ → 0.25

commission = baseAmount × rate
```

AI nesmí rozhodovat:

```text
„Tady bych asi počítal 25 %.“
```

AI může později vysvětlit:

```text
„Tento případ je veden jako vlastní klient,
proto Portmonka použila sazbu 25 %.“
```

Výsledek musí pocházet z deterministické logiky.

---

# 14. Co se touto aktualizací mění

### POTVRZENO

1. Portmonka pracuje s financemi M&M jako jedním celkem.
2. Domoveo je plnohodnotný zdroj příjmů CORE.
3. Domoveo má sazbu 17 % pro firemního klienta.
4. Domoveo má sazbu 25 % pro vlastního klienta.
5. Základ výpočtu je cena zakázky bez DPH.
6. Nárok vzniká podpisem objednávky.
7. Výplata závisí na provedení servisu.
8. První zadávání Domovea bude ruční.
9. Automatizace z e-mailu je až pozdější fáze.
10. Bonus je společný pro M&M.
11. Bonus zatím není součástí CORE výpočtu.

### ZPŘESNĚNO

Původní `dueDate` už nestačí jako jediný časový údaj.

Portmonka potřebuje rozlišovat:

```text
vznik nároku
↓
splnění podmínky
↓
možnost fakturace
↓
fakturace
↓
očekávaná platba
↓
skutečná platba
```

---

# 15. Co zůstává otevřené

Bez dalšího potvrzení se nemá implementovat:

### Domoveo
- přesný okamžik, kdy po servisu vzniká možnost fakturace;
- zda je výplata vždy vázaná na konkrétní měsíční uzávěrku stejným způsobem;
- přesná struktura údajů v e-mailovém podkladu;
- přesné pravidlo bonusu v reálném provozu.

### GOORN
- pevný poměr první a druhé části.

### Pro-Factor
- přesný technický trigger pro budoucí automatický zápis.

---

# 16. Dopad na CORE

CORE se nyní staví v tomto pořadí:

```text
1. Finance M&M
        ↓
2. PŘÍPAD
        ↓
3. SPLÁTKA / NÁROK
        ↓
4. deterministický výpočet
        ↓
5. stav životního cyklu
        ↓
6. ruční zadání
        ↓
7. PŘÍJEM
        ↓
8. TEĎ / PŘÍPADY / SOUHRN
```

Domoveo bude první zdroj, na kterém si ruční zadávání skutečně ověříme.

Neznamená to, že CORE bude „aplikace jen pro Domoveo“.

Znamená to, že Domoveo poskytne první reálný provozní test společného modelu.

---

# 17. Důležité rozhodnutí pro další implementaci

**NEMĚNÍME nyní Security Rules.**

CHECKPOINT 03 zůstává platný:

```text
vlastní data → ALLOW
cizí data → DENY
```

Nejdříve postavíme CORE uvnitř již ověřené bezpečnostní hranice.

Pokud někdy budeme chtít:

```text
Myrda → přihlášení
Monča → přihlášení
        ↓
společný prostor M&M
```

pak vznikne samostatný návrh:

```text
users
memberships
financeSpaces
```

a nový bezpečnostní test.

To není součást současného kroku.

---

# 18. Aktuální cílový model

```text
                    M&M
             společné finance
                    │
        ┌───────────┼───────────┐
        ↓           ↓           ↓
   PRO-FACTOR     GOORN      DOMOVEO
        │           │           │
      Case         Case        Case
        │           │           │
   2 nároky      2 nároky     1 nárok
        │           │           │
        └───────────┼───────────┘
                    ↓
              ŽIVOTNÍ CYKLUS
                    ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
    FAKTURACE    OČEKÁVÁNÍ    PLATBA
                                ↓
                             PŘÍJEM
```

Nad tím později:

```text
ČAS
 ↓
OBJEVITEL
 ↓
AI
 ↓
LABORATOŘ
```

---

## 19. Stav této aktualizace

**DATOVÝ MODEL v2 — připraven pro implementaci CORE**

Tato verze je návrhová aktualizace na základě reálného procesu Domoveo a potvrzení, že Portmonka sleduje společné finance M&M.

Další krok po schválení tohoto modelu není další teoretizování, ale převod modelu do konkrétního Firestore schématu a následně první skutečné CORE funkce.

**JEDEN KROK → TEST → VYHODNOCENÍ → DALŠÍ KROK**
