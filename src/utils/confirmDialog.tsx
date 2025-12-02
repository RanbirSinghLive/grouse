import { useState, useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  onDontAskAgain?: (dontAsk: boolean) => void;
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  onDontAskAgain,
}: ConfirmDialogProps) => {
  const [dontAskAgain, setDontAskAgain] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onDontAskAgain) {
      onDontAskAgain(dontAskAgain);
    }
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 p-6 max-w-md w-full mx-4">
        <h3 className="text-xl font-bold text-gray-900 mb-4">{title}</h3>
        <p className="text-gray-700 mb-6">{message}</p>
        
        {onDontAskAgain && (
          <div className="mb-4 flex items-center">
            <input
              type="checkbox"
              id="dontAskAgain"
              checked={dontAskAgain}
              onChange={(e) => setDontAskAgain(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="dontAskAgain" className="ml-2 text-sm text-gray-700">
              Don't ask again this session
            </label>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-white text-gray-700 border-2 border-gray-300 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 shadow-lg hover:shadow-xl transition-all"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook for session-based "don't ask again" confirmation
export const useConfirmDelete = (key: string) => {
  const [showDialog, setShowDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);

  useEffect(() => {
    // Check sessionStorage on mount
    const stored = sessionStorage.getItem(`confirm-delete-${key}`);
    if (stored === 'true') {
      setDontAskAgain(true);
    }
  }, [key]);

  const [deleteMessage, setDeleteMessage] = useState('Are you sure you want to delete this item?');

  const confirmDelete = (action: () => void, message: string = 'Are you sure you want to delete this item?') => {
    if (dontAskAgain) {
      // Skip confirmation if user chose "don't ask again"
      action();
      return;
    }

    // Show confirmation dialog
    setDeleteMessage(message);
    setPendingAction(() => action);
    setShowDialog(true);
  };

  const handleConfirm = () => {
    if (pendingAction) {
      pendingAction();
    }
    setShowDialog(false);
    setPendingAction(null);
  };

  const handleCancel = () => {
    setShowDialog(false);
    setPendingAction(null);
  };

  const handleDontAskAgain = (dontAsk: boolean) => {
    if (dontAsk) {
      sessionStorage.setItem(`confirm-delete-${key}`, 'true');
      setDontAskAgain(true);
    }
  };

  return {
    confirmDelete,
    showDialog,
    deleteMessage,
    handleConfirm,
    handleCancel,
    handleDontAskAgain,
  };
};

