/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { FileText, AlertTriangle, Zap } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

type FileData = { name: string; content: string };

export default function App() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [auditResult, setAuditResult] = useState<any>(null);
  const [selection, setSelection] = useState<{ text: string; rect: DOMRect } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = Array.from(e.target.files || []);
    uploadedFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFiles(prev => [...prev, { name: file.name, content: e.target?.result as string }]);
      };
      reader.readAsText(file);
    });
  };

  const handleAudit = async () => {
    if (!selectedFile || !selection) return;
    
    // Get line and character from selection
    const lines = selectedFile.content.substring(0, selectedFile.content.indexOf(selection.text)).split('\n');
    const line = lines.length - 1;
    const character = lines[lines.length - 1].length;

    const response = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        fileName: selectedFile.name,
        line,
        character,
        files,
        targetCode: selectedFile.content 
      }),
    });
    const data = await response.json();
    setAuditResult(data);
    setSelection(null);
  };

  const getRiskColor = (score: number) => {
    if (score >= 8) return 'text-red-500';
    if (score >= 5) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      <div className="w-64 border-r border-gray-700 p-4">
        <h2 className="text-lg font-bold mb-4">Project Explorer</h2>
        <div className="text-sm text-green-500 mb-4">System: Online 🟢</div>
        <input type="file" multiple onChange={handleFileUpload} className="mb-4 text-sm" />
        {files.map(file => (
          <div key={file.name} className="cursor-pointer p-2 hover:bg-gray-800 text-sm" onClick={() => setSelectedFile(file)}>
            <FileText className="inline mr-2" size={16} /> {file.name}
          </div>
        ))}
      </div>

      <div className="flex-1 p-4 relative">
        {selectedFile ? (
          <div onMouseUp={() => {
            const sel = window.getSelection();
            if (sel && sel.toString().trim()) {
              const range = sel.getRangeAt(0);
              setSelection({ text: sel.toString().trim(), rect: range.getBoundingClientRect() });
            } else {
              setSelection(null);
            }
          }}>
            <SyntaxHighlighter language="typescript" style={vscDarkPlus}>
              {selectedFile.content}
            </SyntaxHighlighter>
          </div>
        ) : (
          <div className="text-gray-500">Select a file to audit</div>
        )}
        
        {selection && (
          <button 
            className="absolute bg-orange-500 text-black px-4 py-2 rounded shadow-lg font-bold flex items-center"
            style={{ top: selection.rect.top + 20, left: selection.rect.left }}
            onClick={handleAudit}
          >
            <Zap size={16} className="mr-2" /> Senior Audit
          </button>
        )}
      </div>

      <div className="w-96 border-l border-gray-700 p-4 bg-gray-800 overflow-y-auto">
        <h2 className="text-lg font-bold mb-4 flex items-center"><AlertTriangle className="mr-2"/> Senior Report</h2>
        {auditResult ? (
          <div className="space-y-4">
            <div className={`text-5xl font-bold ${getRiskColor(auditResult.riskScore)}`}>
              {auditResult.riskScore}/10
            </div>
            <p className="font-bold">{auditResult.riskLabel}</p>
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase">Architectural Risks</h3>
              <ul className="list-disc pl-4 text-sm">{auditResult.architecturalRisks?.map((r: string, i: number) => <li key={i}>{r}</li>)}</ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase">Warnings</h3>
              <ul className="list-disc pl-4 text-sm">{auditResult.warnings?.map((w: string, i: number) => <li key={i}>{w}</li>)}</ul>
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase">Strategy</h3>
              <p className="text-sm">{auditResult.migrationStrategy}</p>
            </div>
          </div>
        ) : (
          <div className="text-gray-500">Highlight a symbol to audit</div>
        )}
      </div>
    </div>
  );
}
