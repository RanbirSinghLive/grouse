import { useState, useEffect } from 'react';

interface ContributionRoomInputProps {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  currentBalance?: number; // Current account balance
  maxContribution?: number; // Maximum allowed contribution room
  currency?: 'CAD' | 'USD';
  helpText?: string;
  className?: string;
}

export const ContributionRoomInput = ({
  label,
  value,
  onChange,
  currentBalance,
  maxContribution,
  currency = 'CAD',
  helpText,
  className = '',
}: ContributionRoomInputProps) => {
  const [inputValue, setInputValue] = useState<string>(
    value !== undefined ? value.toString() : ''
  );
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setInputValue(value !== undefined ? value.toString() : '');
  }, [value]);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    if (newValue === '') {
      onChange(undefined);
      setError('');
      return;
    }

    const numValue = parseFloat(newValue);
    if (isNaN(numValue)) {
      setError('Please enter a valid number');
      return;
    }

    if (numValue < 0) {
      setError('Contribution room cannot be negative');
      return;
    }

    if (maxContribution !== undefined && numValue > maxContribution) {
      setError(`Exceeds maximum contribution room of ${formatCurrency(maxContribution)}`);
      return;
    }

    setError('');
    onChange(numValue);
  };

  const remainingRoom = currentBalance !== undefined && value !== undefined
    ? Math.max(0, value - currentBalance)
    : undefined;

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
        {helpText && (
          <span className="ml-2 text-gray-400 hover:text-gray-600 cursor-help" title={helpText}>
            ℹ️
          </span>
        )}
      </label>
      <div className="space-y-2">
        <input
          type="number"
          value={inputValue}
          onChange={handleChange}
          placeholder="Enter contribution room"
          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 ${
            error
              ? 'border-red-300 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
          min="0"
          step="1"
        />
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
        {currentBalance !== undefined && (
          <p className="text-xs text-gray-600">
            Current balance: {formatCurrency(currentBalance)}
          </p>
        )}
        {remainingRoom !== undefined && (
          <p className="text-xs text-blue-600">
            Remaining room: {formatCurrency(remainingRoom)}
          </p>
        )}
        {maxContribution !== undefined && (
          <p className="text-xs text-gray-500">
            Maximum: {formatCurrency(maxContribution)}
          </p>
        )}
      </div>
    </div>
  );
};



