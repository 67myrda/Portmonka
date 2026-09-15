# PORTMONKA — CHECKPOINT 02
## Auth Spike & Firebase Authentication

**Datum:** 15. 9. 2026  
**Projekt:** Portmonka  
**Stav:** Ověřený milník  
**Navazuje na:** PORTMONKA_MASTER_CONTEXT.md, PORTMONKA_07_MASTER.md, PORTMONKA_TECHNICKA_SPECIFIKACE.md

## 1. Účel
Tento checkpoint uzavírá etapu ověření autentizace Portmonky v reálném cílovém prostředí. Nenahrazuje MASTER CONTEXT ani technickou specifikaci.

Ověřovaný řetězec:
**Android tablet → Opera → GitHub Pages → Google → Firebase Authentication**

## 2. Výchozí stav
Byl vytvořen Firebase projekt **Portmonka** na plánu Spark / No-cost.

Byla zaregistrována webová aplikace **Portmonka Web** v projektu `portmonka-951967`.

Google provider ve Firebase Authentication byl povolen.

Frontend testu **Auth Spike** byl umístěn do veřejného repozitáře `67myrda/Portmonka` jako `auth-spike.html`.

Veřejná viditelnost repozitáře je záměrné rozhodnutí projektu.

## 3. Auth Spike
Auth Spike je izolovaná testovací stránka, nikoli produkční aplikace.

Testuje:
1. inicializaci Firebase,
2. Google Authentication přes popup,
3. Google Authentication přes redirect,
4. návrat z redirectu,
5. sledování stavu uživatele,
6. odhlášení.

Použitý Firebase Web SDK: **12.19.0**.

## 4. Průběh testu

### Test A — načtení aplikace
**PASS.** Auth Spike se na Android tabletu v Opeře načetl přes GitHub Pages a Firebase Auth se inicializovala.

### Test B — API key
**FAIL → OPRAVENO.** Původně Firebase vracela `auth/api-key-not-valid`. Bylo zjištěno, že `apiKey` v Auth Spike neodpovídal aktuální konfiguraci Portmonka Web. Hodnota byla opravena podle Firebase.

### Test C — autorizace domény
Po opravě API key se objevila `auth/unauthorized-domain`. Příčinou bylo, že `67myrda.github.io` nebyla mezi autorizovanými doménami Firebase Authentication. Doména byla přidána do Authorized domains.

### Test D — Google popup
**PASS.** Na Android tabletu v Opeře proběhl celý řetězec Android → Opera → GitHub Pages → Google → Firebase. Firebase vrátila přihlášeného uživatele včetně e-mailu a UID.

Výsledek obrazovky: **POPUP PŘIHLÁŠENÍ OK**.

### Test E — odhlášení
**PASS.** Odhlášení přes Firebase Authentication fungovalo a Auth zůstala funkční.

### Test F — Google redirect
**FAIL / NEPOUŽÍVAT JAKO HLAVNÍ VARIANTU.**

`signInWithRedirect` skončil chybou:
`Unable to process request due to missing initial state.`

Chybová stránka uváděla možnost problému se `sessionStorage` v prostředí se storage partitioningem.

**Rozhodnutí:** Pro Portmonku použít jako hlavní webovou autentizaci Google přihlášení přes **popup**. Redirect nyní neřešit násilně.

## 5. Výsledek milníku

### AUTH SPIKE — PROŠEL

Je reálně ověřeno:
**Android tablet + Opera → GitHub Pages → Google účet → Firebase Authentication → přihlášený uživatel**

Základní autentizační mechanismus je na cílovém zařízení funkční.

## 6. Technický závěr
Základní architektura se kvůli autentizaci nemění.

Dosavadní směr zůstává:
**GitHub Pages frontend + Firebase Authentication + Firestore + později bezpečný backend/proxy pro AI API podle technické specifikace.**

Portmonka je nyní single-user aplikace. Datový model má být od začátku strukturován pod `userId`, aby pozdější rozšíření na více uživatelů nevyžadovalo zásadní přestavbu.

## 7. Stav komponent

| Komponenta | Stav |
|---|---|
| Firebase projekt Portmonka | HOTOVO |
| Firebase Web App Portmonka Web | HOTOVO |
| Google provider | HOTOVO |
| Authorized domain `67myrda.github.io` | HOTOVO |
| GitHub repo `67myrda/Portmonka` | HOTOVO |
| GitHub Pages | FUNKČNÍ |
| Auth Spike | HOTOVO |
| Google popup login | OVĚŘENO — PASS |
| Firebase Auth state | OVĚŘENO — PASS |
| Sign out | OVĚŘENO — PASS |
| Google redirect | SELHÁNÍ — známé omezení prostředí |
| Firestore | ZATÍM NE |
| Firestore Security Rules | ZATÍM NE |
| Produkční CORE | ZATÍM NE |
| Pro-Factor integrace | ZATÍM NE |
| GOORN integrace | ZATÍM NE |
| Time Machine | ZATÍM NE |
| Objevitel / Skřítek | ZATÍM NE |
| Laboratoř | ZATÍM NE |
| Claude / AI vrstva | ZATÍM NE |

## 8. Bezpečnostní význam
Auth Spike není produkční aplikace.

Úspěšné přihlášení neznamená, že je hotová bezpečnost celé Portmonky.

Před ukládáním produkčních dat je nutné vytvořit Firestore a nastavit Security Rules tak, aby uživatel mohl pracovat pouze se svými daty. Client-side omezení není bezpečnostní mechanismus.

## 9. Produktové zásady, které zůstávají v platnosti
Portmonka není účetnictví.

Finanční výpočty musí být deterministické; AI pouze interpretuje data a vytváří hypotézy.

Scénáře nesmí měnit skutečná data.

Zakázaný rublový symbol nesmí být použit v UI, ikonách ani grafice Portmonky.

## 10. Další krok
### FIREBASE / FIRESTORE FOUNDATION

Doporučené pořadí:
1. vytvořit Firestore,
2. nastavit Security Rules,
3. otestovat zápis a čtení vlastních dat,
4. otestovat ochranu proti přístupu k cizím datům,
5. teprve potom pokračovat k Portmonka CORE.

## 11. Pracovní pravidlo pro další vlákno
> Auth Spike je dokončen a ověřen na Android tabletu v Opeře. Google přihlášení přes popup funguje. Redirect byl otestován a v tomto prostředí selhává kvůli problému s inicializačním stavem/sessionStorage; není hlavní varianta. Firebase projekt Portmonka a webová aplikace Portmonka Web jsou vytvořeny. Další krok je Firestore Foundation + Security Rules. Postupovat stylem JEDEN KROK → TEST → VYHODNOCENÍ → DALŠÍ KROK.

## 12. Historie
**15. 9. 2026 — Checkpoint 02 vytvořen.**

Významná změna stavu: **Firebase Authentication je poprvé reálně ověřena na cílovém zařízení.**
