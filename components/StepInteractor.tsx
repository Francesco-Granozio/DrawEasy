import React, { useState } from 'react';
import type { DrawingStep } from '../types';
import { StepCard } from './StepCard';

interface StepInteractorProps {
  step: DrawingStep;
  onAccept: () => void;
  onRetry: (feedback: string) => void;
  onBreakDown: () => void;
}

export const StepInteractor: React.FC<StepInteractorProps> = ({ step, onAccept, onRetry, onBreakDown }) => {
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
    <div className="w-full max-w-md mx-auto mt-8 p-6 bg-white/60 backdrop-blur-md rounded-2xl shadow-2xl shadow-stone-400/20 border border-stone-300/50">
      <h2 className="text-2xl font-bold text-center text-amber-800 mb-4">Does this look right?</h2>
      <StepCard step={step} />
      
      {showRetryInput ? (
        <div className="mt-6">
          <label htmlFor="feedback" className="block text-sm font-medium text-stone-600 mb-2">
            What should be different? (optional)
          </label>
          <textarea
            id="feedback"
            rows={3}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g., 'Make the circle smaller' or 'Draw the line straighter'"
            className="w-full bg-white/80 border border-stone-300 rounded-lg p-3 text-stone-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
          />
          <div className="flex justify-end gap-4 mt-4">
            <button
              onClick={() => setShowRetryInput(false)}
              className="px-4 py-2 bg-stone-500 text-white font-semibold rounded-lg shadow-md hover:bg-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-opacity-75 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleRegenerate}
              className="px-4 py-2 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-75 transition"
            >
              Regenerate
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-4 mt-6">
          <button
            onClick={handleRetryClick}
            className="px-6 py-3 bg-stone-500 text-white font-semibold rounded-lg shadow-md hover:bg-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-opacity-75 transition transform hover:scale-105"
          >
            Discard & Retry
          </button>
           <button
            onClick={onBreakDown}
            className="px-6 py-3 bg-violet-600 text-white font-semibold rounded-lg shadow-md hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-opacity-75 transition transform hover:scale-105"
          >
            Break Down Step
          </button>
          <button
            onClick={onAccept}
            className="px-6 py-3 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75 transition transform hover:scale-105"
          >
            Accept & Continue
          </button>
        </div>
      )}
    </div>
  );
};