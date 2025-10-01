export enum AppStateEnum {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  AWAITING_USER_INPUT = 'AWAITING_USER_INPUT',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR',
}

export type AppState = AppStateEnum;

export interface DrawingStep {
  step: number;
  description: string;
  imageUrl: string;
}

export interface StepDescription {
    step: number;
    description: string;
    targetCompleteness: number; // 0-100, percentuale di completamento target
}

// FIX: Add ImageObject interface to be shared across files.
export interface ImageObject {
    base64: string;
    mimeType: string;
}

export interface ValidationResult {
    isValid: boolean;
    score: number; // 0-100
    issues: {
        tooDetailed: boolean;
        notDetailedEnough: boolean;
        wrongProportions: boolean;
        wrongPosition: boolean;
        deviatesFromOriginal: boolean;
    };
    feedback: string; // Feedback testuale da dare al generatore
    reasoning: string; // Spiegazione del giudizio
}

// Nuova interfaccia per le istruzioni dell'esperto
export interface ExpertInstruction {
    stepNumber: number;
    totalSteps: number;
    targetCompleteness: number; // 0-100
    whatToDraw: string; // Cosa disegnare in questo step
    drawingInstructions: string; // Istruzioni dettagliate per il disegnatore
    avoidance: string; // Cosa NON fare
}

// Risultato della validazione dell'esperto
export interface ExpertValidation {
    approved: boolean;
    score: number;
    issues: string[];
    nextAction: 'regenerate' | 'proceed';
    feedbackForRegeneration?: string; // Se deve rigenerare
    instructionsForNextStep?: ExpertInstruction; // Se procede
}