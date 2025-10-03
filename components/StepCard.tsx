import React from 'react';
import type { DrawingStep } from '../types';

// Reusable card component for displaying individual tutorial steps
// Shows the step image and description in a consistent, attractive format
interface StepCardProps {
  step: DrawingStep;
}

export const StepCard: React.FC<StepCardProps> = ({ step }) => {
  return (
    <div className="bg-white/50 backdrop-blur-sm border border-stone-300/50 rounded-lg shadow-lg overflow-hidden flex flex-col transition-all duration-300 transform hover:-translate-y-1 hover:shadow-amber-900/10 hover:border-stone-400/80">
      {/* Image container with fixed aspect ratio for consistent layout */}
      <div className="relative w-full aspect-square bg-stone-200">
         <img src={step.imageUrl} alt={`Step ${step.step}`} className="w-full h-full object-cover" />
      </div>
      {/* Text content with step number and description */}
      <div className="p-3 flex-grow flex flex-col">
        <h3 className="text-base font-bold text-amber-800 mb-1.5">Step {step.step}</h3>
        <p className="text-stone-700 text-xs leading-tight flex-grow">{step.description}</p>
      </div>
    </div>
  );
};