import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { StepsGallery } from './components/StepsGallery';
import { LoadingIndicator } from './components/LoadingIndicator';
import { StepInteractor } from './components/StepInteractor';
import { StepCard } from './components/StepCard';
import { getDrawingSteps, generateStepImage } from './services/geminiService';
import type { DrawingStep, AppState, StepDescription, ImageObject } from './types';
import { AppStateEnum } from './types';
import { LogoIcon } from './components/icons';

const resizeImage = (file: File, maxWidth: number, maxHeight: number): Promise<{ base64: string; mimeType: 'image/png'; width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error("Couldn't read file"));
      }
      const img = new Image();
      img.src = event.target.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Could not get canvas context'));
        }
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        resolve({ base64, mimeType: 'image/png', width, height });
      };
      img.onerror = (err) => reject(err instanceof Event ? new Error('Image loading error') : err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const createBlankCanvasB64 = (width: number, height: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not get canvas context for blank image');
    }
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.split(',')[1];
};


const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppStateEnum.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // State for interactive flow
  const [stepDescriptions, setStepDescriptions] = useState<StepDescription[]>([]);
  const [acceptedSteps, setAcceptedSteps] = useState<DrawingStep[]>([]);
  const [proposedStep, setProposedStep] = useState<DrawingStep | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [originalImage, setOriginalImage] = useState<ImageObject | null>(null);
  const [currentCanvas, setCurrentCanvas] = useState<ImageObject | null>(null);

  const processStep = useCallback(async (
    index: number,
    canvas: ImageObject,
    feedback?: string,
    // Optional overrides to solve race condition on initial generation
    oImage?: ImageObject,
    sDescriptions?: StepDescription[]
  ) => {
    const currentOriginalImage = oImage || originalImage;
    const currentStepDescriptions = sDescriptions || stepDescriptions;

    if (!currentOriginalImage || !currentStepDescriptions[index]) {
      setError('An internal error occurred: missing data for step generation.');
      setAppState(AppStateEnum.ERROR);
      return;
    }

    setAppState(AppStateEnum.LOADING);
    setStatusMessage(`Generating image for step ${index + 1} of ${currentStepDescriptions.length}...`);
    setProposedStep(null);

    try {
      const description = currentStepDescriptions[index].description;
      const newCanvasData = await generateStepImage(
        currentOriginalImage,
        canvas,
        description,
        feedback
      );

      const newProposedStep: DrawingStep = {
        step: index + 1,
        description: description,
        imageUrl: `data:${newCanvasData.mimeType};base64,${newCanvasData.base64}`,
      };
      
      setProposedStep(newProposedStep);
      setAppState(AppStateEnum.AWAITING_USER_INPUT);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate image for step ${index + 1}. ${errorMessage}`);
      setAppState(AppStateEnum.ERROR);
    }
  }, [originalImage, stepDescriptions]);

  const handleImageUpload = useCallback(async (file: File) => {
    setAppState(AppStateEnum.LOADING);
    setError(null);
    setAcceptedSteps([]);
    setProposedStep(null);
    setCurrentStepIndex(0);
    setStatusMessage('Preparing your image...');

    try {
      const { base64: imageBase64, mimeType, width, height } = await resizeImage(file, 1024, 1024);
      const blankCanvasB64 = createBlankCanvasB64(width, height);
      
      const originalImgObj = { base64: imageBase64, mimeType };
      const blankCanvasObj = { base64: blankCanvasB64, mimeType: 'image/png' as const };

      setOriginalImage(originalImgObj);
      setCurrentCanvas(blankCanvasObj); // Set for the first potential retry

      setStatusMessage('Breaking down drawing into steps...');
      const steps: StepDescription[] = await getDrawingSteps(imageBase64, mimeType);

      if (!steps || steps.length === 0) {
        throw new Error('Could not generate drawing steps. Please try another image.');
      }
      setStepDescriptions(steps);
      
      // Kick off the first step generation, passing data directly to avoid race condition with state update
      await processStep(0, blankCanvasObj, undefined, originalImgObj, steps);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate tutorial. ${errorMessage}`);
      setAppState(AppStateEnum.ERROR);
    }
  }, [processStep]);

  const handleAcceptStep = useCallback(async () => {
    if (!proposedStep) return;

    // Add accepted step
    const newAcceptedSteps = [...acceptedSteps, proposedStep];
    setAcceptedSteps(newAcceptedSteps);

    // Update canvas from proposed step's image data for the next step
    const [, imageData] = proposedStep.imageUrl.split(';base64,');
    const mimeType = proposedStep.imageUrl.substring(5, proposedStep.imageUrl.indexOf(';'));
    const newCanvas = { base64: imageData, mimeType };
    setCurrentCanvas(newCanvas);
    
    setProposedStep(null);
    
    const nextStepIndex = currentStepIndex + 1;

    if (nextStepIndex < stepDescriptions.length) {
      setCurrentStepIndex(nextStepIndex);
      await processStep(nextStepIndex, newCanvas);
    } else {
      setAppState(AppStateEnum.RESULTS);
    }
  }, [proposedStep, acceptedSteps, currentStepIndex, stepDescriptions, processStep]);

  const handleRetryStep = useCallback((feedback: string) => {
    if (!currentCanvas) return; // Guard against unlikely race condition
    processStep(currentStepIndex, currentCanvas, feedback);
  }, [currentStepIndex, processStep, currentCanvas]);

  const handleReset = () => {
    setAppState(AppStateEnum.IDLE);
    setAcceptedSteps([]);
    setProposedStep(null);
    setStepDescriptions([]);
    setCurrentStepIndex(0);
    setOriginalImage(null);
    setCurrentCanvas(null);
    setError(null);
    setStatusMessage('');
  };

  const renderContent = () => {
    switch (appState) {
      case AppStateEnum.LOADING:
        return (
          <>
            {acceptedSteps.length > 0 && (
              <div className="w-full mb-8">
                <h2 className="text-2xl font-bold text-center mb-6">Your Progress So Far...</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
                  {acceptedSteps.map((step) => <StepCard key={step.step} step={step} />)}
                </div>
              </div>
            )}
            <LoadingIndicator message={statusMessage} />
          </>
        );
      case AppStateEnum.AWAITING_USER_INPUT:
        return (
          <>
            {acceptedSteps.length > 0 && (
              <div className="w-full mb-8">
                <h2 className="text-2xl font-bold text-center mb-6">Your Progress So Far...</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full">
                  {acceptedSteps.map((step) => <StepCard key={step.step} step={step} />)}
                </div>
              </div>
            )}
            {proposedStep && <StepInteractor step={proposedStep} onAccept={handleAcceptStep} onRetry={handleRetryStep} />}
          </>
        );
      case AppStateEnum.RESULTS:
        return <StepsGallery steps={acceptedSteps} onReset={handleReset} />;
      case AppStateEnum.ERROR:
        return (
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-red-500 mb-4">Oops! Something went wrong.</h2>
            <p className="text-red-400 mb-6">{error}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-sky-600 text-white font-semibold rounded-lg shadow-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-opacity-75 transition-colors"
            >
              Try Again
            </button>
          </div>
        );
      case AppStateEnum.IDLE:
      default:
        return <ImageUploader onImageUpload={handleImageUpload} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-5xl mx-auto flex items-center justify-center sm:justify-start mb-8">
         <div className="flex items-center space-x-3">
           <LogoIcon />
            <h1 className="text-2xl sm:text-3xl font-bold text-sky-400">
              Draw Step by Step AI
            </h1>
         </div>
      </header>
      <main className="w-full max-w-5xl mx-auto flex-grow flex flex-col justify-center">
        {renderContent()}
      </main>
      <footer className="w-full max-w-5xl mx-auto text-center py-4 mt-8">
        <p className="text-sm text-slate-500">Powered by Gemini AI</p>
      </footer>
    </div>
  );
};

export default App;