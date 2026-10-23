# PORTMONKA – pevná pravidla projektu

Stručný výtah závazných pravidel (MASTER CONTEXT §16). Podrobnosti a historie rozhodnutí jsou v projektových dokumentech `PORTMONKA_MASTER_CONTEXT.md`, `PORTMONKA_07_MASTER.md` a `PORTMONKA_TECHNICKA_SPECIFIKACE.md` (Claude Projekt). Při rozporu platí ty dokumenty a rozpor se hlásí, nehádá se.

**Stav k 23. 10. 2026.**

## Produkt
1. Portmonka není účetnictví ani fakturační systém.
2. Matematika = aplikace, interpretace = AI. Finanční částky počítá jen deterministický kód (`js/core.js`), AI je nikdy neurčuje.
3. Finanční základ (Teď / Příjem / Případy / Souhrn) má vždy přednost před experimentální vrstvou (Čas, Objevitel, Laboratoř).
4. Objev je stopa, hypotéza nebo otázka, ne fakt. Každý objev ukazuje, z čeho vznikl.
5. Predikce se vždy označuje „ODHAD · NE GARANCE“ a nikdy se nemíchá se skutečným cash flow.
6. Nikde v UI ani v ikonách se nesmí objevit rublový symbol ani jeho grafická podoba.

## Finanční pravidla
- Stavy splátky: Čeká → Lze fakturovat → Vyfakturováno → Proplaceno, vedlejší stav Propadlo. Stav se odvozuje z dat, neukládá se.
- Příjem se počítá jen podle skutečného data platby (`paidAt`). Fakturace příjem nemění.
- Propadlá splátka se nepočítá do „čeká“, „lze fakturovat“ ani „zbývá“, v historii zůstává.
- Součet splátek = částka případu. Nesoulad se ukáže, nikdy se tiše neopravuje.
- **Pro-Factor:** 75 % při uzavření města, 25 % po 4 měsících.
- **GOORN:** pevné částky 3 190 Kč (po instalaci) + 2 530 Kč (po splnění podmínky; datum se nepočítá dopředu). Jiná částka = výjimka, kterou ohlásí Myrda.
- **Domoveo:** 17 % (firemní zakázka) / 25 % (vlastní klient) z ceny bez DPH. Nárok až po provedeném servisu; když klient technika nepustí, provize propadá. Bonus = samostatná splátka typu `bonus`, eviduje se až po potvrzení Domoveem.
- **Grafika:** ruční jednorázové zakázky.
- Více splátek lze spojit do jedné faktury (společné `invoiceId` + číslo faktury). Splátky zůstávají samostatné. Číslo faktury zadává vždy Myrda.
- Faktury se platí **do 3 dnů** od vystavení (Myrda 23. 10. 2026). Odhad počítá s tímto pravidlem, déle nezaplacená faktura je „po termínu“.
- GOORN: po vystavení faktury se zakázky v `goorn-zak` přepínají na „1. část zaplacena“ hned (ne až po platbě).

## Zdrojové aplikace (backend `portmonka-backend`)
- **Domoveo = VÝHRADNĚ čtení.** Nikdy zápisové nástroje konektoru (akce_*, davka_*, navrh_zrusit, formuláře).
- **GOORN a Prodejní Tahák:** zápis jen přes návrh → výslovné potvrzení, jen vyjmenovaná pole, nikdy mazání dokumentů, kontrola souběžné změny.
- Při zápisu do GOORN se změní i stav, kde to logicky plyne (zapsaný termín → Domluvený termín).
- Nový řádek poznámky vždy nahoru, formát `[dd.mm.rrrr Claude] text`. Claude smí opravit či smazat jen své řádky.
- Kalendář GOORN smí Claude upravit bez dotazu, když navazuje na potvrzenou změnu termínu.

## Postup práce
- Jeden krok → test → vyhodnocení → další krok.
- Větev → commit → test → sloučení do `main` (Claude slučuje sám po otestování a oznámí to). `main` = okamžité nasazení naostro.
- API klíče a tokeny nikdy do chatu ani do repa.
- Potvrzení od Myrdy jen u nevratných akcí, peněz, mazání dat a zpráv třetím osobám.
