# PORTMONKA --- PROGRESS HANDOFF / PROJECT CHECKPOINT

## Stav projektu po 1. 10. 2026

**Účel dokumentu:**\
Tento dokument je předávací zpráva pro další práci na Portmonce, zejména
pro Claude pracujícího s GitHub repozitářem. Zachycuje skutečný posun od
návrhové fáze k funkčnímu CORE, ověřené technické kroky, aktuální stav
GitHubu/Firebase, provedené testy, známé limity, otevřená rozhodnutí a
přesný výchozí bod pro další práci.

> **DŮLEŽITÉ:** Tento dokument je pracovní handoff / stavový záznam.
> Není náhradou za `PORTMONKA_MASTER_CONTEXT.md`, `PORTMONKA_07_MASTER`,
> technickou specifikaci ani další projektové zdroje. Při rozporu mají
> přednost zdrojové dokumenty definované v hierarchii níže.

------------------------------------------------------------------------

# 1. AKTUÁLNÍ STAV V JEDNÉ VĚTĚ

Portmonka má nyní funkční a reálně otestovaný základní CORE: uživatel se
přihlásí přes Google, data se ukládají do Firestore, případy obsahují
splátky, stav splátky se deterministicky odvozuje, splátku lze označit
jako vyfakturovanou a následně proplacenou, skutečné platby se propisují
do PŘÍJMU a SOUHRN se přepočítává z primárních dat.

------------------------------------------------------------------------

# 2. PRODUKTOVÝ KONTEXT

Portmonka není účetnictví.

Je to osobní nástroj pro evidenci a řízení provizních příjmů. Základní
produktové pohledy jsou:

-   **TEĎ**
-   **PŘÍJEM**
-   **PŘÍPADY**
-   **SOUHRN**

Nad nimi mají později vzniknout experimentální/analytické vrstvy:

-   **ČAS / Časový stroj**
-   **OBJEVITEL**
-   **LABORATOŘ**
-   **AI / interpretace**

Zásadní princip:

> **Nejdříve pravdivá data. Potom správné výpočty. Potom dobré UX. Potom
> objevy. A teprve potom AI.**

AI nesmí být zdrojem finanční pravdy. Finanční výpočty musí být
deterministické.

------------------------------------------------------------------------

# 3. PROJEKTOVÁ HIERARCHIE ZDROJŮ

Při další práci je nutné respektovat tuto hierarchii:

1.  `PORTMONKA_MASTER_CONTEXT.md` --- hlavní produktový kontext / zdroj
    pravdy
2.  `PORTMONKA_07_MASTER` --- schválený UX a produktový model
3.  `PORTMONKA_TECHNICKA_SPECIFIKACE_v1.1_CORE.md` --- technický
    implementační rámec
4.  `PORTMONKA_AUDIT_07_MASTER_vs_TECH_SPEC` --- kontrolní dokument
    souladu
5.  `PORTMONKA_DATOVY_MODEL_v2_MM_DOMOVEO` --- zpřesnění datového modelu
    a Domovea
6.  projektové prototypy a předchozí UX experimenty --- referenční
    materiál
7.  GitHub repozitář --- technický zdroj aktuální implementace
8.  aktuální Firebase / Firestore --- živý provozní stav
9.  skutečné manuální testy --- důkaz funkčnosti
10. budoucí integrace, Časový stroj, Objevitel, AI a Laboratoř

Při rozporu mezi zdroji se nemá problém tiše „opravit". Rozpor je třeba
identifikovat, ověřit a rozhodnout.

------------------------------------------------------------------------

# 4. PRACOVNÍ PRAVIDLO

Celý projekt má pokračovat v režimu:

**JEDEN KROK → TEST → VYHODNOCENÍ → DALŠÍ KROK**

To je důležité zejména proto, že uživatel není programátor a pracuje
primárně na Android tabletu.

Před významnou implementací:

1.  porovnat změnu s MASTER CONTEXT,
2.  porovnat ji s 07 MASTER a relevantním prototypem,
3.  ověřit technickou specifikaci,
4.  změnit pouze jeden logický krok,
5.  provést test,
6.  výsledek skutečně zkontrolovat,
7.  teprve potom pokračovat.

**Nikdy neprezentovat opravu jako hotovou bez kontroly skutečného
výsledku.**

------------------------------------------------------------------------

# 5. HLAVNÍ PRODUKTOVÁ LOGIKA

Základní objektový model:

``` text
PŘÍPAD
 ├── zdroj
 ├── označení
 ├── trigger / hlavní datum
 └── SPLÁTKY
      ├── částka
      ├── datum nároku
      ├── případné podmínky
      ├── datum fakturace
      ├── očekávaná platba
      ├── skutečná platba
      └── odvozený stav
```

Uživatelské stavy:

``` text
ČEKÁ
LZE FAKTUROVAT
VYFAKTUROVÁNO
PROPLACENO
```

Interně:

``` text
WAITING
   ↓
READY
   ↓
INVOICED
   ↓
PAID
```

Zásadní rozlišení:

``` text
NÁROK ≠ FAKTURACE ≠ PLATBA
```

Skutečný cash flow se řídí `paidAt`.

------------------------------------------------------------------------

# 6. TECHNICKÝ DATOVÝ MODEL

Primární Firestore struktura:

``` text
users/{userId}
users/{userId}/cases/{caseId}
users/{userId}/cases/{caseId}/installments/{installmentId}
users/{userId}/events/{eventId}
```

`financeSpaceId` může být uložen jako obchodní identifikace finančního
prostoru, aktuálně `MM`, ale v první verzi není bezpečnostní hranicí.

Bezpečnost je založena na Firebase `userId` a Security Rules.

### Case

Aktuální implementace používá zejména:

``` text
id
financeSpaceId
source
title
triggerDate
triggerType
totalAmountMinor
currency
createdAt
updatedAt
installments[]
```

Datový model v2 navíc počítá s údaji typu:

``` text
clientName
sourceData
```

pokud budou pro konkrétní zdroj potřeba.

### Installment

Aktuální CORE používá zejména:

``` text
id
label
amountMinor
claimDate
blockingCondition
conditionSatisfiedDate
invoiceEligibleDate
invoicedAt
expectedPaymentDate
paidAt
```

Stav se v aktuálním prototypu neukládá jako autoritativní finanční
pravda; odvozuje se z dat.

------------------------------------------------------------------------

# 7. DETERMINISTICKÉ FINANČNÍ PRINCIPY

Částky jsou ukládány jako integer minor units:

``` text
amountMinor
```

Pro CZK tedy haléře.

UI zobrazuje Kč.

Zakázáno v Portmonce:

-   rublový symbol `₽`,
-   jakákoli jeho grafická podoba v UI, ikonách nebo grafice.

Základní výpočty:

``` text
total = součet amountMinor všech splátek

paidIncome(period)
= součet amountMinor tam, kde paidAt patří do období

readyToInvoice
= součet splátek ve stavu READY

remaining
= total - paid
```

Kontrola integrity:

``` text
součet splátek = totalAmountMinor
```

Pokud nesouhlasí, systém nemá data tiše opravovat.

------------------------------------------------------------------------

# 8. AKTUÁLNÍ PRAVIDLA ZDROJŮ

## Pro-Factor

Aktuální CORE model:

``` text
75 % — první část
25 % — druhá část
```

Druhá část:

``` text
triggerDate + 4 měsíce
```

Spouštěč je uzavření města.

Přesný integrační event ze zdrojové aplikace je stále TBD.

## GOORN

Dvě části.

Poměr není potvrzen jako globální pevné pravidlo.

Aktuální CORE umožňuje poměr nastavit pro konkrétní případ, s výchozí
hodnotou 50/50 a druhou částí standardně za 12 měsíců.

Přesný integrační event ze zdrojové aplikace je TBD.

## Domoveo.cz

Datový model v2 zpřesňuje Domoveo:

-   firemní klient → 17 %
-   vlastní klient → 25 %
-   základ je cena zakázky bez DPH
-   nárok vzniká podpisem objednávky
-   výplata je podmíněna dokončením servisu
-   první verze má být ruční
-   případná e-mailová automatizace je pozdější fáze
-   bonus není součástí současného CORE výpočtu

## Grafika

Ruční jednorázový případ / zakázka.

------------------------------------------------------------------------

# 9. FIREBASE / AUTH --- OVĚŘENÝ STAV

Firebase projekt:

``` text
Portmonka
projectId: portmonka-951967
```

Firebase Web App:

``` text
Portmonka Web
```

Authentication:

-   Google provider je zapnutý
-   Google login přes popup je funkční
-   sign-out je funkční
-   redirect varianta byla testována a selhala chybou související s
    počátečním stavem / storage; proto se nepoužívá

Autorizovaná doména:

``` text
67myrda.github.io
```

Firebase SDK:

``` text
12.19.0
```

------------------------------------------------------------------------

# 10. FIRESTORE --- OVĚŘENÝ STAV

Firestore:

``` text
Edition: Standard
Database: (default)
Region: europe-central2 (Warsaw)
Mode: production
```

Security Rules jsou publikované.

Aktuální živá pravidla i GitHub verze obsahují:

``` text
/users/{userId}
/users/{userId}/cases/{caseId}
/users/{userId}/cases/{caseId}/installments/{installmentId}
/users/{userId}/events/{eventId}
```

Základní pravidlo vlastnictví:

``` text
request.auth != null
&& request.auth.uid == userId
```

------------------------------------------------------------------------

# 11. FIRESTORE SECURITY CHECKPOINT

Byl proveden skutečný test přes GitHub Pages na Android tabletu.

Ověřeno:

``` text
Firebase Auth                         PASS
vlastní WRITE                        PASS
vlastní READ                         PASS
cizí READ                            DENY PASS
cizí WRITE                           DENY PASS
cleanup testovacích dat              PASS
```

Tím byla ověřena základní bezpečnostní hranice:

``` text
přihlášený uživatel
        ↓
vlastní userId
        ↓
vlastní Firestore prostor = ALLOW

cizí userId = DENY
```

------------------------------------------------------------------------

# 12. AKTUÁLNÍ GITHUB

Repozitář:

``` text
67myrda/Portmonka
```

Branch:

``` text
main
```

Repozitář je veřejný.

Aktuální ověřené soubory:

``` text
index.html
firestore.rules
```

Aktuální `firestore.rules` blob SHA:

``` text
f8dcf6c08c5b77ccb705b0e13f9207e7da3df639
```

Aktuální `index.html` blob SHA:

``` text
2016b3bb1031ddc73bf0c43228bd731e205adeef
```

Poslední ověřený commit pro Rules:

``` text
62f7e726214c7c390aacb5e20e92017902e9f9c1
Update firestore.rules
```

Datum posledního ověřeného commit času:

``` text
2026-10-01 19:27:33 UTC
```

Poznámka:

GitHub connector měl v minulosti problém s přímým zápisem
(`403 Resource not accessible by integration`). Změny byly proto v této
fázi prováděny přes GitHub UI na Androidu.

**Do projektu ani do dokumentů nikdy nevkládat žádný PAT, API token nebo
jiné tajné údaje.**

------------------------------------------------------------------------

# 13. AKTUÁLNÍ `index.html`

Současný produkční prototyp je stále jediný soubor:

``` text
index.html
```

Obsahuje:

-   Firebase initialization
-   Google popup auth
-   Firestore
-   čtyři hlavní view
-   modal pro nový případ
-   detail případu
-   deterministic status
-   fakturaci
-   platbu
-   Příjem
-   Souhrn
-   auditní events
-   integrity check
-   responzivní UI pro tablet/telefon

Firebase konfigurace je přímo v klientském souboru pouze v rozsahu
veřejné Firebase Web konfigurace. Citlivé backendové klíče do klienta
nepatří.

------------------------------------------------------------------------

# 14. DŮLEŽITÁ OPRAVA `window.*`

V původní implementaci byly akční funkce uvnitř:

``` html
<script type="module">
```

Inline HTML `onclick` proto neměly k funkcím přístup.

Důsledek:

``` text
Označit vyfakturováno
```

nereagovalo.

Oprava:

``` javascript
window.markInvoiced=markInvoiced;
window.markPaid=markPaid;
window.openDetail=openDetail;
window.removeCase=removeCase;
```

Tato oprava byla následně:

1.  zapsána do aktuálního `index.html`,
2.  nahrána na GitHub,
3.  ověřena na Android tabletu v Opera,
4.  potvrzena jako funkční.

------------------------------------------------------------------------

# 15. AKTUÁLNÍ STAV FUNKČNÍHO CORE

Reálně otestovaný řetězec:

``` text
PŘÍPAD
   ↓
SPLÁTKA
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

Testovací případ:

``` text
Test core - Litomyšl
```

Celková hodnota:

``` text
10 000 Kč
```

První splátka:

``` text
7 500 Kč
```

Byla:

1.  označena jako vyfakturovaná,
2.  označena jako proplacená,
3.  zobrazena jako 7 500 Kč v PŘÍJMU,
4.  zohledněna v SOUHRNU.

Výsledek SOUHRNU:

``` text
Celkem      10 000 Kč
Proplaceno   7 500 Kč
Zbývá        2 500 Kč
```

Druhá část zůstala jako budoucí nárok.

Tento test je důležitý, protože nešlo pouze o syntaktický nebo lokální
test. Byla ověřena skutečná komunikace:

``` text
Android / Opera
      ↓
GitHub Pages
      ↓
Firebase Auth
      ↓
Firestore
      ↓
zpět do UI
```

------------------------------------------------------------------------

# 16. AKTUÁLNÍ STAV `events`

Aplikace zapisuje auditní události například:

``` text
CASE_CREATED
INSTALLMENT_CREATED
INSTALLMENT_INVOICED
INSTALLMENT_PAID
```

Event obsahuje mimo jiné:

``` text
type
caseId
installmentId
actorUid
occurredAt
```

Security Rules nyní umožňují bezpečný přístup k:

``` text
users/{userId}/events/{eventId}
```

pro daného autentizovaného uživatele.

------------------------------------------------------------------------

# 17. AKTUÁLNÍ INTEGRITY CHECK

Aplikace při načtení ověřuje:

``` javascript
sum(installments.amountMinor) === totalAmountMinor
```

Pokud nesouhlasí:

``` text
„Pozor: nalezen nekonzistentní součet splátek.“
```

Systém data tiše neopravuje.

To odpovídá technickému principu:

> Datová nekonzistence se má odhalit, ne skrýt.

------------------------------------------------------------------------

# 18. AKTUÁLNÍ STAV UX

Současný CORE má čtyři spodní navigační položky:

``` text
Teď
Příjem
Případy
Souhrn
```

### TEĎ

Zobrazuje:

-   Lze fakturovat
-   Čeká nejdřív
-   Akce
-   Výhled

### PŘÍJEM

Zobrazuje:

-   skutečně přišlo
-   období
-   podle zdroje
-   trend
-   poslední platby

### PŘÍPADY

Zobrazuje:

-   vyhledávání
-   filtr zdroje
-   případy
-   splátky a jejich stavy
-   detail

### SOUHRN

Zobrazuje:

-   Celkem
-   Proplaceno
-   Zbývá
-   rozpad podle zdroje

------------------------------------------------------------------------

# 19. CO JE HOTOVÉ

## Produkt

-   základní CORE koncept
-   čtyři hlavní finanční pohledy
-   případ + splátky
-   čtyři stavy
-   deterministická finanční logika

## Auth

-   Firebase Authentication
-   Google popup
-   sign-out

## Databáze

-   Firestore
-   persistentní data
-   cases
-   installments
-   events

## Bezpečnost

-   Security Rules
-   vlastnictví přes `userId`
-   ověřený ALLOW vlastní data
-   ověřený DENY cizí data

## UX

-   tablet-first
-   responzivní základ
-   vytvoření případu
-   detail
-   fakturace
-   platba
-   příjem
-   souhrn

## Audit

-   event zápisy
-   actor UID
-   timestamp
-   integrity check

## Test

-   reálný Android tablet
-   Opera
-   GitHub Pages
-   Firebase Auth
-   Firestore
-   end-to-end CORE flow

------------------------------------------------------------------------

# 20. CO NENÍ HOTOVÉ

Následující věci nejsou součástí současného hotového CORE:

-   automatická integrace Pro-Factor
-   automatická integrace GOORN
-   backend pro bezpečné Claude API volání
-   Časový stroj
-   Objevitel
-   Laboratoř
-   AI interpretační vrstva
-   produkční predikční model
-   pokročilá validace všech datových polí v Security Rules
-   multi-user / sdílený přístup více účtů k jednomu `financeSpaceId`
-   plnohodnotná Domoveo e-mailová automatizace
-   Domoveo bonusová logika

Tyto oblasti nemají být předčasně implementovány jen proto, že jsou
popsány v návrhu.

------------------------------------------------------------------------

# 21. OTEVŘENÁ PRODUKTOVÁ / TECHNICKÁ ROZHODNUTÍ

## GOORN

-   je poměr 50/50 skutečné pevné pravidlo, nebo případ od případu?
-   jaký je přesný integrační trigger?
-   jaký je přesný význam druhé části?

## Pro-Factor

-   jaký je přesný integrační event ze zdrojové aplikace?
-   jaké přesné údaje bude event předávat?

## Domoveo

-   přesný okamžik fakturovatelnosti po dokončení servisu
-   přesné měsíční uzávěrkové pravidlo
-   struktura e-mailového podkladu
-   skutečné praktické pravidlo bonusu

## Backend

-   finální volba Firebase Cloud Functions vs. jiná serverová vrstva
-   bezpečný backend pro Claude API
-   integrační API

------------------------------------------------------------------------

# 22. DŮLEŽITÁ ARCHITEKTONICKÁ ZÁSADA PRO DALŠÍ PRÁCI

Zdrojové aplikace nemají být přímo čteny Portmonkou.

Preferovaný princip:

``` text
ZDROJOVÁ APLIKACE
      ↓
EVENT
      ↓
PORTMONKA BACKEND
      ↓
PORTMONKA CASE / INSTALLMENTS
```

Portmonka má být autoritou pro svou vlastní evidenci, nikoli přímým
čtenářem interních databází cizích aplikací.

------------------------------------------------------------------------

# 23. AI --- JAK S NÍ PRACOVAT

AI může:

-   interpretovat strukturovaná data,
-   hledat hypotézy,
-   vysvětlovat trendy,
-   klást otázky,
-   navrhovat scénáře.

AI nesmí:

-   určovat finanční částku místo deterministického výpočtu,
-   měnit finanční pravdu,
-   vytvářet „pravděpodobný" nárok jako skutečný nárok,
-   zapisovat své hypotézy jako realitu.

Tok:

``` text
PRIMÁRNÍ DATA
    ↓
DETERMINISTICKÉ VÝPOČTY
    ↓
STRUKTUROVANÁ DATA
    ↓
AI
    ↓
INTERPRETACE / HYPOTÉZA / OTÁZKA
```

------------------------------------------------------------------------

# 24. ČASOVÝ STROJ A LABORATOŘ

Tyto vrstvy nesmí měnit produkční realitu.

Správně:

``` text
REALITA
   │
   ├── scénář A
   ├── scénář B
   └── scénář C
```

Simulace používá stejné deterministické výpočty jako realita, ale s
jinými parametry.

Nikdy nesmí dojít k tomu, že výsledek scénáře bude uložen jako skutečná
finanční událost.

------------------------------------------------------------------------

# 25. OBJEVITEL

Objevitel má pracovat nad strukturovanými daty.

První detekce mají být pokud možno deterministické:

-   opakování,
-   odchylka,
-   koncentrace,
-   časová mezera,
-   průsečík,
-   změna trendu.

AI může následně pomoci s lidským vysvětlením.

------------------------------------------------------------------------

# 26. KONTROLNÍ AUDIT PROJEKTU

Před aktuálním pokračováním byl proveden audit:

``` text
07 MASTER
   ↕
technická specifikace
   ↕
datový model
   ↕
aktuální CORE
```

Zásadní produktový/technický rozpor nebyl nalezen.

Byla identifikována zejména potřeba přesněji rozlišovat:

``` text
claimDate
conditionSatisfiedDate
invoiceEligibleDate
invoicedAt
expectedPaymentDate
paidAt
```

Aktuální jednoduchý CORE používá `claimDate` jako základ pro automatické
zpřístupnění fakturace, což je přijatelné pro současnou ruční CORE fázi.
Složitější podmínkové zdroje, zejména Domoveo, budou vyžadovat přesnější
model.

------------------------------------------------------------------------

# 27. DNES PROVEDENÝ CHECKPOINT --- 1. 10. 2026

Kontrolováno přímo proti aktuálnímu GitHubu.

Ověřeno:

``` text
index.html                     OK
firestore.rules                OK
Firebase SDK 12.19.0           OK
Google popup                   OK
redirect auth nepoužit         OK
Firestore events               OK
window action exports          OK
deterministický status         OK
amountMinor                    OK
cash flow přes paidAt          OK
rublový symbol                 NEOBSAHUJE
events Security Rules          OK
```

Aktuální GitHub `firestore.rules` má 26 řádků a obsahuje
`/events/{eventId}`.

Aktuální živé Firebase Rules byly ověřeny screenshotem a odpovídají
GitHub verzi.

Výsledek:

**CHECKPOINT 1. 10. 2026 = PASS**

------------------------------------------------------------------------

# 28. INCIDENT / POUČENÍ Z DNES

Během aktualizace Rules vznikla chyba v pracovním postupu:

Byl předložen „opravený" obsah `firestore.rules`, který byl ve
skutečnosti stejný jako stará GitHub verze a stále neobsahoval
`/events`.

Uživatel správně zjistil, že po vložení textu do Firebase zmizel
indikátor změny, protože text byl totožný s aktuálním stavem.

Následně byla provedena správná kontrola:

1.  otevřeny živé Firebase Rules,
2.  ověřeno, že živý Firebase stav `/events` obsahuje,
3.  porovnán GitHub soubor,
4.  zjištěn nesoulad,
5.  GitHub `firestore.rules` aktualizován,
6.  GitHub výsledek znovu načten a ověřen.

### Pracovní závěr

Nikdy nepovažovat vlastní navrženou změnu za ověřenou jen proto, že
„vypadá správně".

Po každé změně je nutné ověřit:

``` text
PŮVODNÍ STAV
      ↓
ZMĚNA
      ↓
SKUTEČNÝ VÝSLEDEK
      ↓
POROVNÁNÍ S CÍLEM
```

Toto pravidlo je pro další práci na Portmonce závazné.

------------------------------------------------------------------------

# 29. DALŠÍ PRACOVNÍ PLÁN

Cílový termín:

**19. 10. 2026**

Plán:

``` text
1.–3. 10.
technický základ / Firestore / Rules / testy
        ↓
4.–7. 10.
CORE
        ↓
8.–10. 10.
TEĎ + PŘÍJEM
        ↓
11.–12. 10.
PŘÍPADY + SOUHRN
        ↓
13.–14. 10.
test všech čtyř zdrojů
        ↓
15. 10.
opravy
        ↓
16. 10.
první integrační vrstva
        ↓
17. 10.
produkční test Android tablet + Opera
        ↓
18. 10.
release candidate freeze
        ↓
19. 10.
launch
```

Tento plán je orientační pracovní plán. Pokud test odhalí problém v
základních datech nebo výpočtech, má přednost oprava před pokračováním.

------------------------------------------------------------------------

# 30. CO SE MÁ DĚLAT JAKO DALŠÍ KROK

Po tomto checkpointu není potřeba znovu otevírat:

-   Firebase Rules,
-   Google popup,
-   základní Firestore Foundation,
-   `window.*` opravu,
-   již otestovaný CORE lifecycle.

Další práce má pokračovat nad stabilním základem.

Nejbližší praktický krok:

**rozšířit a otestovat CORE tak, aby všechny čtyři zdroje byly schopny
reprezentovat své případy bez porušení deterministického modelu.**

Po každé změně:

``` text
JEDEN KROK
→ TEST
→ VYHODNOCENÍ
→ DALŠÍ KROK
```

------------------------------------------------------------------------

# 31. INSTRUKCE PRO CLAUDE

Při práci na repozitáři Portmonka:

1.  Nejprve načti a respektuj:

    -   `PORTMONKA_MASTER_CONTEXT.md`
    -   `PORTMONKA_07_MASTER`
    -   `PORTMONKA_TECHNICKA_SPECIFIKACE_v1.1_CORE.md`
    -   `PORTMONKA_AUDIT_07_MASTER_vs_TECH_SPEC`
    -   relevantní datový model a prototypy.

2.  Tento dokument používej jako:

    -   aktuální stavový handoff,
    -   přehled provedených testů,
    -   výchozí bod další implementace.

3.  Pokud zjistíš rozpor mezi tímto dokumentem a hlavním zdrojovým
    dokumentem:

    -   nerozhoduj sám,
    -   označ rozpor,
    -   ukaž konkrétní rozdíl,
    -   vyžádej rozhodnutí.

4.  Před významnou změnou:

    -   porovnej změnu s MASTER,
    -   ověř dopad na datový model,
    -   ověř dopad na existující UX,
    -   nepřepisuj existující funkční část jen kvůli estetice.

5.  Po každé implementaci:

    -   proveď test,
    -   ověř skutečný výsledek,
    -   až potom označ krok jako hotový.

6.  Nezaváděj AI do finančních výpočtů.

7.  Nepřidávej druhý autoritativní finanční zdroj vedle Firestore.

8.  Nepřidávej rublový symbol ani jeho grafickou podobu.

9.  Zachovej tablet-first přístup.

10. Nezjednodušuj produktový koncept ani UX bez explicitního rozhodnutí
    uživatele.

------------------------------------------------------------------------

# 32. AKTUÁLNÍ „GROUND TRUTH"

K 1. 10. 2026 večer je nejspolehlivější popis stavu:

``` text
                         PORTMONKA
                            │
             ┌──────────────┴──────────────┐
             │                             │
        FIREBASE                       GITHUB
             │                             │
     Auth + Firestore                 index.html
     + Security Rules                 firestore.rules
             │                             │
             └──────────────┬──────────────┘
                            │
                         CORE
                            │
             ┌──────────────┼──────────────┐
             ↓              ↓              ↓
           PŘÍPAD          SPLÁTKA       EVENTS
             │              │
             └──────┬───────┘
                    ↓
              deterministický
                  STATUS
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
        TEĎ       PŘÍJEM    SOUHRN
```

Tento základ je skutečný, funkční a otestovaný.

------------------------------------------------------------------------

# 33. ZÁVĚREČNÁ VĚTA PRO DALŠÍ PRÁCI

Portmonka už není pouze návrh obrazovek.

Máme ověřený persistentní základ, bezpečné oddělení uživatelských dat a
funkční CORE životní cyklus:

**PŘÍPAD → SPLÁTKA → LZE FAKTUROVAT → VYFAKTUROVÁNO → PROPLACENO →
PŘÍJEM → SOUHRN**

Další práce má být rozšířením tohoto ověřeného základu, nikoli návratem
na začátek.

------------------------------------------------------------------------

**Stav dokumentu:** aktuální k 1. 10. 2026\
**Stav projektu:** CORE funkční / další rozvoj pokračuje\
**Další princip:** JEDEN KROK → TEST → VYHODNOCENÍ → DALŠÍ KROK
