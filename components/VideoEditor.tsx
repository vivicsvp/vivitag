
import React, { useRef, useEffect, useState } from 'react';
import { Play, Square, Video, Settings2, Copy, EyeOff, Type, Plus, Trash2, Layers, ChevronDown, Send, Loader2, Grid3X3, RotateCcw, Zap } from 'lucide-react';
import { Project, VideoConfig, VideoTag } from '../types';

interface VideoEditorProps {
  project: Project;
  onUpdate: (updatedProject: Project) => void;
  onApplyAll: () => void;
  onApplyPresetAll: () => void;
  isAutoProcessing?: boolean;
  onAutoProcessDone?: () => void;
}

const FONTS = [
    { name: 'Padrão (Outfit)', value: 'Outfit' },
    { name: 'Manual (Playwrite)', value: 'Playwrite US Trad' },
    { name: 'Moderno (Montserrat)', value: 'Montserrat' },
];

interface PhysicsState {
    x: number;
    y: number;
    vx: number;
    vy: number;
}

const VideoEditor: React.FC<VideoEditorProps> = ({ 
    project, 
    onUpdate, 
    onApplyAll, 
    onApplyPresetAll, 
    isAutoProcessing = false, 
    onAutoProcessDone 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  
  // FIX: Use a ref to access the latest project state inside the animation loop
  const projectRef = useRef(project);
  useEffect(() => {
      projectRef.current = project;
  }, [project]);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeTab, setActiveTab] = useState<'visual' | 'effects'>('visual');
  const [selectedTagId, setSelectedTagId] = useState<string | null>(null);
  const [showFontDropdown, setShowFontDropdown] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  
  // Physics state map: TagID -> Physics Properties
  const physicsRef = useRef<Map<string, PhysicsState>>(new Map());

  // Use config from current prop for UI rendering, but ref for loop
  const { videoConfig } = project;

  // Initialize selected tag
  useEffect(() => {
      if (videoConfig.tags.length > 0 && !selectedTagId) {
          setSelectedTagId(videoConfig.tags[0].id);
      }
  }, [videoConfig.tags]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.src = URL.createObjectURL(project.file);
      video.load();
      video.onloadedmetadata = () => {
          setDuration(video.duration);
          // If trimEnd is not set or invalid, set to full duration
          if (videoConfig.trimEnd === 0 || videoConfig.trimEnd > video.duration) {
              updateConfig({ trimEnd: video.duration });
          }
      };
    }
    return () => {
        if (video && video.src) URL.revokeObjectURL(video.src);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [project.file]);

  // --- Auto Processing Trigger ---
  useEffect(() => {
      // Small delay to ensure video loaded metadata
      if (isAutoProcessing && !isRecording && !isProcessing && duration > 0) {
          const timer = setTimeout(() => {
              console.log("Auto starting recording for", project.file.name);
              startRecording();
          }, 500);
          return () => clearTimeout(timer);
      }
  }, [isAutoProcessing, duration]); // Depend on duration to ensure video is ready

  const updateConfig = (updates: Partial<VideoConfig>) => {
      onUpdate({
          ...project,
          videoConfig: { ...project.videoConfig, ...updates }
      });
  };

  const updateTag = (id: string, updates: Partial<VideoTag>) => {
      const newTags = videoConfig.tags.map(t => t.id === id ? { ...t, ...updates } : t);
      updateConfig({ tags: newTags });
      
      // Update physics velocity if speed changed
      if (updates.speed !== undefined) {
          const state = physicsRef.current.get(id);
          if (state) {
              const currentSpeed = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
              if (currentSpeed === 0) {
                   state.vx = updates.speed;
                   state.vy = updates.speed;
              } else {
                  state.vx = (state.vx / currentSpeed) * updates.speed;
                  state.vy = (state.vy / currentSpeed) * updates.speed;
              }
          }
      }
  };

  const addTag = () => {
      const newTag: VideoTag = {
          id: Date.now().toString(),
          text: '@NovaTag',
          color: '#ffffff',
          fontSize: 40,
          fontFamily: 'Outfit',
          speed: 3,
          opacity: 0.8
      };
      updateConfig({ tags: [...videoConfig.tags, newTag] });
      setSelectedTagId(newTag.id);
  };

  const addPresetTag = () => {
      const newTag: VideoTag = {
          id: Date.now().toString(),
          text: '@SeuCanal',
          color: '#ffffff',
          fontSize: 35,
          fontFamily: 'Montserrat',
          speed: 4,
          opacity: 0.8
      };
      updateConfig({ tags: [...videoConfig.tags, newTag] });
      setSelectedTagId(newTag.id);
  };

  const scatterTags = (count: number) => {
      const video = videoRef.current;
      if (!video) return;
      
      // Template from current selection or default
      const templateTag = selectedTagId 
        ? videoConfig.tags.find(t => t.id === selectedTagId) 
        : (videoConfig.tags.length > 0 ? videoConfig.tags[0] : null);

      const text = templateTag ? templateTag.text : '@NovaTag';
      const color = templateTag?.color || '#ffffff';
      const fontSize = templateTag?.fontSize || 40;
      const fontFamily = templateTag?.fontFamily || 'Outfit';
      const speed = templateTag?.speed || 3;
      const opacity = templateTag?.opacity || 0.8;

      const newTags: VideoTag[] = [];
      
      for(let i=0; i<count; i++) {
          newTags.push({
              id: Date.now().toString() + Math.random() + i,
              text,
              color,
              fontSize,
              fontFamily,
              speed,
              opacity
          });
      }
      
      // Update config - REPLACE existing for clean slate
      updateConfig({ tags: newTags });
      
      // Reset physics
      physicsRef.current.clear();
      if(newTags.length > 0) setSelectedTagId(newTags[0].id);
  };

  const removeTag = (id: string) => {
      const newTags = videoConfig.tags.filter(t => t.id !== id);
      updateConfig({ tags: newTags });
      physicsRef.current.delete(id);
      if (selectedTagId === id) {
          setSelectedTagId(newTags[0]?.id || null);
          setShowFontDropdown(false);
      }
  };

  const clearTags = () => {
      updateConfig({ tags: [] });
      physicsRef.current.clear();
      setSelectedTagId(null);
  };

  const renderFrame = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    // Always use the LATEST config from ref
    const currentConfig = projectRef.current.videoConfig;
    
    if (canvas && video && !video.paused && !video.ended) {
      
      // Handle Trim Loop only when NOT recording
      if (!isRecording) {
         if (video.currentTime >= currentConfig.trimEnd) {
             video.currentTime = currentConfig.trimStart;
         }
      }

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.save();
        
        if (currentConfig.blurLevel > 0) {
            ctx.filter = `blur(${currentConfig.blurLevel}px)`;
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        // Process Tags Physics and Rendering
        currentConfig.tags.forEach(tag => {
            let state = physicsRef.current.get(tag.id);
            
            // Initialize physics if missing
            if (!state) {
                state = {
                    x: Math.random() * (canvas.width - 100),
                    y: Math.random() * (canvas.height - 50) + 50,
                    vx: (Math.random() > 0.5 ? 1 : -1) * tag.speed,
                    vy: (Math.random() > 0.5 ? 1 : -1) * tag.speed
                };
                physicsRef.current.set(tag.id, state);
            }

            // Update Physics
            state.x += state.vx;
            state.y += state.vy;

            // Measure Text
            ctx.font = `bold ${tag.fontSize}px "${tag.fontFamily}", sans-serif`;
            const metrics = ctx.measureText(tag.text);
            const textWidth = metrics.width;
            const textHeight = tag.fontSize;

            // Bounce Logic
            if (state.x + textWidth > canvas.width) {
                state.x = canvas.width - textWidth;
                state.vx = -Math.abs(state.vx);
            } else if (state.x < 0) {
                state.x = 0;
                state.vx = Math.abs(state.vx);
            }

            if (state.y > canvas.height) {
                state.y = canvas.height;
                state.vy = -Math.abs(state.vy);
            } else if (state.y < textHeight) {
                state.y = textHeight;
                state.vy = Math.abs(state.vy);
            }

            // Render Text
            ctx.save();
            ctx.globalAlpha = tag.opacity;
            ctx.font = `bold ${tag.fontSize}px "${tag.fontFamily}", sans-serif`;
            ctx.fillStyle = tag.color;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(tag.text, state.x, state.y);
            ctx.restore();
        });
      }
      requestRef.current = requestAnimationFrame(renderFrame);
    }
  };

  const handlePlay = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const currentConfig = projectRef.current.videoConfig;
      
      if (!isRecording && (video.currentTime < currentConfig.trimStart || video.currentTime >= currentConfig.trimEnd)) {
          video.currentTime = currentConfig.trimStart;
      }
      
      const playPromise = video.play();
      if (playPromise !== undefined) {
          playPromise.catch(() => {});
      }
      renderFrame();
    }
  };

  const handlePause = () => {
    videoRef.current?.pause();
    if (requestRef.current) cancelAnimationFrame(requestRef.current);
  };

  const startRecording = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Reset Physics for a clean start
    physicsRef.current.clear();
    
    chunksRef.current = [];
    
    // Set Initial Time carefully
    video.currentTime = videoConfig.trimStart;
    
    // Audio setup
    const stream = canvas.captureStream(30);
    const audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    try {
        // Create source only once or handle potential errors if it exists
        // Ideally we keep audio context persistent, but for simplicity we recreate/connect here.
        // If element source already connected, this might throw, so we wrap in try/catch or assume success
        const source = audioCtx.createMediaElementSource(video);
        source.connect(dest);
        const audioTrack = dest.stream.getAudioTracks()[0];
        if (audioTrack) stream.addTrack(audioTrack);
    } catch (e) {
        // Source already connected, which is fine
    }

    // Prepare Recorder
    // PRIORITIZE AAC (mp4a.40.2) to avoid Opus when using MP4
    const mimeTypesToTry = [
        'video/mp4;codecs=avc1,mp4a.40.2', // H.264 + AAC (Standard MP4)
        'video/mp4;codecs=h264,aac',       // Alt AAC syntax
        'video/mp4;codecs=avc1,opus',      // Fallback to Opus only if AAC fails
        'video/mp4',                       // Generic MP4
        'video/webm;codecs=vp9,opus',      // WebM Fallback
        'video/webm'
    ];
    
    let mediaRecorder: MediaRecorder | null = null;
    let selectedMimeType = '';

    for (const type of mimeTypesToTry) {
        if (MediaRecorder.isTypeSupported(type)) {
            // Request High Quality Audio (192kbps) to ensure clarity even if re-encoding happens
            mediaRecorder = new MediaRecorder(stream, { 
                mimeType: type, 
                videoBitsPerSecond: 25000000,
                audioBitsPerSecond: 192000 // 192kbps AAC/Opus
            });
            selectedMimeType = type;
            console.log("Selected MimeType:", type);
            break;
        }
    }
    // Final fallback
    if (!mediaRecorder) mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      setIsProcessing(true);
      
      // Stop physics/rendering loop
      handlePause();

      const isMp4 = selectedMimeType.includes('mp4');
      const blob = new Blob(chunksRef.current, { type: isMp4 ? 'video/mp4' : 'video/webm' });
      
      const fileName = `vivitag-clip-${project.file.name.split('.')[0]}.${isMp4 ? 'mp4' : 'webm'}`;
      const file = new File([blob], fileName, { type: isMp4 ? 'video/mp4' : 'video/webm' });

      // Tentar Compartilhamento Nativo (iOS/Android)
      let shareSuccess = false;
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
              await navigator.share({
                  files: [file],
                  title: 'Vivitag Vídeo',
                  text: 'Seu vídeo editado!'
              });
              shareSuccess = true;
          } catch (e) {
              console.log("Share cancelado", e);
          }
      }

      if (!shareSuccess) {
           // Fallback
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
      }
      
      setIsRecording(false);
      setIsProcessing(false);
      setProgress(0);

      // Trigger callback if auto processing
      if (isAutoProcessing && onAutoProcessDone) {
          // Add small delay to let browser finish saving UI logic
          setTimeout(() => {
              onAutoProcessDone();
          }, 1000);
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
    setProgress(0);
    
    // Play video to capture frames
    video.play().catch(()=>{});
    renderFrame();
    
    // Monitoring Loop for Stop Condition
    const expectedDuration = videoConfig.trimEnd - videoConfig.trimStart;
    
    const monitorInterval = setInterval(() => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            clearInterval(monitorInterval);
            return;
        }
        
        const currentProgress = video.currentTime - videoConfig.trimStart;
        const percent = Math.min(100, Math.max(0, (currentProgress / expectedDuration) * 100));
        setProgress(percent);

        // Precise Stop Condition
        // We add a small buffer (0.1s) to ensure we don't cut off the very last frame too early
        if (video.currentTime >= videoConfig.trimEnd || video.ended) {
            mediaRecorder.stop();
            clearInterval(monitorInterval);
        }
    }, 50);

    // Safety Timeout: Force stop if it exceeds duration + 2 seconds (handles desync)
    setTimeout(() => {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            console.warn("Safety timeout triggered for video recording");
            mediaRecorder.stop();
        }
    }, (expectedDuration * 1000) + 2000);
  };

  const selectedTag = videoConfig.tags.find(t => t.id === selectedTagId);

  return (
    <div className="flex flex-col lg:flex-row lg:h-full gap-6">
      {/* Canvas / Video Area */}
      <div className="w-full lg:flex-1 relative flex-shrink-0 lg:flex-shrink flex-grow min-h-[300px]">
         {/* Content */}
         <div className="w-full h-full glass-panel rounded-2xl flex items-center justify-center p-4 relative m-[1px] min-h-[300px]">
            {/* IMPORTANT: Video must NOT be display:none for captureStream to work reliably on some browsers. 
                We use opacity-0 and pointer-events-none to hide it visually but keep it rendering. */}
            <video 
                ref={videoRef} 
                className="absolute w-1 h-1 opacity-0 pointer-events-none" 
                muted={false} 
                crossOrigin="anonymous" 
                playsInline
            />
            
            <canvas ref={canvasRef} className="max-w-full max-h-[50vh] lg:max-h-[70vh] shadow-xl rounded-lg border border-black" />

            {!videoRef.current?.src && (
                <div className="text-vip-gray flex flex-col items-center animate-pulse py-12 absolute inset-0 justify-center">
                    <Video size={48} className="mb-2 opacity-30"/>
                    <span className="text-sm font-medium tracking-wide">Carregando vídeo...</span>
                </div>
            )}

            {/* Recording Overlay */}
            {(isRecording || isProcessing) && (
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center z-50 rounded-2xl animate-fadeIn">
                    <div className="w-16 h-16 relative mb-4">
                        <div className="absolute inset-0 rounded-full border-4 border-vip-border"></div>
                        <div className="absolute inset-0 rounded-full border-4 border-vip-neon border-t-transparent animate-spin"></div>
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1">
                        {isProcessing ? "Finalizando..." : "Processando Vídeo"}
                    </h3>
                    <p className="text-vip-gray text-xs max-w-[200px] text-center">
                        {isProcessing 
                            ? "Preparando arquivo para envio..." 
                            : `Não feche esta tela.\n${Math.round(progress)}% concluído`}
                        {isAutoProcessing && <br/>}
                        {isAutoProcessing && <span className="text-vip-neon font-bold mt-1 block">MODO FILA AUTOMÁTICA</span>}
                    </p>
                    {!isProcessing && (
                         <div className="w-48 h-1.5 bg-vip-border rounded-full mt-3 overflow-hidden">
                             <div 
                                className="h-full bg-vip-neon transition-all duration-200 ease-linear"
                                style={{ width: `${progress}%` }}
                             />
                         </div>
                    )}
                </div>
            )}
         </div>
      </div>

      {/* Controls */}
      <div className={`w-full lg:w-96 flex-shrink-0 flex flex-col glass-panel rounded-2xl h-auto lg:h-full lg:max-h-[85vh] overflow-visible lg:overflow-hidden ${isAutoProcessing ? 'opacity-50 pointer-events-none' : ''}`}>
        
        {/* Tabs */}
        <div className="flex border-b border-vip-border bg-vip-dark/50 rounded-t-2xl">
            <button 
                onClick={() => setActiveTab('visual')}
                className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'visual' ? 'bg-vip-black text-vip-green border-b-2 border-vip-green' : 'text-vip-gray hover:text-white'}`}>
                <Settings2 size={14} /> Tags & Visual
            </button>
            <button 
                onClick={() => setActiveTab('effects')}
                className={`flex-1 p-3 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${activeTab === 'effects' ? 'bg-vip-black text-vip-green border-b-2 border-vip-green' : 'text-vip-gray hover:text-white'}`}>
                <EyeOff size={14} /> Blur & Corte
            </button>
        </div>

        {/* Scrollable controls area - On mobile, use auto height so page scrolls. On desktop, use internal scroll. */}
        <div className="p-6 space-y-5 lg:overflow-y-auto lg:max-h-[60vh] scrollbar-thin">
            
            {activeTab === 'visual' && (
                <>
                   {/* Actions Header */}
                   <div className="grid grid-cols-2 gap-3">
                        <button 
                            onClick={() => addTag()} 
                            className="flex items-center justify-center gap-2 bg-vip-border hover:bg-white/10 p-3 rounded-xl transition-all font-bold text-sm text-white border border-white/5">
                            <Plus size={18} className="text-vip-green" /> Add Tag
                        </button>
                         <button 
                            onClick={() => addPresetTag()} 
                            className="flex items-center justify-center gap-2 bg-vip-border hover:bg-white/10 p-3 rounded-xl transition-all font-bold text-xs text-white border border-white/5">
                            <Zap size={16} className="text-yellow-400" /> Preset (Atual)
                        </button>
                   </div>
                   
                   {/* Batch Preset Button */}
                   <button 
                        onClick={onApplyPresetAll}
                        className="w-full flex items-center justify-center gap-2 bg-vip-neon/20 hover:bg-vip-neon/30 text-vip-neon border border-vip-neon/50 p-3 rounded-xl transition-all font-bold text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                        <Zap size={16} fill="currentColor" /> Preset em TODOS (Lote)
                   </button>

                    {/* Scatter Tags Section - NOW ADDED TO VIDEO EDITOR */}
                    <div className="bg-vip-black/50 p-3 rounded-xl border border-vip-border/50">
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[10px] text-vip-gray uppercase font-bold flex items-center gap-1">
                                <Grid3X3 size={12}/> Multi-Tags Flutuantes
                            </label>
                            <button 
                                onClick={clearTags}
                                className="text-[10px] text-red-400 hover:text-red-300 flex items-center gap-1 hover:underline">
                                <RotateCcw size={10} /> Limpar
                            </button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                            {[2, 5, 10, 15].map(count => (
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
                            Gera tags flutuantes aleatórias.
                        </p>
                    </div>
                   
                   <div className="flex justify-between items-center mb-2 mt-4">
                       <label className="text-xs font-bold text-vip-gray uppercase flex items-center gap-1">
                           <Layers size={12}/> Tags Ativas
                       </label>
                   </div>
                   
                   <div className="flex flex-col gap-2 max-h-32 overflow-y-auto pr-1 mb-4 custom-scrollbar">
                       {videoConfig.tags.map(tag => (
                           <div 
                               key={tag.id}
                               onClick={() => setSelectedTagId(tag.id)}
                               className={`flex items-center justify-between p-2 rounded-lg cursor-pointer border ${
                                   selectedTagId === tag.id 
                                   ? 'bg-vip-green/10 border-vip-green text-white' 
                                   : 'bg-vip-black border-vip-border text-gray-400 hover:bg-vip-border/30'
                               }`}
                           >
                               <span className="truncate text-sm font-medium" style={{ fontFamily: tag.fontFamily || 'Outfit' }}>
                                   {tag.text}
                               </span>
                               <button 
                                   onClick={(e) => { e.stopPropagation(); removeTag(tag.id); }}
                                   className="text-gray-500 hover:text-red-400 p-1">
                                   <Trash2 size={12} />
                               </button>
                           </div>
                       ))}
                       {videoConfig.tags.length === 0 && (
                           <p className="text-xs text-center text-gray-500 py-2">Nenhuma tag adicionada.</p>
                       )}
                   </div>

                    {selectedTag ? (
                        <div className="animate-fadeIn space-y-4 border-t border-vip-border pt-4">
                            <div className="relative">
                                <label className="text-[10px] text-vip-gray uppercase font-bold absolute -top-2 left-2 bg-vip-dark px-1">Texto</label>
                                <input 
                                    type="text" 
                                    value={selectedTag.text}
                                    onChange={(e) => updateTag(selectedTag.id, { text: e.target.value })}
                                    className="w-full bg-vip-black border border-vip-border rounded-lg p-3 text-sm focus:border-vip-green focus:outline-none focus:ring-1 focus:ring-vip-green/50 transition-all text-white"
                                />
                            </div>

                            <div className={`relative ${showFontDropdown ? 'z-50' : 'z-0'}`}>
                                <label className="text-[10px] text-vip-gray uppercase font-bold absolute -top-2 left-2 bg-vip-dark px-1 flex items-center gap-1"><Type size={10} /> Fonte</label>
                                <button
                                    onClick={() => setShowFontDropdown(!showFontDropdown)}
                                    className="w-full bg-vip-black border border-vip-border rounded-lg p-3 text-sm flex items-center justify-between text-white focus:border-vip-green focus:outline-none"
                                >
                                    <span style={{ fontFamily: selectedTag.fontFamily || 'Outfit' }}>
                                        {FONTS.find(f => f.value === (selectedTag.fontFamily || 'Outfit'))?.name}
                                    </span>
                                    <ChevronDown size={16} className={`transition-transform ${showFontDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {showFontDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-vip-dark border border-vip-border rounded-lg shadow-xl z-50 overflow-hidden">
                                        {FONTS.map(f => (
                                            <button
                                                key={f.value}
                                                onClick={() => {
                                                    updateTag(selectedTag.id, { fontFamily: f.value });
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

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs text-vip-gray mb-1">
                                        <span>Velocidade</span>
                                        <span>{selectedTag.speed}x</span>
                                    </div>
                                    <input 
                                        type="range" min="1" max="15" step="1"
                                        value={selectedTag.speed}
                                        onChange={(e) => updateTag(selectedTag.id, { speed: Number(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="flex justify-between text-xs text-vip-gray mb-1">
                                        <span>Tamanho</span>
                                        <span>{selectedTag.fontSize}px</span>
                                    </div>
                                    <input 
                                        type="range" min="20" max="150"
                                        value={selectedTag.fontSize}
                                        onChange={(e) => updateTag(selectedTag.id, { fontSize: Number(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <div className="flex-1">
                                     <div className="flex justify-between text-xs text-vip-gray mb-1">
                                        <span>Opacidade</span>
                                        <span>{Math.round(selectedTag.opacity * 100)}%</span>
                                    </div>
                                    <input 
                                        type="range" min="0.1" max="1" step="0.1"
                                        value={selectedTag.opacity}
                                        onChange={(e) => updateTag(selectedTag.id, { opacity: Number(e.target.value) })}
                                        className="w-full"
                                    />
                                </div>
                                <div className="flex flex-col justify-end">
                                    <input 
                                        type="color" 
                                        value={selectedTag.color}
                                        onChange={(e) => updateTag(selectedTag.id, { color: e.target.value })}
                                        className="h-8 w-12 bg-transparent border border-vip-border rounded cursor-pointer"
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center p-4 border border-dashed border-vip-border rounded-lg text-gray-500 text-xs">
                            Selecione uma tag para editar ou crie uma nova.
                        </div>
                    )}
                </>
            )}

            {activeTab === 'effects' && (
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-xs text-vip-gray mb-1">
                            <span className="flex items-center gap-1"><EyeOff size={12}/> Blur Total (Fundo)</span>
                            <span>{videoConfig.blurLevel}px</span>
                        </div>
                        <input 
                            type="range" min="0" max="20" step="1"
                            value={videoConfig.blurLevel}
                            onChange={(e) => updateConfig({ blurLevel: Number(e.target.value) })}
                            className="w-full"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Aplica desfoque em todo o vídeo, útil para usar como fundo de stories.</p>
                    </div>

                    <div className="border-t border-vip-border pt-4">
                        <h3 className="text-xs font-bold text-white mb-4 uppercase">Corte do Vídeo</h3>
                        
                        <div>
                            <div className="flex justify-between text-xs text-vip-gray mb-1">
                                <span>Início</span>
                                <span>{videoConfig.trimStart.toFixed(1)}s</span>
                            </div>
                            <input 
                                type="range" min="0" max={duration} step="0.1"
                                value={videoConfig.trimStart}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val < videoConfig.trimEnd) updateConfig({ trimStart: val });
                                }}
                                className="w-full"
                            />
                        </div>

                        <div className="mt-4">
                            <div className="flex justify-between text-xs text-vip-gray mb-1">
                                <span>Fim</span>
                                <span>{videoConfig.trimEnd.toFixed(1)}s</span>
                            </div>
                            <input 
                                type="range" min="0" max={duration} step="0.1"
                                value={videoConfig.trimEnd}
                                onChange={(e) => {
                                    const val = Number(e.target.value);
                                    if (val > videoConfig.trimStart) updateConfig({ trimEnd: val });
                                }}
                                className="w-full"
                            />
                        </div>
                        
                        <div className="mt-2 bg-vip-black p-2 rounded border border-vip-border text-center">
                             <span className="text-xs text-gray-400">Duração: </span>
                             <span className="text-vip-green font-bold text-sm">{(videoConfig.trimEnd - videoConfig.trimStart).toFixed(1)}s</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
        
        {/* Footer Actions */}
        <div className="p-4 border-t border-vip-border mt-auto bg-vip-dark rounded-b-2xl">
            <button 
                onClick={onApplyAll}
                className="w-full flex items-center justify-center gap-2 bg-transparent hover:bg-vip-border/50 p-2 rounded-lg transition-colors font-semibold text-xs text-vip-gray border border-vip-border border-dashed mb-3">
                <Copy size={14} /> Replicar Config (Manual) para TODOS
            </button>

            <div className="grid grid-cols-2 gap-3 mb-3">
                <button 
                    onClick={handlePlay}
                    disabled={isRecording}
                    className="flex items-center justify-center gap-2 bg-vip-border hover:bg-white/10 p-3 rounded-xl transition-colors font-bold text-sm text-white border border-white/5">
                    <Play size={16} className="text-vip-green"/> Preview
                </button>
                <button 
                    onClick={handlePause}
                    className="flex items-center justify-center gap-2 bg-vip-border hover:bg-white/10 p-3 rounded-xl transition-colors font-bold text-sm text-white border border-white/5">
                    <Square size={16} /> Pause
                </button>
            </div>

            <button 
                onClick={isRecording ? () => mediaRecorderRef.current?.stop() : startRecording}
                disabled={isProcessing}
                className={`w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold transition-all z-10 
                    ${isRecording 
                        ? 'bg-vip-red hover:bg-red-500 animate-pulse shadow-red-900/50' 
                        : isProcessing 
                            ? 'opacity-50 cursor-wait bg-vip-border'
                            : 'glass-btn-green'}`}
            >
                {isRecording ? (
                    <> <Square size={20} fill="currentColor" /> PARAR GRAVAÇÃO </>
                ) : isProcessing ? (
                    <>
                         <Loader2 size={20} className="animate-spin" /> PROCESSANDO...
                    </>
                ) : (
                    <> <Send size={20} /> GRAVAR E ENVIAR </>
                )}
            </button>
        </div>

      </div>
    </div>
  );
};

export default VideoEditor;
