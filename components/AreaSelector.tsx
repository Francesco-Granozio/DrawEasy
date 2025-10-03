import React, { useState, useRef, useCallback } from 'react';

// Component for selecting a specific area of an image to provide targeted feedback
// Allows users to click and drag to select a region, then provide feedback for that area
interface AreaSelectorProps {
  imageUrl: string;
  onAreaSelected: (area: { x: number; y: number; width: number; height: number }, feedback: string) => void;
  onCancel: () => void;
}

export const AreaSelector: React.FC<AreaSelectorProps> = ({ imageUrl, onAreaSelected, onCancel }) => {
  // Selection state management
  const [isSelecting, setIsSelecting] = useState(false);              // Currently dragging to select
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);  // Selection start point
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null); // Current mouse position
  const [selectedArea, setSelectedArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null); // Final selected area
  const [feedback, setFeedback] = useState('');                      // User's feedback for the selected area
  const canvasRef = useRef<HTMLDivElement>(null);                    // Reference to the image container

  // Start selection when user clicks and drags
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || selectedArea) return;
    
    // Convert mouse coordinates to percentage of image size
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setIsSelecting(true);
    setStartPoint({ x, y });
    setCurrentPoint({ x, y });
  }, [selectedArea]);

  // Update selection as user drags
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !canvasRef.current || !startPoint) return;
    
    // Convert mouse coordinates to percentage of image size
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    setCurrentPoint({ x, y });
  }, [isSelecting, startPoint]);

  // Complete selection when user releases mouse
  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !startPoint || !currentPoint) return;
    
    // Calculate final selection rectangle
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    
    // Minimum selectable area (5% x 5%) to prevent accidental tiny selections
    if (width < 5 || height < 5) {
      setIsSelecting(false);
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }
    
    setSelectedArea({ x, y, width, height });
    setIsSelecting(false);
    setStartPoint(null);
    setCurrentPoint(null);
  }, [isSelecting, startPoint, currentPoint]);

  const getSelectionStyle = (): React.CSSProperties => {
    if (!startPoint || !currentPoint) return {};
    
    const x = Math.min(startPoint.x, currentPoint.x);
    const y = Math.min(startPoint.y, currentPoint.y);
    const width = Math.abs(currentPoint.x - startPoint.x);
    const height = Math.abs(currentPoint.y - startPoint.y);
    
    return {
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      width: `${width}%`,
      height: `${height}%`,
      border: '2px dashed #d97706',
      backgroundColor: 'rgba(251, 191, 36, 0.2)',
      pointerEvents: 'none',
    };
  };

  const getSelectedAreaStyle = (): React.CSSProperties => {
    if (!selectedArea) return {};
    
    return {
      position: 'absolute',
      left: `${selectedArea.x}%`,
      top: `${selectedArea.y}%`,
      width: `${selectedArea.width}%`,
      height: `${selectedArea.height}%`,
      border: '3px solid #d97706',
      backgroundColor: 'rgba(251, 191, 36, 0.15)',
      pointerEvents: 'none',
    };
  };

  const handleReset = () => {
    setSelectedArea(null);
    setFeedback('');
  };

  const handleSubmit = () => {
    if (selectedArea && feedback.trim()) {
      onAreaSelected(selectedArea, feedback);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white/70 backdrop-blur-md rounded-2xl shadow-2xl shadow-stone-400/20 border border-stone-300/50">
      <h2 className="text-2xl font-bold text-center text-amber-800 mb-4">
        Select Area to Edit
      </h2>
      
      <div className="mb-4 p-3 bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-sm text-amber-900">
          <strong>Instructions:</strong> Click and drag to select the area you want to improve. 
          Then describe what you'd like to change.
        </p>
      </div>

      <div 
        ref={canvasRef}
        className="relative w-full bg-stone-100 rounded-lg overflow-hidden cursor-crosshair mb-4 shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ aspectRatio: '1/1' }}
      >
        <img 
          src={imageUrl} 
          alt="Drawing to edit" 
          className="w-full h-full object-contain pointer-events-none select-none"
          draggable={false}
        />
        
        {/* Selezione in corso */}
        {isSelecting && <div style={getSelectionStyle()} />}
        
        {/* Area selezionata */}
        {selectedArea && (
          <>
            <div style={getSelectedAreaStyle()} />
            <div className="absolute inset-0 bg-black/30 pointer-events-none">
              <div 
                style={{
                  position: 'absolute',
                  left: `${selectedArea.x}%`,
                  top: `${selectedArea.y}%`,
                  width: `${selectedArea.width}%`,
                  height: `${selectedArea.height}%`,
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                }}
              />
            </div>
          </>
        )}
      </div>

      {selectedArea && (
        <div className="space-y-4">
          <div>
            <label htmlFor="area-feedback" className="block text-sm font-medium text-stone-700 mb-2">
              What should be changed in this area?
            </label>
            <textarea
              id="area-feedback"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="e.g., 'Make the eyes more almond-shaped like in the original drawing'"
              className="w-full bg-white/80 border border-stone-300 rounded-lg p-3 text-stone-800 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition"
            />
          </div>
          
          <div className="flex justify-between gap-4">
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-stone-400 text-white font-semibold rounded-lg shadow-md hover:bg-stone-500 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-opacity-75 transition"
            >
              Reselect Area
            </button>
            <div className="flex gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 bg-stone-500 text-white font-semibold rounded-lg shadow-md hover:bg-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-opacity-75 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!feedback.trim()}
                className="px-6 py-2 bg-amber-600 text-white font-semibold rounded-lg shadow-md hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-opacity-75 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {!selectedArea && (
        <div className="flex justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-stone-500 text-white font-semibold rounded-lg shadow-md hover:bg-stone-600 focus:outline-none focus:ring-2 focus:ring-stone-400 focus:ring-opacity-75 transition"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

