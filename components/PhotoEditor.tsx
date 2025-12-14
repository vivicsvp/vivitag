
import React, { useRef, useEffect, useState } from 'react';
import { Download, Plus, Trash2, Type as TypeIcon, Copy, Layers, Grid3X3, RotateCcw, ChevronDown } from 'lucide-react';
import { Layer, LayerType, Project } from '../types';

interface PhotoEditorProps {
  project: Project;
  onUpdate: (updatedProject: Project) => void;
  onApplyAll: () => void;
}

const FONTS = [
    { name: 'Padrão (Outfit)', value: 'Outfit' },
    { name: 'Manual (Playwrite)', value: 'Playwrite US Trad' },
    { name: 'Moderno (Montserrat)', value: 'Montserrat' },
];

const PhotoEditor: React.FC<PhotoEditorProps> = ({ project, onUpdate, onApplyAll }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [baseImage, setBaseImage] = useState<HTMLImageElement | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [showFontDropdown, setShowFontDropdown] = useState(false);

  // Initialize with a default layer if empty
  useEffect(() => {
    if (project.layers.length === 0 && baseImage) {
        addTextLayer('@SeuCanal');
    }
  }, [baseImage]);

  useEffect(() => {
    const img = new Image();
    img.src = URL.createObjectURL(project.file);
    img.onload = () => setBaseImage(img);
    return () => URL.revokeObjectURL(img.src);
  }, [project.file]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = baseImage.width;
    canvas.height = baseImage.height;

    ctx.drawImage(baseImage, 0, 0);

    project.layers.forEach(layer => {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      
      if (layer.type === LayerType.TEXT) {
        // Use the layer's font family or default to Outfit
        const fontFamily = layer.fontFamily || 'Outfit';
        ctx.font = `bold ${layer.fontSize}px "${fontFamily}", sans-serif`;
        ctx.fillStyle = layer.color || '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';
        
        ctx.fillText(layer.content as string, layer.x, layer.y);
      }
      ctx.restore();
    });
  }, [baseImage, project.layers]);

  // Drag and Drop Logic
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      // Simple hit detection
      const clickedLayer = project.layers.slice().reverse().find(layer => {
          if (layer.type === LayerType.TEXT) {
              // Approx hit box
              const size = layer.fontSize || 20;
              const len = (layer.content as string).length * (size * 0.5);
              return x >= layer.x - len && x <= layer.x + len && y >= layer.y - size && y <= layer.y + size;
          }
          return false;
      });

      if (clickedLayer) {
          setSelectedLayerId(clickedLayer.id);
          isDragging.current = true;
          dragStart.current = { x, y };
      } else {
          setSelectedLayerId(null);
          // Close font dropdown if open when clicking canvas
          setShowFontDropdown(false);
      }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging.current || !selectedLayerId) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const dx = x - dragStart.current.x;
      const dy = y - dragStart.current.y;

      updateLayer(selectedLayerId, {
          x: (project.layers.find(l => l.id === selectedLayerId)?.x || 0) + dx,
          y: (project.layers.find(l => l.id === selectedLayerId)?.y || 0) + dy
      });

      dragStart.current = { x, y };
  };

  const handleMouseUp = () => {
      isDragging.current = false;
  };

  // Add touch support for dragging on mobile
  const handleTouchStart = (e: React.TouchEvent) => {
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      const clickedLayer = project.layers.slice().reverse().find(layer => {
          if (layer.type === LayerType.TEXT) {
              const size = layer.fontSize || 20;
              const len = (layer.content as string).length * (size * 0.5);
              return x >= layer.x - len && x <= layer.x + len && y >= layer.y - size && y <= layer.y + size;
          }
          return false;
      });

      if (clickedLayer) {
          setSelectedLayerId(clickedLayer.id);
          isDragging.current = true;
          dragStart.current = { x, y };
          // Prevent scrolling while dragging
          if (e.cancelable) e.preventDefault();
      } else {
           // Don't deselect immediately on touch to allow scrolling if missed
           // But if we want to be consistent with mouse:
           setSelectedLayerId(null);
           setShowFontDropdown(false);
      }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (!isDragging.current || !selectedLayerId) return;
      const touch = e.touches[0];
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (e.cancelable) e.preventDefault(); // Prevent scrolling

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (touch.clientX - rect.left) * scaleX;
      const y = (touch.clientY - rect.top) * scaleY;

      const dx = x - dragStart.current.x;
      const dy = y - dragStart.current.y;

      updateLayer(selectedLayerId, {
          x: (project.layers.find(l => l.id === selectedLayerId)?.x || 0) + dx,
          y: (project.layers.find(l => l.id === selectedLayerId)?.y || 0) + dy
      });

      dragStart.current = { x, y };
  };

  const addTextLayer = (text: string = "VIVITAG") => {
    if (!baseImage) return;
    const newLayer: Layer = {
      id: Date.now().toString() + Math.random(),
      type: LayerType.TEXT,
      content: text,
      x: baseImage.width / 2,
      y: baseImage.height / 2,
      scale: 1,
      opacity: 1,
      fontSize: baseImage.width * 0.05,
      color: '#ffffff',
      fontFamily: 'Outfit'
    };
    onUpdate({
        ...project,
        layers: [...project.layers, newLayer]
    });
    setSelectedLayerId(newLayer.id);
  };

  // Scatter Logic: Centers tags in grid cells with controlled jitter for even distribution
  const scatterTags = (count: number) => {
      if (!baseImage) return;

      const templateLayer = selectedLayerId 
          ? project.layers.find(l => l.id === selectedLayerId) 
          : null;

      const text = templateLayer ? (templateLayer.content as string) : '@SeuCanal';
      const color = templateLayer?.color || '#ffffff';
      const opacity = templateLayer?.opacity || 0.5;
      const fontSize = templateLayer?.fontSize || baseImage.width * 0.05;
      const fontFamily = templateLayer?.fontFamily || 'Outfit';

      const newLayers: Layer[] = [];
      
      const aspectRatio = baseImage.width / baseImage.height;
      
      // Calculate optimized grid
      // Force at least 2 columns if count >= 4 to avoid vertical stacking in portrait
      let cols = Math.round(Math.sqrt(count * aspectRatio));
      if (cols < 2 && count >= 4) cols = 2;
      
      // Calculate rows to ensure we have enough cells
      const rows = Math.ceil(count / cols);
      
      const cellWidth = baseImage.width / cols;
      const cellHeight = baseImage.height / rows;

      // Generate all cell indices
      const cells = [];
      for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
              cells.push({ r, c });
          }
      }
      
      // Shuffle cells for random placement order
      for (let i = cells.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [cells[i], cells[j]] = [cells[j], cells[i]];
      }

      // Fill the cells
      for (let i = 0; i < count; i++) {
          const { r, c } = cells[i % cells.length];
          
          // Position: Center of cell + Jitter
          // Jitter allows movement up to 25% of cell size in any direction from center
          // This keeps it well within the cell but not robotic
          const jitterX = (Math.random() - 0.5) * cellWidth * 0.5;
          const jitterY = (Math.random() - 0.5) * cellHeight * 0.5;

          const x = (c * cellWidth) + (cellWidth / 2) + jitterX;
          const y = (r * cellHeight) + (cellHeight / 2) + jitterY;

          newLayers.push({
              id: Date.now().toString() + Math.random() + i,
              type: LayerType.TEXT,
              content: text,
              x: x,
              y: y,
              scale: 1,
              opacity: opacity,
              color: color,
              fontSize: fontSize,
              fontFamily: fontFamily
          });
      }

      onUpdate({
          ...project,
          layers: [...project.layers, ...newLayers]
      });
  };

  const clearLayers = () => {
      onUpdate({ ...project, layers: [] });
      setSelectedLayerId(null);
  };

  const updateLayer = (id: string, updates: Partial<Layer>) => {
    const newLayers = project.layers.map(l => l.id === id ? { ...l, ...updates } : l);
    onUpdate({ ...project, layers: newLayers });
  };

  const removeLayer = (id: string) => {
    const newLayers = project.layers.filter(l => l.id !== id);
    onUpdate({ ...project, layers: newLayers });
    if (selectedLayerId === id) setSelectedLayerId(null);
  };

  const downloadImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `tagged-${project.file.name.split('.')[0]}.jpg`; 
    link.href = canvas.toDataURL('image/jpeg', 1.0); 
    link.click();
  };

  const selectedLayer = project.layers.find(l => l.id === selectedLayerId);

  return (
    <div className="flex flex-col lg:flex-row lg:h-full gap-4 lg:gap-6">
      {/* Canvas Area */}
      <div className="w-full lg:flex-1 relative shrink-0 min-h-[50vh] lg:min-h-auto">
         {/* Content */}
         <div className="w-full h-full glass-panel rounded-2xl flex items-center justify-center p-2 md:p-8 relative m-[1px]">
             <div className="relative max-w-full max-h-full overflow-auto shadow-2xl border border-black/50 rounded flex items-center justify-center">
                <canvas 
                    ref={canvasRef} 
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleMouseUp}
                    className="max-w-full h-auto cursor-crosshair touch-none select-none"
                    style={{ maxHeight: '70vh' }}
                />
             </div>
         </div>
      </div>

      {/* Controls Sidebar */}
      <div className="w-full lg:w-96 flex flex-col gap-5 glass-panel p-4 md:p-6 rounded-2xl h-fit lg:max-h-[85vh] overflow-y-auto scrollbar-thin">
        
        {/* Actions */}
        <div className="grid grid-cols-1 gap-3">
            <button 
                onClick={() => addTextLayer()} 
                className="flex items-center justify-center gap-2 bg-vip-border hover:bg-white/10 p-3 rounded-xl transition-all font-bold text-sm text-white border border-white/5">
                <Plus size={18} className="text-vip-green" /> Add Tag
            </button>
        </div>

        {/* Scatter Tags Section */}
        <div className="bg-vip-black/50 p-3 rounded-xl border border-vip-border/50">
             <div className="flex items-center justify-between mb-2">
                 <label className="text-[10px] text-vip-gray uppercase font-bold flex items-center gap-1">
                     <Grid3X3 size={12}/> Multi-Tags (Dispersão)
                 </label>
                 <button 
                     onClick={clearLayers}
                     className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline">
                     <RotateCcw size={10} /> Limpar
                 </button>
             </div>
             <div className="grid grid-cols-4 gap-2">
                 {[5, 10, 15, 20].map(count => (
                     <button
                        key={count}
                        onClick={() => scatterTags(count)}
                        className="py-2 bg-vip-border hover:bg-vip-green hover:text-black rounded-lg text-xs font-bold transition-all border border-white/5"
                     >
                         {count}x
                     </button>
                 ))}
             </div>
             <p className="text-[10px] text-gray-500 mt-2 text-center">
                 Distribui {selectedLayer ? 'cópias da tag selecionada' : 'tags padrão'} uniformemente por toda a imagem.
             </p>
        </div>

        <button 
            onClick={onApplyAll}
            className="flex items-center justify-center gap-2 bg-transparent hover:bg-vip-border/50 p-2 rounded-lg transition-colors font-semibold text-xs text-vip-gray border border-vip-border border-dashed">
            <Copy size={14} /> Replicar para todas as fotos
        </button>

        <div className="h-px bg-vip-border my-1"></div>

        {/* Layers List */}
        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
            <div className="flex items-center gap-2 text-vip-gray text-xs font-bold uppercase tracking-widest mb-1 px-1">
                <Layers size={12} /> Camadas ({project.layers.length})
            </div>
            {project.layers.map(layer => (
                <div 
                    key={layer.id}
                    onClick={() => setSelectedLayerId(layer.id)}
                    className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all border ${
                        selectedLayerId === layer.id 
                        ? 'bg-vip-green/10 border-vip-green text-white' 
                        : 'bg-vip-black border-vip-border text-gray-400 hover:bg-vip-border/30'
                    }`}
                >
                    <div className="flex items-center gap-3 overflow-hidden">
                        <TypeIcon size={16} className={`flex-shrink-0 ${selectedLayerId === layer.id ? 'text-vip-green' : 'text-gray-500'}`} />
                        <span className="truncate text-sm font-medium" style={{ fontFamily: layer.fontFamily || 'Outfit' }}>
                            {layer.content as string}
                        </span>
                    </div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
                        className="text-gray-500 hover:text-red-400 p-1 transition-colors">
                        <Trash2 size={14} />
                    </button>
                </div>
            ))}
        </div>

        {/* Selected Layer Properties */}
        {selectedLayer ? (
            <div className="flex flex-col gap-4 mt-2 animate-fadeIn bg-vip-black p-4 rounded-xl border border-vip-border/50">
                 <div className="space-y-4">
                    <div className="relative">
                        <label className="text-[10px] text-vip-gray uppercase font-bold absolute -top-2 left-2 bg-vip-black px-1">Texto</label>
                        <input 
                            type="text" 
                            value={selectedLayer.content as string}
                            onChange={(e) => updateLayer(selectedLayer.id, { content: e.target.value })}
                            className="w-full bg-vip-dark border border-vip-border rounded-lg p-3 text-sm focus:border-vip-green focus:outline-none focus:ring-1 focus:ring-vip-green/50 transition-all text-white"
                        />
                    </div>

                    <div className={`relative ${showFontDropdown ? 'z-50' : 'z-0'}`}>
                        <label className="text-[10px] text-vip-gray uppercase font-bold absolute -top-2 left-2 bg-vip-black px-1 flex items-center gap-1">
                            <TypeIcon size={10} /> Fonte
                        </label>
                        <button
                            onClick={() => setShowFontDropdown(!showFontDropdown)}
                            className="w-full bg-vip-dark border border-vip-border rounded-lg p-3 text-sm flex items-center justify-between text-white focus:border-vip-green focus:outline-none"
                        >
                            <span style={{ fontFamily: selectedLayer.fontFamily || 'Outfit' }}>
                                {FONTS.find(f => f.value === (selectedLayer.fontFamily || 'Outfit'))?.name}
                            </span>
                            <ChevronDown size={16} className={`transition-transform ${showFontDropdown ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {showFontDropdown && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-vip-dark border border-vip-border rounded-lg shadow-xl z-50 overflow-hidden">
                                {FONTS.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => {
                                            updateLayer(selectedLayer.id, { fontFamily: f.value });
                                            setShowFontDropdown(false);
                                        }}
                                        className="w-full text-left p-3 hover:bg-vip-green/10 hover:text-vip-green transition-colors text-white border-b border-white/5 last:border-0"
                                        style={{ fontFamily: f.value }}
                                    >
                                        {f.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-3 items-center">
                        <input 
                            type="color" 
                            value={selectedLayer.color}
                            onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                            className="h-10 w-12 bg-vip-dark border border-vip-border rounded cursor-pointer p-1"
                        />
                        <div className="flex-1">
                            <div className="flex justify-between text-xs text-vip-gray mb-1">
                                <span>Tamanho</span>
                                <span>{Math.round(selectedLayer.fontSize || 0)}px</span>
                            </div>
                            <input 
                                type="range" 
                                min="10" 
                                max="300" 
                                value={selectedLayer.fontSize} 
                                onChange={(e) => updateLayer(selectedLayer.id, { fontSize: Number(e.target.value) })}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex justify-between text-xs text-vip-gray mb-1">
                            <span>Opacidade</span>
                            <span>{Math.round(selectedLayer.opacity * 100)}%</span>
                        </div>
                        <input 
                            type="range" 
                            min="0.1" 
                            max="1" 
                            step="0.05"
                            value={selectedLayer.opacity} 
                            onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                            className="w-full"
                        />
                    </div>
                 </div>
            </div>
        ) : (
            <div className="flex-1 flex items-center justify-center text-vip-gray text-xs text-center p-4 border border-dashed border-vip-border rounded-xl">
                Clique na tag da imagem ou na lista para editar.
            </div>
        )}

        <button 
            onClick={downloadImage}
            disabled={!baseImage}
            className="mt-auto w-full flex items-center justify-center gap-2 glass-btn-green p-4 font-bold transition-all z-10">
            <Download size={20} /> BAIXAR JPG
        </button>

      </div>
    </div>
  );
};

export default PhotoEditor;
