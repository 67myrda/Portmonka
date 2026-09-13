# Portmonka

Osobní přehled provizních příjmů podle referenčního návrhu Portmonky.

## Co prototyp umí

- **Teď** – zobrazí splátky, které lze právě fakturovat, a výhled budoucích nároků.
- **Příjem** – počítá skutečné peníze podle data platby, zvlášť po zdrojích i celkem.
- **Případy** – eviduje obchodní případy a jejich jednotlivé splátky.
- **Souhrn** – celoživotní součty celkem / proplaceno / zbývá.
- Automatické přepnutí z „Čeká“ na „Lze fakturovat“ podle data nároku.
- Ruční kroky „Vyfakturováno“ a „Proplaceno“.
- Pravidla pro Pro-Factor, GOORN, Domoveo.cz a Grafiku.
- Lokální ukládání do `localStorage`.

## Struktura

- `index.html` – hlavní HTML aplikace
- `styles.css` – vzhled a responzivní UI
- `app.js` – logika a lokální datový model
- `icon.svg` – ikona
- `README.md` – dokumentace

## Spuštění

Stačí otevřít `index.html` v prohlížeči. Pro GitHub Pages není potřeba build ani server.

## Důležité

Toto je stále prototyp. Data se ukládají pouze do prohlížeče daného zařízení.

Budoucí produkční verze má podle referenčního dokumentu přejít na samostatný Firebase projekt a následně dostat zápis z Prodejního Taháku a `goorn-zak`. Domoveo.cz a Grafika zůstávají ručními vstupy.

Přesný split GOORN není v prototypu považován za systémové pravidlo; je nastavitelný u každého případu.
