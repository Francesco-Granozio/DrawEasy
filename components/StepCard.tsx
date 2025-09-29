import React from 'react';
import type { DrawingStep } from '../types';

interface StepCardProps {
  step: DrawingStep;
}

export const StepCard: React.FC<StepCardProps> = ({ step }) => {
  return (
    <div className="bg-white/50 backdrop-blur-sm border border-stone-300/50 rounded-xl shadow-lg overflow-hidden flex flex-col transition-all duration-300 transform hover:-translate-y-1 hover:shadow-amber-900/10 hover:border-stone-400/80">
      <div className="relative w-full aspect-square bg-stone-200">
         <img src={step.imageUrl} alt={`Step ${step.step}`} className="w-full h-full object-cover" />
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-lg font-bold text-amber-800 mb-2">Step {step.step}</h3>
        <p className="text-stone-700 text-sm flex-grow">{step.description}</p>
      </div>
    </div>
  );
};