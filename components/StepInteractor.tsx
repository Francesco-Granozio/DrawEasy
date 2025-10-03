import React, { useState } from 'react';
import type { DrawingStep } from '../types';
import { StepCard } from './StepCard';
import { AreaSelector } from './AreaSelector';
import { EditAreaIcon } from './icons';

// Main interaction component - lets users accept, reject, or refine a proposed step
// This is the core decision point where users control the tutorial progression
interface StepInteractorProps {
  step: DrawingStep;
  onAccept: () => void;
  onRetry: (feedback: string) => void;
  onAreaRetry: (area: { x: number; y: number; width: number; height: number }, feedback: string) => void;
}

export const StepInteractor: React.FC<StepInteractorProps> = ({ step, onAccept, onRetry, onAreaRetry }) => {
  // UI state for different interaction modes
  const [showRetryInput, setShowRetryInput] = useState(false);    // Show feedback input for general retry
  const [showAreaSelector, setShowAreaSelector] = useState(false); // Show area selection for targeted retry
  const [feedback, setFeedback] = useState('');                   // User's feedback text

  // Show feedback input for general retry
  const handleRetryClick = () => {
    setShowRetryInput(true);
  };

  // Show area selector for targeted retry
  const handleEditAreaClick = () => {
    setShowAreaSelector(true);
  };

  // Submit general retry with user feedback
  const handleRegenerate = () => {
    onRetry(feedback);
    setShowRetryInput(false);
    setFeedback('');
  };

  // Submit area-specific retry with coordinates and feedback
  const handleAreaSelected = (area: { x: number; y: number; width: number; height: number }, areafeedback: string) => {
    onAreaRetry(area, areafeedback);
    setShowAreaSelector(false);
  };

  // Cancel area selection and return to main interface
  const handleCancelAreaSelector = () => {
    setShowAreaSelector(false);
  };

  // If area selector is active, show only that component
  if (showAreaSelector) {
    return <AreaSelector imageUrl={step.imageUrl} onAreaSelected={handleAreaSelected} onCancel={handleCancelAreaSelector} />;
  }

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
        <div className="space-y-3 mt-6">
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={handleRetryClick}
              className="px-5 py-2.5 bg-stone-500 text-white font-semibold rounded-lg shadow-md hover:bg-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-opacity-75 transition transform hover:scale-105"
            >
              Discard & Retry
            </button>
            <button
              onClick={handleEditAreaClick}
              className="px-5 py-2.5 bg-amber-500 text-white font-semibold rounded-lg shadow-md hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-opacity-75 transition transform hover:scale-105 flex items-center gap-2"
            >
              <EditAreaIcon className="w-4 h-4" />
              Edit Specific Area
            </button>
            <button
              onClick={onAccept}
              className="px-5 py-2.5 bg-emerald-600 text-white font-semibold rounded-lg shadow-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-opacity-75 transition transform hover:scale-105"
            >
              Accept & Continue
            </button>
          </div>
          <p className="text-xs text-center text-stone-500">
            Use "Edit Specific Area" to improve a particular part of the drawing
          </p>
        </div>
      )}
    </div>
  );
};
