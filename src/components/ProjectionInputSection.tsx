import { useState, ReactNode } from 'react';

interface ProjectionInputSectionProps {
  title: string;
  children: ReactNode;
  defaultExpanded?: boolean;
  helpText?: string;
  className?: string;
}

export const ProjectionInputSection = ({
  title,
  children,
  defaultExpanded = false,
  helpText,
  className = '',
}: ProjectionInputSectionProps) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-gray-900">{title}</span>
          {helpText && (
            <span
              className="text-gray-400 hover:text-gray-600 cursor-help"
              title={helpText}
            >
              ℹ️
            </span>
          )}
        </div>
        <svg
          className={`w-5 h-5 text-gray-500 transition-transform ${
            isExpanded ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {isExpanded && (
        <div className="p-4 pt-0 border-t border-gray-200">
          {children}
        </div>
      )}
    </div>
  );
};



