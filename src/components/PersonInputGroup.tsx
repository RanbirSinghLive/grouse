import { ReactNode } from 'react';

interface PersonInputGroupProps {
  person1Label?: string;
  person2Label?: string;
  person1Content: ReactNode;
  person2Content?: ReactNode;
  showPerson2?: boolean;
  className?: string;
}

export const PersonInputGroup = ({
  person1Label = 'Person 1',
  person2Label = 'Person 2',
  person1Content,
  person2Content,
  showPerson2 = false,
  className = '',
}: PersonInputGroupProps) => {
  return (
    <div className={`grid grid-cols-1 ${showPerson2 ? 'md:grid-cols-2' : ''} gap-4 ${className}`}>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {person1Label}
        </label>
        {person1Content}
      </div>
      {showPerson2 && person2Content && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {person2Label}
          </label>
          {person2Content}
        </div>
      )}
    </div>
  );
};



