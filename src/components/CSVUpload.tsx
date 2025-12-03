import { useState, useRef } from 'react';
import { parseCSV, normalizeTransaction } from '../utils/csvParser';
import type { Transaction } from '../types/models';

interface CSVUploadProps {
  onTransactionsParsed: (transactions: Transaction[]) => void;
  householdId: string;
}

export const CSVUpload = ({ onTransactionsParsed, householdId }: CSVUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsingProgress, setParsingProgress] = useState<{ current: number; total: number; currentFile: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | File[]) => {
    const csvFiles = Array.from(files).filter(file => file.name.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      setError('Please upload CSV files');
      return;
    }

    setIsParsing(true);
    setError(null);
    setParsingProgress({ current: 0, total: csvFiles.length, currentFile: csvFiles[0].name });

    try {
      const allTransactions: Transaction[] = [];
      const errors: string[] = [];

      // Process files sequentially to show progress
      for (let i = 0; i < csvFiles.length; i++) {
        const file = csvFiles[i];
        setParsingProgress({ current: i + 1, total: csvFiles.length, currentFile: file.name });
        
        try {
          const rawTransactions = await parseCSV(file);

          // Normalize transactions
          const transactions: Transaction[] = rawTransactions.map(raw =>
            normalizeTransaction(raw, householdId, file.name)
          );

          allTransactions.push(...transactions);
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Failed to parse CSV file';
          console.error('[CSVUpload] Error parsing', file.name, ':', err);
          errors.push(`${file.name}: ${errorMsg}`);
        }
      }

      if (allTransactions.length > 0) {
        onTransactionsParsed(allTransactions);
      } else if (errors.length === 0) {
        console.warn('[CSVUpload] No transactions found in uploaded files');
      }

      if (errors.length > 0) {
        setError(`Some files failed to parse:\n${errors.join('\n')}`);
      }
    } catch (err) {
      console.error('[CSVUpload] Error processing files:', err);
      setError(err instanceof Error ? err.message : 'Failed to process CSV files');
    } finally {
      setIsParsing(false);
      setParsingProgress(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
  };

  return (
    <div className="mb-6">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 bg-white hover:border-blue-400 hover:bg-blue-50'
          }
          ${isParsing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          multiple
          onChange={handleFileInput}
          className="hidden"
          disabled={isParsing}
        />

        {isParsing ? (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 font-medium">
              {parsingProgress 
                ? `Parsing file ${parsingProgress.current} of ${parsingProgress.total}: ${parsingProgress.currentFile}`
                : 'Parsing CSV files...'}
            </p>
            {parsingProgress && (
              <div className="w-full max-w-xs bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(parsingProgress.current / parsingProgress.total) * 100}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white text-3xl">📁</span>
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-900 mb-1">
                Upload Bank Statement (CSV)
              </p>
              <p className="text-sm text-gray-600">
                Drag & drop or click to browse (multiple files supported)
              </p>
            </div>
            <p className="text-xs text-gray-500">
              Supported: TD, RBC, Scotiabank, BMO, CIBC, Tangerine, and generic CSV formats
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
          <p className="text-red-700 font-medium">Error: {error}</p>
        </div>
      )}
    </div>
  );
};

