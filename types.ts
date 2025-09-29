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
}

// FIX: Add ImageObject interface to be shared across files.
export interface ImageObject {
    base64: string;
    mimeType: string;
}