# PORTMONKA — CLAUDE POZNÁMKY
## Průběžné technické review a supervize (živý dokument)

**Poslední aktualizace:** 15. 9. 2026
**Autor:** Claude (Anthropic), na vyžádání Myrdy
**Účel:** Nezávislé druhé oči nad architekturou a rozhodnutími Portmonky. Nenahrazuje MASTER CONTEXT, 07 MASTER, technickou specifikaci ani audit — doplňuje je o průběžné poznámky z pohledu implementace a o zkušenosti z ostatních Myrdových appek (GOORN, AI kouč – Nekonečná síla, genealogie), které mám k dispozici.

> Tento soubor se v čase přepisuje/doplňuje. Není to sekvence číslovaných checkpointů jako `PORTMONKA_VLAKNO_NN` — je to jedno trvalé místo, kam Claude ukládá review poznatky pro ChatGPT i pro sebe do budoucna.

---

## 1. Status k 15. 9. 2026 — po Auth Spike (Checkpoint 02)

**Verdikt: žádný červený praporek. Architektura je v pořádku, postupuje se správně.**

### Co jsem ověřil/potvrdil
- Firebase projekt + Authentication + Firestore je konzistentní volba — odpovídá tomu, co u Myrdy už funguje na appce AI kouč – Nekonečná síla (GitHub Pages + Firebase Firestore + Cloudflare Worker proxy na Claude API).
- Testovací řetězec Auth Spike (Android tablet → Opera → GitHub Pages → Google → Firebase) je přesně správný přístup — testovat na cílovém zařízení, ne jen na desktopu.
- `signInWithPopup` pro základní Google přihlášení funguje spolehlivě na Android/Opera (ověřeno Test D). Rozhodnutí nepokoušet se opravit `signInWithRedirect` je správné — je to známé omezení prostředí (sessionStorage partitioning), ne chyba v appce.
- Veřejná viditelnost repa `67myrda/Portmonka` je v pořádku pro `apiKey` ve Firebase konfiguraci (ten není tajný — bezpečnost stojí na Security Rules + Authorized domains). **Až přijde fáze s Claude API klíčem, ten musí zůstat mimo tenhle repo, výhradně na serverové straně.**

### Oprava vlastního dřívějšího varování
V minulé konzultaci jsem upozorňoval, že i `signInWithPopup` může na Androidu selhávat — na základě zkušenosti z GOORN Google Drive OAuth (kde se popup otevřel jako plná záložka a rozbil vrácení výsledku). Test D v Auth Spike ukázal, že pro **standardní Firebase Google přihlášení** popup funguje bez problému. Rozdíl: GOORN případ používal Google Identity Services `initTokenClient` pro širší OAuth scope (přístup k Drive API), ne Firebase `signInWithPopup` pro prosté přihlášení. Jsou to technicky odlišné flow.
→ **Poučení pro budoucnost:** pokud Portmonka časem bude potřebovat širší oprávnění (Kalendář, Drive apod.), stejný GOORN zádrhel se může vrátit. Pro čisté přihlášení to riziko není.

---

## 2. Relevantní technické poznatky z ostatních Myrdových appek

Tohle jsou věci, které se v minulosti u jiných appek staly problémem a mohly by se zopakovat i u Portmonky, pokud se na ně nebude myslet dopředu:

| Poznatek | Zdroj | Relevance pro Portmonku |
|---|---|---|
| Firebase Storage od začátku 2026 vyžaduje placený Blaze plán | AI kouč | Pokud appka nebude potřebovat nahrávání souborů (fotky faktur apod.), není to problém. Pokud ano, počítat s tím rovnou, ne narazit na placební bránu později. |
| Email/uživatelský whitelist prosazovaný jen na klientovi, ne v Security Rules → bezpečnostní díra | AI kouč | Přesně proto je další krok (Firestore Security Rules) kritický dřív, než se začnou ukládat reálná data. |
| Cache-busting (`?v=N` na `<script>` tagu) se snadno zapomíná při editaci JS souborů | AI kouč | Až appka poroste za jeden HTML soubor, hlídat verzování scriptů. |
| Krátkodobé GitHub Fine-Grained PAT tokeny, generované a hned po pushi zneplatněné | všechny appky | Zavedená a fungující rutina — žádná změna potřeba. |
| Cloudflare Worker jako proxy na Claude API, bez vlastní autentizace navíc (jen CORS) | AI kouč | Až Portmonka dojde k AI vrstvě, doporučuju rovnou přidat silnější ochranu Workeru, ne kopírovat tenhle otevřený bod. |

---

## 3. Otevřené/potvrzené produktové hodnoty (pro pořádek, ať nezapadnou)
- GOORN provize: **potvrzeno jako platné pevné částky** — 3 190 Kč (1. část) / 2 530 Kč (2. část), ne obecný poměr 50/50 z původního MASTER dokumentu. *(Tohle je novější a přesnější informace než co je v `PORTMONKA_MASTER_CONTEXT.md` — stálo by za to při další revizi MASTER dokumentu tuhle hodnotu tam promítnout, ať dokumenty nejedou proti sobě.)*
- Nový požadavek, který zatím není v žádném MASTER dokumentu: **více jednotlivých zakázek lze později sloučit do jedné faktury, přičemž původní jednotlivé případy musí zůstat zachované** (z podkladu pro auth/Firebase posouzení). Tohle je změna datového modelu (vztah faktura ↔ více případů) — vhodné doplnit do technické specifikace, až se k tomu dojde.

---

## 4. Doporučený další krok (souhlasím s plánem z Checkpointu 02)

**FIRESTORE FOUNDATION** — v tomto pořadí:
1. vytvořit Firestore, strukturu `users/{userId}/cases/{caseId}/installments/{installmentId}`
2. Security Rules — omezit čtení/zápis jen na vlastního uživatele
3. test zápisu/čtení vlastních dat
4. **test, že uživatel A nevidí data uživatele B** (i při jednom uživateli — levné otestovat hned, nikdy se k tomu nemusíte vracet ve strachu)
5. teprve pak Portmonka CORE

---

## 5. Jak tenhle soubor používat
- ChatGPT: klidně cituj nebo shrnuj cokoliv odsud, je to psáno přímo pro tenhle účel.
- Myrda: až přijde další review od Claude, tenhle soubor přepíšu/doplním (ne založím nový číslovaný checkpoint) — takže vždycky stačí zkontrolovat datum aktualizace nahoře.
