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
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }

    setIsParsing(true);
    setError(null);

    try {
      console.log('[CSVUpload] Parsing file:', file.name);
      const rawTransactions = await parseCSV(file);
      console.log('[CSVUpload] Parsed', rawTransactions.length, 'raw transactions');

      // Normalize transactions
      const transactions: Transaction[] = rawTransactions.map(raw =>
        normalizeTransaction(raw, householdId, file.name)
      );

      console.log('[CSVUpload] Normalized', transactions.length, 'transactions');
      onTransactionsParsed(transactions);
    } catch (err) {
      console.error('[CSVUpload] Error parsing CSV:', err);
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file');
    } finally {
      setIsParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
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
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
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
          onChange={handleFileInput}
          className="hidden"
          disabled={isParsing}
        />

        {isParsing ? (
          <div className="flex flex-col items-center gap-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 font-medium">Parsing CSV file...</p>
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
                Drag & drop or click to browse
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

