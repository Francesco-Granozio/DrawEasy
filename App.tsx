import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { StepsGallery } from './components/StepsGallery';
import { LoadingIndicator } from './components/LoadingIndicator';
import { StepInteractor } from './components/StepInteractor';
import { StepCard } from './components/StepCard';
import { generateFirstStepInstructions, generateValidatedStep } from './services/geminiService';
import type { DrawingStep, AppState, ImageObject, ExpertInstruction } from './types';
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

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppStateEnum.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // State for interactive flow
  const [totalSteps] = useState<number>(10);
  const [acceptedSteps, setAcceptedSteps] = useState<DrawingStep[]>([]);
  const [proposedStep, setProposedStep] = useState<DrawingStep | null>(null);
  const [currentStepNumber, setCurrentStepNumber] = useState<number>(1);
  const [originalImage, setOriginalImage] = useState<ImageObject | null>(null);
  const [currentCanvas, setCurrentCanvas] = useState<ImageObject | null>(null);
  const [currentInstructions, setCurrentInstructions] = useState<ExpertInstruction | null>(null);

  // Validation info
  const [validationAttempts, setValidationAttempts] = useState<number>(0);
  const [validationScore, setValidationScore] = useState<number | null>(null);

  const processStep = useCallback(async (
    instructions: ExpertInstruction,
    canvas: ImageObject | null,
    oImage: ImageObject,
    feedback?: string
  ) => {
    setAppState(AppStateEnum.LOADING);
    setStatusMessage(`Expert is analyzing and generating step ${instructions.stepNumber} of ${totalSteps}...`);
    setProposedStep(null);
    setValidationAttempts(0);
    setValidationScore(null);

    try {
      // L'esperto genera e valida lo step
      const result = await generateValidatedStep(
        oImage,
        canvas,
        instructions,
        3,
        feedback
      );

      setValidationAttempts(result.attempts);
      setValidationScore(result.finalScore);

      console.log(`Step ${instructions.stepNumber} completed:`, {
        attempts: result.attempts,
        score: result.finalScore,
        approved: result.validation.approved
      });

      const newProposedStep: DrawingStep = {
        step: instructions.stepNumber,
        description: instructions.whatToDraw,
        imageUrl: `data:${result.image.mimeType};base64,${result.image.base64}`,
      };
      
      setProposedStep(newProposedStep);
      
      // Salva le istruzioni per il prossimo step se disponibili
      if (result.validation.instructionsForNextStep) {
        setCurrentInstructions(result.validation.instructionsForNextStep);
      }
      
      setAppState(AppStateEnum.AWAITING_USER_INPUT);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate step ${instructions.stepNumber}. ${errorMessage}`);
      setAppState(AppStateEnum.ERROR);
    }
  }, [totalSteps]);

  const handleImageUpload = useCallback(async (file: File) => {
    setAppState(AppStateEnum.LOADING);
    setError(null);
    setAcceptedSteps([]);
    setProposedStep(null);
    setCurrentStepNumber(1);
    setCurrentCanvas(null);
    setValidationAttempts(0);
    setValidationScore(null);
    setStatusMessage('Preparing your image...');

    try {
      const { base64: imageBase64, mimeType } = await resizeImage(file, 1024, 1024);
      const originalImgObj = { base64: imageBase64, mimeType };
      setOriginalImage(originalImgObj);

      setStatusMessage('Expert is analyzing the image and planning the first step...');
      
      // L'esperto genera le istruzioni per il primo step
      const firstStepInstructions = await generateFirstStepInstructions(originalImgObj, totalSteps);
      
      console.log('First step instructions:', firstStepInstructions);
      setCurrentInstructions(firstStepInstructions);
      
      // Genera il primo step
      await processStep(firstStepInstructions, null, originalImgObj);

    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to start tutorial. ${errorMessage}`);
      setAppState(AppStateEnum.ERROR);
    }
  }, [processStep, totalSteps]);

  const handleAcceptStep = useCallback(async () => {
    if (!proposedStep || !originalImage) return;

    // Aggiungi lo step accettato
    const newAcceptedSteps = [...acceptedSteps, proposedStep];
    setAcceptedSteps(newAcceptedSteps);

    // Aggiorna il canvas
    const [, imageData] = proposedStep.imageUrl.split(';base64,');
    const mimeType = proposedStep.imageUrl.substring(5, proposedStep.imageUrl.indexOf(';'));
    const newCanvas = { base64: imageData, mimeType };
    setCurrentCanvas(newCanvas);
    
    setProposedStep(null);
    
    const nextStepNumber = currentStepNumber + 1;
    setCurrentStepNumber(nextStepNumber);

    // Se ci sono ancora step da fare
    if (nextStepNumber <= totalSteps && currentInstructions) {
      await processStep(currentInstructions, newCanvas, originalImage);
    } else {
      setAppState(AppStateEnum.RESULTS);
    }
  }, [proposedStep, acceptedSteps, currentStepNumber, totalSteps, currentInstructions, originalImage, processStep]);

  const handleRetryStep = useCallback((feedback: string) => {
    if (!currentInstructions || !originalImage) return;
    processStep(currentInstructions, currentCanvas, originalImage, feedback);
  }, [currentInstructions, currentCanvas, originalImage, processStep]);

  const handleReset = () => {
    setAppState(AppStateEnum.IDLE);
    setAcceptedSteps([]);
    setProposedStep(null);
    setCurrentStepNumber(1);
    setOriginalImage(null);
    setCurrentCanvas(null);
    setCurrentInstructions(null);
    setError(null);
    setStatusMessage('');
    setValidationAttempts(0);
    setValidationScore(null);
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
            {proposedStep && (
              <>
                <StepInteractor step={proposedStep} onAccept={handleAcceptStep} onRetry={handleRetryStep} />
                
                {/* Expert instructions display */}
                {currentInstructions && (
                  <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <h3 className="font-semibold text-amber-900 mb-2">Expert Instructions:</h3>
                    <p className="text-sm text-amber-800 mb-2">
                      <strong>What to draw:</strong> {currentInstructions.whatToDraw}
                    </p>
                    <p className="text-xs text-amber-700">
                      Target: {currentInstructions.targetCompleteness}% complete
                    </p>
                  </div>
                )}
                
                {/* Validation info */}
                {validationScore !== null && (
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-stone-100 rounded-lg text-sm">
                      <span className="text-stone-600">
                        Expert Score: <strong className={validationScore >= 70 ? 'text-green-600' : validationScore >= 50 ? 'text-amber-600' : 'text-red-600'}>{validationScore}/100</strong>
                      </span>
                      {validationAttempts > 1 && (
                        <span className="text-stone-500">
                          • {validationAttempts} attempt{validationAttempts > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
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
              className="px-6 py-2 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-75 transition-colors"
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

  const isInteractiveView = appState === AppStateEnum.LOADING || appState === AppStateEnum.AWAITING_USER_INPUT;

  return (
    <div className="min-h-screen text-stone-800 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-7xl mx-auto flex items-center justify-center sm:justify-start mb-8">
         <div className="flex items-center space-x-3">
           <LogoIcon />
            <h1 className="text-2xl sm:text-3xl font-bold text-amber-800 tracking-wide">
              DrawEasy
            </h1>
         </div>
      </header>
      <main className="w-full max-w-7xl mx-auto flex-grow flex flex-col md:flex-row gap-8 items-start">
        {isInteractiveView && originalImage && (
            <aside className="w-full md:w-2/5 lg:w-1/3 p-4">
                <div className="sticky top-8">
                    <h2 className="text-xl font-bold text-amber-800 mb-4 text-center">Reference Image</h2>
                    <div className="bg-white/50 backdrop-blur-sm border border-stone-300/50 rounded-xl shadow-lg overflow-hidden">
                        <img 
                            src={`data:${originalImage.mimeType};base64,${originalImage.base64}`} 
                            alt="User's original drawing for reference"
                            className="w-full h-auto object-contain rounded-xl"
                        />
                    </div>
                    
                    {/* Step progress indicator */}
                    <div className="mt-4 p-3 bg-amber-50 rounded-lg">
                      <p className="text-sm text-center text-amber-800">
                        Step {currentStepNumber} of {totalSteps}
                      </p>
                      <div className="mt-2 w-full bg-amber-200 rounded-full h-2">
                        <div 
                          className="bg-amber-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${(currentStepNumber / totalSteps) * 100}%` }}
                        />
                      </div>
                    </div>
                </div>
            </aside>
        )}
        <div className={isInteractiveView ? "w-full md:w-3/5 lg:w-2/3" : "w-full flex-grow flex flex-col justify-center"}>
            {renderContent()}
        </div>
      </main>
      <footer className="w-full max-w-7xl mx-auto text-center py-4 mt-8">
      </footer>
    </div>
  );
};

export default App;