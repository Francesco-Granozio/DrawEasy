import { GoogleGenAI, Type, Modality } from "@google/genai";
// FIX: Import shared ImageObject type.
import type { StepDescription, ImageObject } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const INSTRUCTION_FOR_STEPS = `
You are an expert drawing instructor. Analyze the provided drawing.
Your task is to generate a step-by-step tutorial to recreate this drawing. The tutorial should consist of 6-8 simple, sequential steps.
For each step, provide a clear, one-sentence description of what to draw. The descriptions should be concise and action-oriented, describing only the new elements to add in that step.

Example for a simple house drawing:
- Step 1: "Draw a horizontal line for the ground."
- Step 2: "Add a large square on top of the ground line for the main body of the house."
- Step 3: "Draw a triangle on top of the square to form the roof."

Respond with only the JSON object.
`;

export const getDrawingSteps = async (imageBase64: string, mimeType: string): Promise<StepDescription[]> => {
    const imagePart = {
      inlineData: {
        data: imageBase64,
        mimeType: mimeType,
      },
    };

    const textPart = {
        text: INSTRUCTION_FOR_STEPS
    };

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    steps: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                step: { type: Type.INTEGER },
                                description: { type: Type.STRING },
                            },
                            required: ["step", "description"],
                        }
                    }
                },
                required: ["steps"],
            },
        }
    });
    
    const jsonStr = response.text.trim();
    const result = JSON.parse(jsonStr);

    return result.steps as StepDescription[];
};

// FIX: Removed local ImageObject type. It is now imported from types.ts.

export const generateStepImage = async (
    originalImage: ImageObject,
    canvasImage: ImageObject,
    stepDescription: string,
    userFeedback?: string,
): Promise<ImageObject> => {
    
    let instruction = `You are a precise and meticulous illustrator AI. Your task is to perfectly replicate a single step in a drawing tutorial.

You will receive three inputs:
1.  **Canvas Image:** This is the current state of the drawing. It might be blank or have lines from previous steps.
2.  **Reference Image:** This is the complete, final drawing. It is your absolute guide for placement, style, and proportions.
3.  **Instruction:** A text description of what to draw in this step. The current instruction is: "${stepDescription}".

**Your Critical Mission:**
- Draw *only* the new elements described in the instruction.
- The most important rule is **POSITIONING**: The new elements you draw on the canvas **MUST** be in the exact same position and have the exact same proportions as they appear in the **Reference Image**.
- Do not alter or redraw any existing lines on the canvas. Your output must include everything from the original canvas plus the new elements.
- The final output must be a clean, black and white line art image on a plain white background.
- Output ONLY the final image. Do not add any text, labels, or annotations.`;

    if (userFeedback && userFeedback.trim().length > 0) {
        instruction += `\n\n**Important Correction:** A previous attempt was incorrect. Please adhere to the following user feedback: "${userFeedback}". Re-evaluate the instruction and the reference image to ensure the new output is correct.`;
    }

    const parts = [
      { inlineData: { data: canvasImage.base64, mimeType: canvasImage.mimeType } },
      { inlineData: { data: originalImage.base64, mimeType: originalImage.mimeType } },
      { text: instruction },
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image-preview',
      contents: { parts },
      config: {
          responseModalities: [Modality.IMAGE, Modality.TEXT],
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
      }
    }

    throw new Error('Image generation failed to return an image.');
};