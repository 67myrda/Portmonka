# Portmonka

Osobní appka pro sledování příjmů z provizní práce — není to účetnictví ani fakturační systém.

Odpovídá na tři otázky:
1. Co si můžu vyfakturovat právě teď?
2. Co mi ještě přijde a kdy?
3. Kolik mi reálně přišlo za poslední týden/měsíc a od koho?

## Stav

Funkční CORE: přihlášení přes Google, data v Cloud Firestore, oddělená podle uživatele. Případ obsahuje splátky, jejichž stav (Čeká → Lze fakturovat → Vyfakturováno → Proplaceno) se odvozuje deterministicky z dat, ne ukládá ručně.

## Architektura

- **Frontend:** `index.html` — jeden samostatný soubor (Firebase inicializace, Google popup přihlášení, Firestore, čtyři hlavní pohledy, formuláře), hostovaný na GitHub Pages
- **Backend:** Firebase (projekt `portmonka-951967`) — Authentication (Google) + Cloud Firestore (`europe-central2`)
- **Bezpečnost:** `firestore.rules` — každý uživatel má přístup jen ke svým datům pod `users/{uid}/...`
- **Datový model:** `users/{userId}/cases/{caseId}/installments/{installmentId}` + `users/{userId}/events/{eventId}` (auditní log)

Žádný build proces, žádný server kód mimo Firebase — stačí otevřít `index.html` přes GitHub Pages.

## Zdroje příjmů

Pro-Factor, GOORN, Domoveo.cz, Grafika — každý s vlastním pravidlem rozdělení provize do jedné nebo dvou splátek. Detaily viz projektová dokumentace.

## Důležité

- Finanční výpočty jsou deterministické; AI (plánovaná pozdější vrstva) smí pouze interpretovat data, nikdy neurčuje ani nemění finanční částky.
- Primární cílové zařízení: Android tablet, prohlížeč Opera.
- Zakázán rublový symbol (₽) a jeho grafická podoba kdekoliv v UI.

## Dokumentace

Zdrojem pravdy pro produktový a technický kontext jsou dokumenty v tomto repu (`PORTMONKA_*`), zejména `PORTMONKA_PROGRESS_HANDOFF_*` pro aktuální stav a `PORTMONKA_TECHNICKA_SPECIFIKACE_v1.1_CORE.md` pro technický rámec.
