import React, { useState } from 'react';
import type { DrawingStep } from '../types';
import { StepCard } from './StepCard';

interface StepInteractorProps {
  step: DrawingStep;
  onAccept: () => void;
  onRetry: (feedback: string) => void;
}

export const StepInteractor: React.FC<StepInteractorProps> = ({ step, onAccept, onRetry }) => {
  const [showRetryInput, setShowRetryInput] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleRetryClick = () => {
    setShowRetryInput(true);
  };

  const handleRegenerate = () => {
    onRetry(feedback);
    setShowRetryInput(false);
    setFeedback('');
  };

  return (
    <div className="w-full max-w-md mx-auto mt-8 p-6 bg-slate-800 rounded-2xl shadow-2xl shadow-sky-900/20 border border-slate-700">
      <h2 className="text-2xl font-bold text-center text-sky-400 mb-4">Does this look right?</h2>
      <StepCard step={step} />
      
      {showRetryInput ? (
        <div className="mt-6">
          <label htmlFor="feedback" className="block text-sm font-medium text-slate-300 mb-2">
            What should be different? (optional)
          </label>
          <textarea
            id="feedback"
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g., 'Make the circle smaller' or 'Draw the line straighter'"
            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-slate-200 focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
          />
          <div className="flex justify-end gap-4 mt-4">
            <button
              onClick={() => setShowRetryInput(false)}
              className="px-4 py-2 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-75 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              className="px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition"
            >
              Regenerate
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-center gap-4 mt-6">
          <button
            onClick={handleRetryClick}
            className="px-6 py-3 bg-slate-600 text-white font-semibold rounded-lg shadow-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-opacity-75 transition transform hover:scale-105"
          >
            Discard & Retry
          </button>
          <button
            onClick={onAccept}
            className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-75 transition transform hover:scale-105"
          >
            Accept & Continue
          </button>
        </div>
      )}
    </div>
  );
};