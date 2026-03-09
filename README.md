README — Il Porto dei Pirati

Questo progetto è un sito e-commerce (momentaneamente) statico sviluppato con HTML, CSS e JavaScript vanilla, (momentaneamente) senza backend o framework.
Il sito presenta e vende prodotti artigianali del laboratorio.

L'intero catalogo prodotti è data-driven tramite un file JSON (products.json), che consente di aggiungere o modificare prodotti senza dover creare nuove pagine HTML manualmente. 

CONTENT-STRUCTURE
Struttura principale:

/
├── index.html
├── stampe-3d.html
├── serigrafie-vestiti.html
├── product.html
├── cart.html
│
├── styles.css
├── script.js
├── catalog.js
├── product-page.js
│
├── products.json
│
├── assets/
│   └── products/
│       ├── photos/
│       └── svg/
│
└── CONTENT-STRUCTURE.md

Pagine del sito
Home

File:
index.html

Contiene:
Hero principale
Sezione eventi
Prodotti in evidenza
Preview delle categorie
La homepage mostra alcune schede prodotto statiche e link alle categorie.

Categorie prodotti
Due pagine di catalogo:

stampe-3d.html
serigrafie-vestiti.html

Ogni pagina contiene:
Hero descrittivo
Catalogo prodotti
Pulsante Aggiungi al carrello

I prodotti sono mostrati tramite card HTML.

Esempio:
<button data-add-to-cart data-id="3d-gyro-v1">
Aggiungi
</button>

Il data-id corrisponde all'id del prodotto definito in products.json.

Pagina prodotto
File:
product.html

Questa pagina è dinamica.

Il prodotto viene caricato tramite parametro URL:

product.html?id=3d-gyro-v1

Lo script:
product-page.js
legge l'id e carica i dati da products.json.

Nel JSON sono presenti tutte le informazioni:
- nome
- prezzo
- immagini
- descrizione
- varianti
- specifiche tecniche

Esempio di struttura prodotto:

{
  "id": "3d-gyro-v1",
  "name": "Giroscopio decorativo — PLA",
  "category": "stampe-3d",
  "price": 19.9,
  "variants": [
    {
      "key": "material",
      "label": "Materiale",
      "options": ["PLA", "PETG"]
    }
  ]
}

Catalogo prodotti
File:

products.json

Questo file contiene tutto il catalogo del sito.

Ogni prodotto definisce:
- id
- nome
- categoria
- prezzo
- immagini
- badge
- varianti
- specifiche tecniche
- SEO
- prodotti correlati

Esempio:

{
  "id": "tee-logo-v1",
  "name": "T-shirt serigrafata — Logo",
  "category": "serigrafie-vestiti",
  "price": 22
}

Per aggiungere un prodotto basta:

1: Inserire un nuovo oggetto nel JSON
2: Aggiungere immagini nella cartella

assets/products/photos

Carrello
Il carrello è gestito completamente lato client tramite JavaScript.

File principale:
script.js

Funzioni principali:
- aggiunta prodotti
- rimozione prodotti
- modifica quantità
- calcolo subtotale
- aggiornamento contatore carrello

Il carrello viene salvato nel LocalStorage del browser, quindi:

- i prodotti rimangono tra una pagina e l'altra
- il carrello è condiviso tra tutte le pagine

Drawer carrello
Il carrello può essere aperto da qualsiasi pagina tramite il pulsante:

🛒 Carrello

Questo apre un drawer laterale con:
- lista prodotti
- quantità
- subtotale
- link alla pagina carrello

Pagina carrello
File:

cart.html

Questa pagina mostra:
- elenco completo prodotti
- modifica quantità
- subtotale ordine
- pulsante checkout

Il layout è composto da:

cart-main
cart-summary

con riepilogo ordine sulla destra. 

Stili
File:

styles.css

Il CSS gestisce:
- layout
- animazioni
- griglie prodotto
- card
- drawer menu
- carrello

Il design usa CSS variables per i colori principali:

:root{
  --brand:#1bcfb1;
  --brand2:#ffb96f;
}

Ogni pagina può avere una palette diversa tramite classi body:

.home-page
.category-page
.product-detail-page
.cart-page

Menu e navigazione
Il menu principale è un drawer laterale condiviso da tutte le pagine.

Contiene link a:
- Home
- Stampe 3D
- Serigrafie & Vestiti
- Carrello

Il menu è controllato via JavaScript.

Aggiungere un nuovo prodotto

1: Aprire

products.json

2: Copiare un prodotto esistente
3: Modificare:

id
name
price
image
variants
specs

4: Caricare le immagini in

assets/products/photos

5: Il prodotto sarà automaticamente disponibile nella pagina:

product.html?id=NUOVO_ID
Roadmap futura

Possibili evoluzioni:

- Catalogo completamente dinamico

Attualmente alcune pagine categoria hanno card statiche.

Si potrebbe:

generare tutto da products.json
filtrare per categoria via JS.

- Separazione contenuti

In futuro i contenuti possono essere separati in file JSON dedicati:

prodotti
eventi
homepage

Struttura suggerita:

products.json
home-content.json
events.json

- Checkout esterno (DA VEDERE)

Il checkout deve essere collegato a:

Stripe o PayPal
