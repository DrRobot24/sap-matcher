# 🔍 SAP Code Matcher

Sistema intelligente per l'abbinamento automatico di codici SAP con descrizioni. Supporta upload multiplo di PDF/Excel e ricerca interattiva in tempo reale.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)

## ✨ Funzionalità Principali

### 📁 Upload Multiplo
- **Carica multipli PDF e/o Excel** con codici SAP e descrizioni
- Estrazione automatica da tutti i file contemporaneamente
- Tracking della sorgente per ogni codice estratto

### 🔍 Ricerca Interattiva
- **Incolla una descrizione** e ottieni il codice corrispondente istantaneamente
- Risultati in tempo reale mentre digiti
- Perfetto per trovare codici uno per uno durante il lavoro

### 🧠 Matching Intelligente
- Algoritmo di similarità pesata con key terms
- Soglia di matching configurabile (default 30%)
- Supporto per variazioni e sinonimi nei testi

### 📊 Supporto Multi-Formato
- **Input Codici**: PDF, Excel (.xlsx, .xls)
- **Input Descrizioni**: TXT, Excel (.xlsx, .xls)
- Export risultati in CSV con encoding UTF-8

## 🚀 Quick Start

### Prerequisiti
```bash
Node.js >= 18.0.0
npm >= 9.0.0
```

### Installazione

```bash
# Clona il repository
git clone https://github.com/DrRobot24/sap-matcher.git
cd sap-matcher

# Installa le dipendenze
npm install

# Avvia il server di sviluppo
npm run dev
```

Il server sarà disponibile su: **http://localhost:5173**

## 📖 Come Usare

### Modalità 1: Abbinamento Batch

1. **Carica file codici** (Box Blu - Sinistra)
   - Seleziona uno o più PDF/Excel con codici e descrizioni
   - Supporta upload multiplo (Ctrl+Click per selezionare più file)

2. **Carica file descrizioni** (Box Verde - Destra)
   - Seleziona TXT o Excel con le descrizioni da abbinare

3. **Avvia Abbinamento**
   - Clicca sul pulsante "Avvia Abbinamento Codici"
   - Attendi l'elaborazione (log in tempo reale)

4. **Esporta Risultati**
   - Scarica il CSV con tutti gli abbinamenti trovati

### Modalità 2: Ricerca Interattiva

1. **Carica file codici** (Box Blu)
   - Carica i tuoi PDF/Excel con i codici SAP

2. **Usa il box di ricerca** (Box Viola)
   - Incolla una descrizione nella textarea
   - Vedi immediatamente il codice corrispondente
   - Ripeti per ogni descrizione che vuoi cercare

## 🎯 Esempio Pratico

### Formato File Codici (PDF/Excel)
```
P120026300 | Direttore tecnico di cantiere edile
P120026301 | Ingegnere responsabile strutture
P120026302 | Coordinatore sicurezza cantiere
...
```

### Formato File Descrizioni (TXT/Excel)
```
Direttore tecnico cantiere
Ingegnere strutture
Responsabile sicurezza
...
```

### Risultato
```
Descrizione: "Direttore tecnico cantiere"
→ Codice: P120026300
→ Similarità: 85%
→ File: codici_2024.pdf
```

## 🛠️ Tecnologie Utilizzate

- **React 19** - UI Framework
- **TypeScript** - Type Safety
- **Vite** - Build Tool & Dev Server
- **Tailwind CSS 3** - Styling
- **pdfjs-dist** - Estrazione testo da PDF
- **xlsx** - Parsing file Excel
- **Express** - Server SSR
- **Lucide React** - Icone moderne

## 📦 Struttura Progetto

```
sap-matcher/
├── src/
│   ├── App.tsx           # Componente principale
│   ├── main.tsx          # Entry point client
│   ├── entry-client.ts   # Hydration client
│   ├── entry-server.ts   # Rendering server
│   └── index.css         # Stili globali
├── public/               # Asset statici
├── server.js             # Server Express SSR
├── package.json          # Dipendenze
├── vite.config.ts        # Configurazione Vite
├── tailwind.config.js    # Configurazione Tailwind
└── tsconfig.json         # Configurazione TypeScript
```

## ⚙️ Configurazione

### Soglia di Similarità
Modifica in `src/App.tsx` (riga ~522):
```typescript
const threshold = 0.3; // 30% minimo per match
```

### Pattern Codici
Modifica i pattern regex in `src/App.tsx` (riga ~129):
```typescript
const codePatterns = [
  /\b([P][0-9]{9,})\b/g,              // P + 9+ digits
  /\b(BONI\.[A-Z0-9]+\.[A-Z0-9]+)\b/g, // BONI.C1.X
  /\b([A-Z]{2,}[0-9]{6,})\b/g         // Generic codes
];
```

## 🐛 Troubleshooting

### PDF non estrae codici
- Verifica che il PDF sia text-based (non scansione)
- Controlla i pattern regex nella configurazione
- Guarda i log del browser (F12) per dettagli

### Excel non viene letto
- Assicurati che il file sia .xlsx o .xls
- Verifica che ci siano colonne con intestazioni "codice" o "descrizione"
- Controlla che i dati partano dalla prima riga/seconda riga

### Errori di memoria con file grandi
- Carica un file alla volta
- Riduci il numero di pagine del PDF
- Usa Excel invece di PDF per file molto grandi

## 📝 Scripts NPM

```bash
npm run dev      # Avvia server sviluppo
npm run build    # Build produzione
npm run preview  # Preview build produzione
```

## 🤝 Contribuire

1. Fork il progetto
2. Crea un branch per la feature (`git checkout -b feature/AmazingFeature`)
3. Commit le modifiche (`git commit -m 'Add some AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri una Pull Request

## 📄 Licenza

Distribuito sotto licenza MIT. Vedi `LICENSE` per maggiori informazioni.

## 👤 Autore

**DrRobot24**

- GitHub: [@DrRobot24](https://github.com/DrRobot24)
- Repository: [sap-matcher](https://github.com/DrRobot24/sap-matcher)

## 🙏 Ringraziamenti

- [pdfjs-dist](https://github.com/mozilla/pdf.js) per l'estrazione PDF
- [SheetJS](https://sheetjs.com/) per il parsing Excel
- [Tailwind CSS](https://tailwindcss.com/) per lo styling
- [Lucide](https://lucide.dev/) per le icone

---

**Sviluppato con ❤️ per semplificare il matching dei codici SAP**