# PORTMONKA — CHECKPOINT 03
## Firestore Foundation + Security Rules

**Datum:** 15. 9. 2026  
**Projekt:** Portmonka  
**Firebase projekt:** Portmonka  
**Firestore databáze:** `(default)`  
**Region:** `europe-central2 (Warsaw)`  
**Navazuje na:** CHECKPOINT 02 — Auth Spike A: Firebase  
**Stav:** PASS

---

## 1. Cíl checkpointu

Ověřit základní produkční infrastrukturu Portmonky:

- vytvoření samostatné Cloud Firestore databáze,
- správnou základní lokaci databáze,
- nastavení Security Rules,
- propojení Firebase Authentication → Firestore,
- zápis vlastních dat,
- čtení vlastních dat,
- odmítnutí přístupu k datům jiného uživatele,
- odmítnutí zápisu do prostoru jiného uživatele,
- úklid testovacích dat.

Checkpoint byl proveden jako skutečný test přes GitHub Pages na Android tabletu, nikoli pouze jako lokální nebo teoretický test.

---

## 2. Nastavení Firestore

### Edition

Zvolena:

`Standard edition`

Enterprise edition nebyla pro současný projekt potřeba.

### Database ID

Použita výchozí databáze:

`(default)`

### Location

Zvolena:

`europe-central2 (Warsaw)`

Lokace byla zvolena jako evropská regionální databáze vhodná pro Portmonku. Firestore lokaci po vytvoření nelze změnit, proto byla tato volba provedena před vytvořením databáze.

### Initial security mode

Databáze byla vytvořena v:

`production mode`

Výchozí stav pravidel byl:

`allow read, write: if false;`

Databáze tedy nebyla po vytvoření klientské aplikaci otevřena.

---

## 3. Security Rules

Po vytvoření databáze byla nastavena a publikována pravidla založená na vlastnictví uživatelského prostoru:

```text
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId;

      match /cases/{caseId} {
        allow read, write: if request.auth != null
          && request.auth.uid == userId;

        match /installments/{installmentId} {
          allow read, write: if request.auth != null
            && request.auth.uid == userId;
        }
      }
    }
  }
}
```

### Základní bezpečnostní princip

Přihlášený uživatel může pracovat pouze s cestami pod vlastním:

`userId == request.auth.uid`

Cizí uživatelský prostor není klientovi přístupný.

---

## 4. Ověřený datový model

Test použil cestu:

```text
users/{userId}/cases/{caseId}/installments/{installmentId}
```

Testovací identifikát případu měl tvar:

```text
firestore-spike-{uid}
```

Testovací installment:

```text
test-installment
```

Testovací data byla vytvořena pouze za účelem ověření Firestore a po dokončení testu odstraněna.

---

## 5. Výsledek testů

### TEST 1 — Firebase Authentication

**Výsledek: PASS**

Google přihlášení přes popup bylo úspěšné.

Firebase vrátila autentizovaného uživatele a jeho UID. Testovací stránka následně použila toto UID pro sestavení vlastní Firestore cesty.

---

### TEST 2 — WRITE vlastních dat

**Výsledek: PASS**

Byl úspěšně vytvořen:

- vlastní testovací `case`,
- vlastní testovací `installment`.

Tím bylo ověřeno:

```text
Firebase Auth
    ↓
autentizovaný userId
    ↓
Firestore
    ↓
vlastní uživatelský prostor
```

---

### TEST 3 — READ vlastních dat

**Výsledek: PASS**

Vlastní testovací installment byl úspěšně načten.

Ověřeno bylo také:

- `amount`,
- `ownerUid`.

`ownerUid` odpovídal autentizovanému uživateli.

---

### TEST 4 — READ cizího userId

**Výsledek: DENY READ PASS**

Test se pokusil načíst data pod jiným, cizím `userId`.

Firestore správně vrátil:

```text
permission-denied
```

Přístup byl odmítnut.

---

### TEST 5 — WRITE pod cizím userId

**Výsledek: DENY WRITE PASS**

Test se pokusil vytvořit data pod jiným `userId`.

Firestore správně vrátil:

```text
permission-denied
```

Neautorizovaný zápis byl odmítnut.

---

### TEST 6 — Cleanup

**Výsledek: CLEANUP PASS**

Vlastní testovací `case` a `installment` byly úspěšně odstraněny.

Po dokončení testu nezůstala testovací data v použitém testovacím prostoru.

---

## 6. Celkové vyhodnocení

| Oblast | Výsledek |
|---|---|
| Firestore databáze vytvořena | PASS |
| Region | PASS |
| Production mode | PASS |
| Security Rules publikovány | PASS |
| Firebase Auth → Firestore | PASS |
| Vlastní WRITE | PASS |
| Vlastní READ | PASS |
| Cizí READ | DENY PASS |
| Cizí WRITE | DENY PASS |
| Cleanup | PASS |

### CHECKPOINT 03

**FIRESTORE FOUNDATION + SECURITY RULES = PASS**

Základní bezpečnostní hranice mezi uživatelskými prostory je funkční a byla ověřena skutečným klientským testem.

---

## 7. Co checkpoint dokazuje

Checkpoint dokazuje funkčnost základního řetězce:

```text
Google
  ↓
Firebase Authentication
  ↓
authenticated userId
  ↓
Cloud Firestore
  ↓
Security Rules
  ↓
vlastní data: ALLOW
cizí data: DENY
```

Toto je základ, na kterém může být postavena skutečná persistentní část Portmonky.

---

## 8. Co checkpoint zatím nedokazuje

Checkpoint není kompletní bezpečnostní audit celé aplikace.

Zatím nebylo testováno například:

- validování obsahu jednotlivých finančních polí,
- omezení povolených stavů splátek,
- ochrana proti zápisu nepovolených polí,
- validace datových typů,
- serverová logika,
- integrace Pro-Factor → Portmonka,
- integrace GOORN → Portmonka,
- produkční finanční výpočty.

Tyto oblasti budou řešeny až v odpovídajících dalších krocích.

---

## 9. Důležité projektové rozhodnutí

Pro Portmonku zůstává platný princip:

> **Portmonka není účetnictví.**

Finanční částky, data a výpočty musí být deterministické a ověřitelné. AI nebude zdrojem finanční pravdy.

Firestore v této fázi řeší především:

- persistentní data,
- autentizaci,
- oddělení uživatelských dat,
- bezpečnostní hranice.

---

## 10. Pracovní poznámka

Testovací stránka:

`firestore-spike.html`

sloužila pouze jako izolovaný technický Spike.

Není součástí produkčního UX Portmonky.

Další práce má pokračovat podle principu:

**JEDEN KROK → TEST → VYHODNOCENÍ → DALŠÍ KROK**

---

## 11. Další plánovaný krok

Po tomto checkpointu je připravena půda pro další fázi:

**Portmonka CORE**

Před implementací CORE je nutné zachovat datový a produktový model z MASTER CONTEXT:

```text
PŘÍPAD
 ├── zdroj
 ├── označení
 └── SPLÁTKY
      ├── částka
      ├── datum nároku
      ├── datum skutečné platby
      └── stav
```

Základní finanční funkce zůstávají prioritou:

- Teď,
- Příjem,
- Případy,
- Souhrn.

Experimentální vrstvy (Časový stroj, Objevitel, Laboratoř) jsou nadstavbou a nesmějí základ nahradit.

---

## 12. Stav projektu po Checkpointu 03

```text
UX MASTER / prototypy
        ↓
TECHNICKÁ SPECIFIKACE
        ↓
GITHUB
        ↓
Firebase Auth        PASS
        ↓
Firestore             PASS
        ↓
Security Rules        PASS
        ↓
Firestore test        PASS
        ↓
          >>> PORTMONKA CORE <<<
```

**Checkpoint 03 uzavřen: PASS.**
