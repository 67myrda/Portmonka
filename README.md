# Portmonka

Osobní appka pro sledování příjmů z provizní práce. Není to účetnictví ani fakturační systém.

Odpovídá na tři otázky:
1. Co si můžu vyfakturovat právě teď?
2. Co mi ještě přijde a kdy?
3. Kolik mi reálně přišlo za poslední týden/měsíc a od koho?

Živě: https://67myrda.github.io/Portmonka/ · ukázka bez přihlášení: https://67myrda.github.io/Portmonka/?demo=1

## Stav (23. 10. 2026) – vzhled „Portmonka 08“, fáze 2

- Tmavý technologický vzhled podle schváleného prototypu 08: Dnešní mise, Skřítek, živá časová osa, odhad 7/30/90 dní, výhled nároků, Příjem se sloupci podle zdrojů, Případy s detailem, Souhrn jako „stav vesmíru“.
- GOORN pevné částky 3 190 + 2 530 Kč, 2. část čeká na podmínku bez data.
- Domoveo 17 / 25 % z ceny bez DPH, nárok až po servisu, stav **Propadlo**, měsíční **bonus** jako samostatná splátka.
- **Úprava případu** (název, datum, poznámka, splátky včetně dat a částek), smazání případu se dvojím potvrzením.
- **Sloučená faktura:** vybrané splátky dostanou společné číslo faktury, platbu pak potvrdíš za celou fakturu najednou.
- Vrácení kroku (omylem vyfakturováno / proplaceno), obnovení propadlé splátky.
- Firestore pravidla kontrolují i obsah zápisu (`firestore.rules`) – nasazují se ručně ve Firebase konzoli.
- Čas, Objevitel a Laboratoř jsou v navigaci jako „připravuju“ (fáze 4–6).

## Architektura

- `index.html` – kostra stránky
- `css/app.css` – vzhled 08
- `js/core.js` – deterministické finanční jádro (stavy, pravidla zdrojů, součty, období, odhad, Skřítek). Žádný DOM, žádný Firestore.
- `js/store.js` – datová vrstva: Firestore (`portmonka-951967`) a paměťový režim `?demo=1`
- `js/app.js` – obrazovky, formuláře, akce
- `test/core.test.mjs` – testy jádra: `node --test test/core.test.mjs`
- Data: `users/{uid}/cases/{caseId}/installments/{id}` + `users/{uid}/events/{id}` (auditní deník, jen přidávat)
- Hosting GitHub Pages z větve `main`, žádný build.

## Pravidla

Viz `PORTMONKA_RULES.md`. Zakázán rublový symbol a jeho grafická podoba kdekoliv v UI.

## Dokumentace

Zdroj pravdy pro produkt a techniku jsou dokumenty v Claude Projektu (`PORTMONKA_MASTER_CONTEXT.md`, `PORTMONKA_07_MASTER.md`, `PORTMONKA_TECHNICKA_SPECIFIKACE.md`, fázový plán `claude/PORTMONKA_PREVZETI_AUDIT_PLAN_2026-10-19.md`). Starší soubory `PORTMONKA_*` v tomto repu jsou historické.
