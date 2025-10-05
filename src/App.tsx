import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';

interface LogEntry {
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  time: string;
}

interface CodeEntry {
  code: string;
  description: string;
  source?: string;
}

interface MatchResult {
  originalDescription: string;
  matchedCode: string;
  matchedDescription: string;
  similarity: number;
  matched: boolean;
  source?: string;
}

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export default function PDFCodeMatcher() {
  // STATI - Supporto multipli PDF
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [listFile, setListFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<MatchResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [extractedCodes, setExtractedCodes] = useState<CodeEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    setLog(prev => [...prev, { message, type, time: new Date().toLocaleTimeString() }]);
  };

  // HANDLER - Upload multipli PDF/Excel
  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setPdfFiles(files);
      setExtractedCodes([]);
      setResults(null);
      setError(null);
      addLog(`✅ Caricati ${files.length} file: ${files.map(f => f.name).join(', ')}`, 'success');
    }
  };

  const handleListUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setListFile(file);
      setResults(null);
      setError(null);
      const fileType = file.name.toLowerCase().endsWith('.txt') ? 'TXT' :
                       file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls') ? 'Excel' :
                       'file';
      addLog(`✅ Caricato ${fileType} con descrizioni: ${file.name}`, 'success');
    }
  };

  // ESTRAZIONE PDF con pdfjs-dist
  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      
      let lastY = -1;
      let lineText = '';
      
      for (const item of textContent.items) {
        if ('str' in item) {
          const currentY = item.transform[5];
          
          if (lastY !== -1 && Math.abs(currentY - lastY) > 2) {
            fullText += lineText + '\n';
            lineText = '';
          }
          
          lineText += item.str + ' ';
          lastY = currentY;
        }
      }
      
      if (lineText.trim()) {
        fullText += lineText + '\n';
      }
    }
    
    return fullText;
  };

  // ESTRAZIONE CODICI da PDF
  const extractCodesFromPDF = (text: string, fileName: string): CodeEntry[] => {
    const lines = text.split('\n');
    const codes: CodeEntry[] = [];
    
    const codePatterns = [
      /\b([P][0-9]{9,})\b/g,
      /\b(BONI\.[A-Z0-9]+\.[A-Z0-9]+)\b/g,
      /\b([A-Z]{2,}[0-9]{6,})\b/g
    ];
    
    let currentCode = '';
    let currentDesc = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      let foundCode = false;
      for (const pattern of codePatterns) {
        const matches = line.match(pattern);
        if (matches && matches.length > 0) {
          if (currentCode && currentDesc) {
            codes.push({
              code: currentCode,
              description: currentDesc.trim(),
              source: fileName
            });
          }
          
          currentCode = matches[0];
          currentDesc = line.replace(currentCode, '').trim();
          foundCode = true;
          break;
        }
      }
      
      if (!foundCode && currentCode) {
        currentDesc += ' ' + line;
      }
    }
    
    if (currentCode && currentDesc) {
      codes.push({
        code: currentCode,
        description: currentDesc.trim(),
        source: fileName
      });
    }
    
    if (codes.length === 0) {
      console.log('⚠️ No codes found. First 10 lines:', lines.slice(0, 10));
    }
    
    return codes;
  };

  // ESTRAZIONE CODICI da Excel
  const extractCodesFromExcel = async (file: File): Promise<CodeEntry[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    const codes: CodeEntry[] = [];
    let codeCol = -1;
    let descCol = -1;
    
    const headers = data[0] || [];
    headers.forEach((header, idx) => {
      const h = String(header).toLowerCase();
      if (h.includes('codice') || h.includes('code')) codeCol = idx;
      if (h.includes('descri') || h.includes('testo')) descCol = idx;
    });
    
    if (codeCol === -1 || descCol === -1) {
      for (let col = 0; col < (headers.length || 0); col++) {
        for (let row = 1; row < Math.min(10, data.length); row++) {
          const cell = data[row]?.[col];
          if (cell && /^[A-Z]{1,}[0-9]{6,}/.test(String(cell))) {
            codeCol = col;
            break;
          }
        }
      }
      
      let maxLength = 0;
      for (let col = 0; col < (headers.length || 0); col++) {
        if (col === codeCol) continue;
        let totalLength = 0;
        for (let row = 1; row < Math.min(10, data.length); row++) {
          totalLength += String(data[row]?.[col] || '').length;
        }
        if (totalLength > maxLength) {
          maxLength = totalLength;
          descCol = col;
        }
      }
    }
    
    const startRow = (headers.some(h => String(h).toLowerCase().includes('codice') || String(h).toLowerCase().includes('code'))) ? 1 : 0;
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      const code = codeCol >= 0 ? String(row[codeCol] || '').trim() : '';
      const description = descCol >= 0 ? String(row[descCol] || '').trim() : '';
      
      if (code && description) {
        codes.push({ code, description, source: file.name });
      }
    }
    
    return codes;
  };

  // ESTRAZIONE DESCRIZIONI da TXT
  const extractDescriptionsFromText = async (file: File): Promise<string[]> => {
    const text = await file.text();
    const lines = text.split('\n');
    const descriptions: string[] = [];
    
    let currentDescription = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('CODICE')) {
        if (currentDescription) {
          descriptions.push(currentDescription.trim());
        }
        currentDescription = trimmed.replace(/^CODICE\s*[A-Z0-9]+\s*/i, '');
      } else if (trimmed) {
        currentDescription += ' ' + trimmed;
      }
    }
    
    if (currentDescription) {
      descriptions.push(currentDescription.trim());
    }
    
    return descriptions.filter(d => d.length > 0);
  };

  // ESTRAZIONE DESCRIZIONI da Excel
  const extractDescriptionsFromExcel = async (file: File): Promise<string[]> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const data: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
    
    const descriptions: string[] = [];
    let descCol = -1;
    
    const headers = data[0] || [];
    headers.forEach((header, idx) => {
      const h = String(header).toLowerCase();
      if (h.includes('descri') || h.includes('testo')) {
        descCol = idx;
      }
    });
    
    if (descCol === -1) {
      let maxLength = 0;
      for (let col = 0; col < (headers.length || 0); col++) {
        let totalLength = 0;
        for (let row = 1; row < Math.min(10, data.length); row++) {
          totalLength += String(data[row]?.[col] || '').length;
        }
        if (totalLength > maxLength) {
          maxLength = totalLength;
          descCol = col;
        }
      }
    }
    
    const startRow = (headers.some(h => String(h).toLowerCase().includes('descri') || String(h).toLowerCase().includes('testo'))) ? 1 : 0;
    
    for (let i = startRow; i < data.length; i++) {
      const row = data[i];
      const description = descCol >= 0 ? String(row[descCol] || '').trim() : '';
      
      if (description) {
        descriptions.push(description);
      }
    }
    
    return descriptions;
  };

  // CALCOLO SIMILARITÀ
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    if (s1 === s2) return 1.0;
    if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    
    const words1 = s1.split(/\s+/);
    const words2 = s2.split(/\s+/);
    
    const keyTerms = ['direttore', 'tecnico', 'responsabile', 'capo', 'ingegnere', 'architetto', 'coordinatore'];
    
    let matchScore = 0;
    let totalWeight = 0;
    
    for (const word1 of words1) {
      const isKeyTerm = keyTerms.some(term => word1.includes(term));
      const weight = isKeyTerm ? 2.0 : 1.0;
      totalWeight += weight;
      
      for (const word2 of words2) {
        if (word1 === word2) {
          matchScore += weight;
          break;
        } else if (word1.includes(word2) || word2.includes(word1)) {
          if (word1.length > 3 && word2.length > 3) {
            matchScore += weight * 0.7;
            break;
          }
        }
      }
    }
    
    let similarity = totalWeight > 0 ? matchScore / totalWeight : 0;
    const lengthRatio = Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
    similarity = similarity * 0.9 + lengthRatio * 0.1;
    
    return similarity;
  };

  // PROCESSO PRINCIPALE - Con supporto multipli file
  const processFiles = async () => {
    if (pdfFiles.length === 0 || !listFile) {
      setError('⚠️ Carica almeno un file codici e un file descrizioni!');
      return;
    }

    setProcessing(true);
    setError(null);
    setLog([]);
    setResults(null);
    
    addLog('🚀 INIZIO PROCESSO DI ESTRAZIONE E MATCHING', 'info');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');

    try {
      let codesFromFile: CodeEntry[] = [];
      
      addLog(`📂 STEP 1: Elaborazione di ${pdfFiles.length} file...`, 'info');
      
      // CICLO SU TUTTI I FILE CARICATI
      for (let i = 0; i < pdfFiles.length; i++) {
        const file = pdfFiles[i];
        const fileName = file.name.toLowerCase();
        addLog(`📄 File ${i + 1}/${pdfFiles.length}: ${file.name}`, 'info');
        
        if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
          const codes = await extractCodesFromExcel(file);
          addLog(`  ✅ Estratti ${codes.length} codici da Excel`, 'success');
          codesFromFile.push(...codes);
        } else if (fileName.endsWith('.pdf')) {
          const pdfText = await extractTextFromPDF(file);
          const codes = extractCodesFromPDF(pdfText, file.name);
          addLog(`  ✅ Estratti ${codes.length} codici da PDF`, 'success');
          codesFromFile.push(...codes);
        } else {
          addLog(`  ⚠️ Formato non supportato: ${file.name}`, 'warning');
        }
      }
      
      if (codesFromFile.length === 0) {
        throw new Error('Nessun codice trovato nei file! Verifica il formato dei file.');
      }
      
      addLog(`✅ Totale codici estratti: ${codesFromFile.length}`, 'success');
      setExtractedCodes(codesFromFile);

      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      addLog('📖 STEP 2: Estrazione descrizioni dal file lista...', 'info');
      
      let descriptions: string[] = [];
      const listFileName = listFile.name.toLowerCase();
      
      if (listFileName.endsWith('.xlsx') || listFileName.endsWith('.xls')) {
        addLog('📊 File Excel rilevato per le descrizioni', 'info');
        descriptions = await extractDescriptionsFromExcel(listFile);
      } else if (listFileName.endsWith('.txt')) {
        addLog('📄 File TXT rilevato per le descrizioni', 'info');
        descriptions = await extractDescriptionsFromText(listFile);
      } else {
        throw new Error('Formato file descrizioni non supportato. Usa TXT o Excel (.xlsx, .xls)');
      }
      
      if (descriptions.length === 0) {
        throw new Error('Nessuna descrizione trovata nel file lista!');
      }
      
      addLog(`✅ Trovate ${descriptions.length} descrizioni da abbinare`, 'success');

      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      addLog('🔍 STEP 3: Calcolo abbinamenti...', 'info');

      const mappedResults: MatchResult[] = descriptions.map((description) => {
        let bestMatch: CodeEntry | null = null;
        let bestScore = 0;

        for (const codeEntry of codesFromFile) {
          const similarity = calculateSimilarity(description, codeEntry.description);
          if (similarity > bestScore) {
            bestScore = similarity;
            bestMatch = codeEntry;
          }
        }

        const threshold = 0.3;

        if (bestMatch && bestScore >= threshold) {
          return {
            originalDescription: description,
            matchedCode: bestMatch.code,
            matchedDescription: bestMatch.description,
            similarity: bestScore,
            matched: true,
            source: bestMatch.source
          };
        } else {
          return {
            originalDescription: description,
            matchedCode: '-',
            matchedDescription: 'Nessuna corrispondenza trovata',
            similarity: 0,
            matched: false
          };
        }
      });

      setResults(mappedResults);
      
      const matchedCount = mappedResults.filter(r => r.matched).length;
      const unmatchedCount = mappedResults.length - matchedCount;
      
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'info');
      addLog('✅ PROCESSO COMPLETATO!', 'success');
      addLog(`📊 Risultati:`, 'info');
      addLog(`   • Abbinamenti trovati: ${matchedCount}/${mappedResults.length}`, 'success');
      addLog(`   • Non abbinati: ${unmatchedCount}`, unmatchedCount > 0 ? 'warning' : 'info');
      
      mappedResults.forEach((r, index) => {
        const score = r.matched ? Math.round(r.similarity * 100) : 0;
        if (r.matched) {
          addLog(`   ${index + 1}. "${r.originalDescription.substring(0, 40)}..." → ${r.matchedCode} (${score}%)`, 'success');
        } else {
          addLog(`   ${index + 1}. "${r.originalDescription.substring(0, 40)}..." → ❌ Non trovato`, 'error');
        }
      });
      
    } catch (err: any) {
      const errorMsg = err.message || 'Errore sconosciuto';
      setError(errorMsg);
      addLog(`❌ ERRORE: ${errorMsg}`, 'error');
      console.error('Errore:', err);
    } finally {
      setProcessing(false);
    }
  };

  // EXPORT CSV
  const exportToCSV = () => {
    if (!results) return;

    const headers = ['Descrizione Originale', 'Codice Abbinato', 'Descrizione Codice', 'Similarità %', 'Abbinato', 'File Sorgente'];
    const rows = results.map(r => [
      r.originalDescription,
      r.matchedCode,
      r.matchedDescription,
      Math.round(r.similarity * 100),
      r.matched ? 'Sì' : 'No',
      r.source || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `abbinamenti_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // RICERCA INTERATTIVA
  const handleInteractiveSearch = (query: string) => {
    if (!extractedCodes || extractedCodes.length === 0) {
      return null;
    }

    let bestMatch: CodeEntry | null = null;
    let bestScore = 0;

    for (const codeEntry of extractedCodes) {
      const similarity = calculateSimilarity(query, codeEntry.description);
      if (similarity > bestScore) {
        bestScore = similarity;
        bestMatch = codeEntry;
      }
    }

    const threshold = 0.3;
    if (bestMatch && bestScore >= threshold) {
      return {
        code: bestMatch.code,
        description: bestMatch.description,
        similarity: bestScore,
        source: bestMatch.source
      };
    }

    return null;
  };

  // RENDER UI
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* HEADER */}
        <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">
              PDF Code Matcher - Abbinamento Codici SAP
            </h1>
          </div>

          {/* UPLOAD BOXES */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Box 1 - PDF/Excel con codici - MULTIPLI FILE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📁 File con codici (PDF o Excel) - Multipli
              </label>
              <label htmlFor="pdf-upload" className="block">
                <div
                  className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                  style={{
                    borderColor: '#2563eb',
                    backgroundColor: pdfFiles.length > 0 ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                  }}
                >
                  <Upload className="w-8 h-8 mb-2" style={{ color: '#2563eb' }} />
                  <p className="text-sm font-medium" style={{ color: '#2563eb' }}>
                    {pdfFiles.length > 0
                      ? `✅ ${pdfFiles.length} file caricati`
                      : 'Carica PDF o Excel con codici e descrizioni'}
                  </p>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    Clicca per caricare PDF/Excel (multipli)
                  </p>
                </div>
              </label>
              <input
                type="file"
                onChange={handlePdfUpload}
                accept=".pdf,.xlsx,.xls"
                multiple
                className="hidden"
                id="pdf-upload"
              />
              {pdfFiles.length > 0 && (
                <div className="mt-2 text-xs text-gray-600">
                  {pdfFiles.map((f, i) => (
                    <div key={i}>
                      {f.name.toLowerCase().endsWith('.pdf') ? '📄 PDF' :
                       f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls') ? '📊 Excel' :
                       '📎'} {f.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Box 2 - TXT/Excel con descrizioni */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                📋 File con descrizioni (TXT o Excel)
              </label>
              <label htmlFor="list-upload" className="block">
                <div
                  className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-green-50 transition-colors"
                  style={{
                    borderColor: '#10b981',
                    backgroundColor: listFile ? 'rgba(16, 185, 129, 0.05)' : 'transparent',
                  }}
                >
                  <Upload className="w-8 h-8 mb-2" style={{ color: '#10b981' }} />
                  <p className="text-sm font-medium" style={{ color: '#10b981' }}>
                    {listFile
                      ? `✅ ${listFile.name}`
                      : 'Carica TXT o Excel con le descrizioni'}
                  </p>
                  <p className="text-xs" style={{ color: '#64748b' }}>
                    Clicca per caricare TXT/Excel
                  </p>
                </div>
              </label>
              <input
                type="file"
                onChange={handleListUpload}
                accept=".txt,.xlsx,.xls"
                className="hidden"
                id="list-upload"
              />
              {listFile && (
                <div className="mt-2 text-xs text-gray-600">
                  {listFile.name.toLowerCase().endsWith('.txt') ? '📄 TXT' :
                   listFile.name.toLowerCase().endsWith('.xlsx') || listFile.name.toLowerCase().endsWith('.xls') ? '📊 Excel' :
                   '📎'} {listFile.name}
                </div>
              )}
            </div>
          </div>

          {/* BOTTONE AVVIA */}
          <button
            onClick={processFiles}
            disabled={processing || pdfFiles.length === 0 || !listFile}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Elaborazione in corso...
              </>
            ) : (
              <>
                <Search className="w-5 h-5" />
                Avvia Abbinamento Codici
              </>
            )}
          </button>

          {/* ERRORI */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* MODALITÀ INTERATTIVA - Incolla descrizione e trova codice */}
        {extractedCodes.length > 0 && !processing && (
          <div className="bg-white rounded-lg shadow-xl p-8 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Search className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold text-gray-800">
                🔍 Ricerca Interattiva
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Incolla una descrizione e ti dirò quale codice corrisponde (man mano che le incolli)
            </p>
            
            <div className="flex gap-2 mb-4">
              <textarea
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Incolla qui la descrizione da cercare..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
              />
              <button
                onClick={() => {
                  const result = handleInteractiveSearch(searchQuery);
                  if (result) {
                    alert(`✅ Codice trovato: ${result.code}\n\nDescrizione: ${result.description}\n\nSimilarità: ${Math.round(result.similarity * 100)}%\n\nFile: ${result.source || 'N/A'}`);
                  } else {
                    alert('❌ Nessun codice trovato per questa descrizione');
                  }
                }}
                disabled={!searchQuery.trim()}
                className="px-6 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                Cerca
              </button>
            </div>
            
            {searchQuery && (() => {
              const result = handleInteractiveSearch(searchQuery);
              return result ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-green-800 text-lg">✅ Codice: {result.code}</p>
                      <p className="text-sm text-gray-700 mt-1">{result.description}</p>
                      <p className="text-xs text-gray-500 mt-2">
                        Similarità: {Math.round(result.similarity * 100)}% | File: {result.source || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <p className="text-yellow-800 text-sm">
                      Nessun codice trovato con similarità sufficiente (min. 30%)
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* LOG */}
        {log.length > 0 && (
          <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Log Operazioni
            </h2>
            <div className="bg-slate-900 rounded-lg p-4 max-h-96 overflow-y-auto font-mono text-sm">
              {log.map((entry, index) => (
                <div
                  key={index}
                  className={`mb-1 ${
                    entry.type === 'success' ? 'text-green-400' :
                    entry.type === 'error' ? 'text-red-400' :
                    entry.type === 'warning' ? 'text-yellow-400' :
                    'text-gray-300'
                  }`}
                >
                  <span className="text-gray-500">[{entry.time}]</span> {entry.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RISULTATI */}
        {results && (
          <div className="bg-white rounded-lg shadow-xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Risultati Abbinamento ({results.length})
              </h2>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Esporta CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b-2 border-gray-200">
                    <th className="text-left p-3 font-semibold text-gray-700">#</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Descrizione Originale</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Codice</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Descrizione Codice</th>
                    <th className="text-left p-3 font-semibold text-gray-700">Match</th>
                    <th className="text-left p-3 font-semibold text-gray-700">File</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result, index) => (
                    <tr
                      key={index}
                      className={`border-b border-gray-100 ${
                        result.matched ? 'bg-green-50' : 'bg-red-50'
                      } hover:bg-opacity-75 transition-colors`}
                    >
                      <td className="p-3 text-gray-600">{index + 1}</td>
                      <td className="p-3 text-gray-800">
                        {result.originalDescription}
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-600">
                        {result.matchedCode}
                      </td>
                      <td className="p-3 text-gray-700">
                        {result.matchedDescription}
                      </td>
                      <td className="p-3">
                        {result.matched ? (
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              result.similarity > 0.7 ? 'bg-green-200 text-green-800' :
                              result.similarity > 0.5 ? 'bg-yellow-200 text-yellow-800' :
                              'bg-orange-200 text-orange-800'
                            }`}
                          >
                            {Math.round(result.similarity * 100)}%
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded bg-red-200 text-red-800">
                            ❌ No
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-gray-500">
                        {result.source || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
