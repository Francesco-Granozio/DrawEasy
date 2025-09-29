
import React from 'react';
import type { DrawingStep } from '../types';

interface StepCardProps {
  step: DrawingStep;
}

export const StepCard: React.FC<StepCardProps> = ({ step }) => {
  return (
    <div className="bg-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col transition-transform transform hover:-translate-y-1 hover:shadow-sky-500/20">
      <div className="relative w-full aspect-square bg-slate-700">
         <img src={step.imageUrl} alt={`Step ${step.step}`} className="w-full h-full object-cover" />
      </div>
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-lg font-bold text-sky-400 mb-2">Step {step.step}</h3>
        <p className="text-slate-300 text-sm flex-grow">{step.description}</p>
      </div>
    </div>
  );
};
