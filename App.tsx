
import React, { useState, useEffect } from 'react';
import { Upload, Image as ImageIcon, Video as VideoIcon, X, Plus, Home, KeyRound, ArrowRight, Loader2, Send, Copy, PlayCircle } from 'lucide-react';
import PhotoEditor from './components/PhotoEditor';
import VideoEditor from './components/VideoEditor';
import { AppMode, Project, LayerType, VideoTag } from './types';

// SENHA DE ACESSO: Agora pega da Vercel (Environment Variable) ou usa um fallback seguro
const ACCESS_KEY = process.env.APP_PASSWORD || "vivivip";

const App: React.FC = () => {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Batch Processing State
  const [batchQueueIndex, setBatchQueueIndex] = useState<number | null>(null);

  const [projects, setProjects] = useState<Project[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    // 1. Check URL Parameter (Magic Link)
    const searchParams = new URLSearchParams(window.location.search);
    const urlKey = searchParams.get('key');

    // 2. Check Local Storage
    const storedAuth = localStorage.getItem('vivitag_auth');

    if (urlKey === ACCESS_KEY || storedAuth === 'true') {
        setIsAuthorized(true);
        if (urlKey) {
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            localStorage.setItem('vivitag_auth', 'true');
        }
    }

    // Telegram Setup
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      tg.ready();
      tg.expand(); 
      try {
        tg.setHeaderColor('#09090b');
        tg.setBackgroundColor('#09090b');
      } catch (e) {
        console.log("Header color not supported");
      }
    }
  }, []);

  // Helper for confirmations that works in both Web and Telegram App
  const showConfirm = (message: string): Promise<boolean> => {
      return new Promise((resolve) => {
          const tg = window.Telegram?.WebApp;
          // Check for Telegram WebApp environment and version support (showPopup requires v6.2+)
          if (tg && tg.showPopup && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
              try {
                  tg.showPopup({
                      message: message,
                      buttons: [
                          { id: 'cancel', type: 'cancel', text: 'Cancelar' },
                          { id: 'ok', type: 'ok', text: 'Confirmar' }
                      ]
                  }, (buttonId) => {
                      resolve(buttonId === 'ok');
                  });
              } catch (e) {
                  console.warn("Telegram showPopup failed, falling back to window.confirm", e);
                  resolve(window.confirm(message));
              }
          } else {
              // Fallback for standard web or older Telegram versions
              resolve(window.confirm(message));
          }
      });
  };

  const handleLogin = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (passwordInput === ACCESS_KEY) {
          setIsAuthorized(true);
          localStorage.setItem('vivitag_auth', 'true');
          setAuthError(false);
      } else {
          setAuthError(true);
          // Shake effect logic could go here
      }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles: File[] = Array.from(e.target.files);
      
      const newProjects: Project[] = newFiles.map(file => {
          const isVideo = file.type.startsWith('video/');
          return {
              id: Date.now().toString() + Math.random(),
              file: file,
              type: isVideo ? AppMode.VIDEO : AppMode.PHOTO,
              // Videos are initialized immediately with tags. Photos wait for PhotoEditor to measure image size.
              initialized: isVideo ? true : false,
              layers: [],
              videoConfig: { 
                  tags: isVideo ? [{
                      id: 'default-tag-' + Math.random(),
                      text: '@SeuCanal',
                      color: '#ffffff',
                      fontSize: 35,
                      fontFamily: 'Montserrat',
                      speed: 4,
                      opacity: 0.8
                  }] : [],
                  blurLevel: 0,
                  trimStart: 0,
                  trimEnd: 0, // 0 means full duration
              }
          };
      });

      setProjects(prev => [...prev, ...newProjects]);
    }
  };

  const updateProject = (updatedProject: Project) => {
      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };

  const removeProject = (index: number) => {
    setProjects(prev => {
        const newProj = prev.filter((_, i) => i !== index);
        if (activeIndex >= newProj.length && newProj.length > 0) {
            setActiveIndex(newProj.length - 1);
        } else if (newProj.length === 0) {
            setActiveIndex(0);
        }
        return newProj;
    });
  };

  const handleReset = async (e?: React.MouseEvent) => {
    if (e && e.preventDefault) e.preventDefault();
    
    // Check if there are projects to reset
    if (projects.length === 0) return;

    const confirmed = await showConfirm("Voltar ao início? Seus projetos atuais serão fechados.");
    if (confirmed) {
        setProjects([]);
        setActiveIndex(0);
        setBatchQueueIndex(null);
    }
  };

  // --- REPLICATION LOGIC ---
  const applySettingsToAll = () => {
      const current = projects[activeIndex];
      if (!current) return;

      const confirmed = window.confirm(`Deseja aplicar a edição da mídia atual (${current.file.name}) em todos os outros arquivos do mesmo tipo?`);
      if (!confirmed) return;

      const updatedProjects = projects.map(p => {
          if (p.type === current.type) {
              if (current.type === AppMode.PHOTO) {
                  // Generate new IDs for layers to avoid reference conflicts
                  const newLayers = current.layers.map(l => ({...l, id: Math.random().toString(36).substr(2, 9)}));
                  return { 
                      ...p, 
                      layers: newLayers,
                      initialized: true 
                  };
              } else {
                  // Generate new IDs for video tags
                  const newTags = current.videoConfig.tags.map(t => ({...t, id: Math.random().toString(36).substr(2, 9)}));
                  return { 
                      ...p, 
                      videoConfig: { 
                          ...current.videoConfig, 
                          tags: newTags, // Fully replaced tags with new IDs
                          blurLevel: current.videoConfig.blurLevel
                          // Note: We do NOT copy trim times as videos have different lengths
                      },
                      initialized: true
                  };
              }
          }
          return p;
      });
      setProjects(updatedProjects);
      
      const tg = window.Telegram?.WebApp;
      if (tg && tg.showPopup && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
          tg.showPopup({
              title: 'Sucesso',
              message: `Configurações replicadas para ${updatedProjects.filter(p => p.type === current.type).length - 1} outros arquivos!`,
              buttons: [{type: 'ok'}]
          });
      }
  };

  // --- BATCH PROCESSING QUEUE ---
  const startBatchProcessing = async () => {
      const videos = projects.filter(p => p.type === AppMode.VIDEO);
      if (videos.length === 0) return;

      const confirmed = await showConfirm(`Iniciar processamento em fila de ${videos.length} vídeos?\n\nO app processará um por um automaticamente.`);
      if (!confirmed) return;

      // Find index of first video
      const firstVideoIndex = projects.findIndex(p => p.type === AppMode.VIDEO);
      if (firstVideoIndex !== -1) {
          setActiveIndex(firstVideoIndex);
          setBatchQueueIndex(firstVideoIndex);
      }
  };

  const handleBatchVideoComplete = () => {
      if (batchQueueIndex === null) return;

      // Find next video index
      let nextIndex = -1;
      for (let i = batchQueueIndex + 1; i < projects.length; i++) {
          if (projects[i].type === AppMode.VIDEO) {
              nextIndex = i;
              break;
          }
      }

      if (nextIndex !== -1) {
          // Add a small delay to ensure UI updates before starting next
          setTimeout(() => {
              setActiveIndex(nextIndex);
              setBatchQueueIndex(nextIndex);
          }, 1000);
      } else {
          // Queue finished
          setBatchQueueIndex(null);
          const tg = window.Telegram?.WebApp;
          if (tg && tg.showPopup && tg.isVersionAtLeast && tg.isVersionAtLeast('6.2')) {
              tg.showPopup({
                  title: 'Fila Concluída',
                  message: 'Todos os vídeos foram processados!',
                  buttons: [{type: 'ok'}]
              });
          } else {
              alert("Fila concluída!");
          }
      }
  };

  const applyPresetToAllVideos = () => {
      const videoCount = projects.filter(p => p.type === AppMode.VIDEO).length;
      if (videoCount === 0) return;

      const confirmed = window.confirm(`Aplicar "Preset Montserrat 35px" em todos os ${videoCount} vídeos de uma vez? \nIsso substituirá as tags atuais.`);
      if (!confirmed) return;

      const updatedProjects = projects.map(p => {
          if (p.type === AppMode.VIDEO) {
             const newTag: VideoTag = {
                  id: Math.random().toString(36).substr(2, 9),
                  text: '@SeuCanal',
                  color: '#ffffff',
                  fontSize: 35,
                  fontFamily: 'Montserrat',
                  speed: 4,
                  opacity: 0.8
              };
              return {
                  ...p,
                  videoConfig: {
                      ...p.videoConfig,
                      tags: [newTag]
                  },
                  initialized: true
              };
          }
          return p;
      });
      setProjects(updatedProjects);
  };

  const downloadAllPhotos = async () => {
      if (isDownloading) return;
      const photoProjects = projects.filter(p => p.type === AppMode.PHOTO);
      if (photoProjects.length === 0) return;

      // Mensagem diferente para indicar que vai abrir o compartilhamento
      const confirmed = await showConfirm(`Processar ${photoProjects.length} imagens?\n\nNo celular, isso abrirá a opção 'Compartilhar' para enviar direto para o Telegram.`);
      
      if (!confirmed) return;
      
      setIsDownloading(true);
      const generatedFiles: File[] = [];
      
      try {
        // 1. Gerar todos os arquivos (Blobs) primeiro
        for (let i = 0; i < photoProjects.length; i++) {
            const proj = photoProjects[i];
            await new Promise<void>((resolve) => {
                const img = new Image();
                img.src = URL.createObjectURL(proj.file);
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0);
                        proj.layers.forEach(layer => {
                            ctx.save();
                            ctx.translate(layer.x, layer.y);
                            if (layer.rotation) ctx.rotate((layer.rotation * Math.PI) / 180);
                            ctx.globalAlpha = layer.opacity;
                            if (layer.type === LayerType.TEXT) {
                                const fontFamily = layer.fontFamily || 'Outfit';
                                ctx.font = `bold ${layer.fontSize}px "${fontFamily}", sans-serif`;
                                ctx.fillStyle = layer.color || '#ffffff';
                                ctx.textBaseline = 'middle';
                                ctx.textAlign = 'center';
                                ctx.fillText(layer.content as string, 0, 0);
                            }
                            ctx.restore();
                        });
                        
                        canvas.toBlob((blob) => {
                             if (blob) {
                                  const cleanName = proj.file.name.replace(/\.[^/.]+$/, "");
                                  const fileName = `tagged-${cleanName}-${i}.jpg`;
                                  // Criar objeto File para compartilhamento
                                  const file = new File([blob], fileName, { type: 'image/jpeg' });
                                  generatedFiles.push(file);
                             }
                             resolve();
                        }, 'image/jpeg', 0.95);
                    } else {
                        resolve();
                    }
                };
                img.onerror = () => resolve();
            });
            // Pequeno delay para UI não travar
            await new Promise(r => setTimeout(r, 50));
        }

        // 2. Tentar Compartilhamento Nativo (Batch Share) - Funciona no iOS 15+ e Android recente
        if (generatedFiles.length > 0 && navigator.canShare && navigator.canShare({ files: generatedFiles })) {
            try {
                 await navigator.share({
                     files: generatedFiles,
                     title: 'Vivitag Imagens',
                     text: `Aqui estão suas ${generatedFiles.length} imagens editadas!`
                 });
                 // Se deu certo, paramos aqui.
                 setIsDownloading(false);
                 return;
            } catch (e) {
                console.log("Compartilhamento cancelado ou falhou, tentando download manual...", e);
                // Se falhar (ex: usuário cancelou), cai para o fallback abaixo
            }
        }

        // 3. Fallback: Download Individual (Loop) - Para Desktop ou Android antigo
        for (const file of generatedFiles) {
             const url = URL.createObjectURL(file);
             const link = document.createElement('a');
             link.download = file.name;
             link.href = url;
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             setTimeout(() => URL.revokeObjectURL(url), 100);
             await new Promise(r => setTimeout(r, 800)); // Delay entre downloads
        }

      } catch (e) {
          console.error("Erro no processamento", e);
      } finally {
          setIsDownloading(false);
      }
  };

  // --- RENDER LOGIN SCREEN ---
  if (!isAuthorized) {
      return (
          <div className="min-h-screen bg-vip-black flex items-center justify-center p-4 overflow-hidden relative">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
              
              <div className="w-full max-w-md bg-vip-dark/60 backdrop-blur-xl rounded-3xl p-8 border border-white/10 shadow-2xl relative animate-fadeIn">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-vip-neon to-transparent opacity-50"></div>
                  
                  <div className="flex flex-col items-center text-center">
                       {/* Animated Logo */}
                        <div className="relative w-20 h-20 mb-6 flex-shrink-0 group">
                            <div className="absolute -inset-[2px] rounded-full bg-[conic-gradient(from_0deg,transparent_0_300deg,#34d399_360deg)] animate-spin-slow opacity-80 blur-[1px]"></div>
                            <div className="absolute inset-[1px] rounded-full bg-vip-black z-10"></div>
                            <div className="relative w-full h-full rounded-full overflow-hidden z-20 border border-vip-neon/30">
                                <video 
                                    autoPlay 
                                    loop 
                                    muted 
                                    playsInline
                                    className="w-full h-full object-cover opacity-90"
                                    src="https://pixeldrain.com/api/filesystem/a64TJWWf/stick_2.mp4" 
                                />
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h2>
                        <p className="text-vip-gray text-sm mb-8">Esta é uma ferramenta privada. Digite sua chave de acesso para continuar.</p>

                        <form onSubmit={handleLogin} className="w-full space-y-4">
                            <div className="relative group">
                                <KeyRound className={`absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 transition-colors ${authError ? 'text-red-400' : 'text-vip-gray group-focus-within:text-vip-neon'}`} />
                                <input 
                                    type="password" 
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    placeholder="Senha de Acesso"
                                    className={`w-full bg-vip-black border rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-600 focus:outline-none focus:ring-1 transition-all
                                        ${authError 
                                            ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                                            : 'border-vip-border focus:border-vip-neon focus:ring-vip-neon/20'}`}
                                />
                            </div>

                            <button 
                                type="submit"
                                className="w-full bg-vip-neon hover:bg-emerald-400 text-black font-bold py-3 rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2"
                            >
                                Entrar no Studio <ArrowRight size={18} />
                            </button>
                            
                            {authError && (
                                <p className="text-red-400 text-xs font-medium animate-pulse">Senha incorreta. Tente novamente.</p>
                            )}
                        </form>
                  </div>
              </div>
          </div>
      );
  }

  // --- RENDER MAIN APP ---
  const activeProject = projects[activeIndex];
  const photoProjectsCount = projects.filter(p => p.type === AppMode.PHOTO).length;
  const videoProjectsCount = projects.filter(p => p.type === AppMode.VIDEO).length;

  return (
    <div className="min-h-screen bg-vip-black text-white flex flex-col font-sans h-[100dvh] overflow-hidden selection:bg-vip-green selection:text-black">
      {/* VIP Header */}
      <header className="border-b border-vip-border bg-vip-dark/80 backdrop-blur-md sticky top-0 z-50 flex-shrink-0">
        <div className="container mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 cursor-pointer relative z-50" onClick={handleReset}>
             {/* Animated Video Logo */}
            <div className="relative w-10 h-10 md:w-12 md:h-12 flex-shrink-0 group">
                <div className="absolute -inset-[2px] rounded-full bg-[conic-gradient(from_0deg,transparent_0_300deg,#34d399_360deg)] animate-spin-slow opacity-80 blur-[1px]"></div>
                <div className="absolute inset-[1px] rounded-full bg-vip-black z-10"></div>
                <div className="relative w-full h-full rounded-full overflow-hidden z-20 border border-vip-neon/30">
                    <video 
                        autoPlay 
                        loop 
                        muted 
                        playsInline
                        className="w-full h-full object-cover opacity-90 hover:opacity-100 transition-opacity transform hover:scale-110 duration-500"
                        src="https://pixeldrain.com/api/filesystem/a64TJWWf/stick_2.mp4" 
                    />
                </div>
                <div className="absolute bottom-0 right-0 w-2 h-2 md:w-3 md:h-3 bg-vip-neon rounded-full border-2 border-vip-black z-30 animate-pulse"></div>
            </div>

            <div>
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-white">VIVITAG<span className="text-vip-neon">.VIP</span></h1>
                <p className="text-[9px] md:text-[10px] text-vip-gray uppercase tracking-widest font-semibold">Bot Studio</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 md:gap-3 relative z-50">
             {projects.length > 0 && (
                <>
                    {/* Botão de Download em Lote para Fotos */}
                    {photoProjectsCount > 1 && (
                        <button 
                            onClick={downloadAllPhotos}
                            disabled={isDownloading}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all z-50 active:scale-95 border
                                ${isDownloading 
                                    ? 'bg-vip-neon/20 text-vip-neon border-vip-neon/50 cursor-wait' 
                                    : 'text-vip-neon hover:text-white hover:bg-vip-neon/10 border-vip-neon/20 hover:border-vip-neon/50'}`}
                            title="Enviar Todas"
                        >
                            {isDownloading ? (
                                <Loader2 size={18} className="animate-spin" /> 
                            ) : (
                                <Send size={18} /> 
                            )}
                            <span className="hidden sm:inline">{isDownloading ? 'Processando...' : 'Enviar Tudo'}</span>
                        </button>
                    )}

                    {/* Botão de Fila para Vídeos */}
                    {videoProjectsCount > 1 && batchQueueIndex === null && (
                         <button 
                            onClick={startBatchProcessing}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-vip-neon hover:text-white hover:bg-vip-neon/10 border border-vip-neon/20 hover:border-vip-neon/50 transition-all z-50 active:scale-95"
                            title="Processar Fila"
                        >
                            <PlayCircle size={18} /> <span className="hidden sm:inline">Processar Fila</span>
                        </button>
                    )}
                    
                    {batchQueueIndex !== null && (
                        <div className="flex items-center gap-2 px-3 py-2 bg-vip-green/10 border border-vip-green text-vip-green rounded-lg text-xs font-bold animate-pulse">
                            <Loader2 size={16} className="animate-spin" /> Processando Fila...
                        </div>
                    )}

                    <button 
                        onClick={handleReset}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider text-vip-gray hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all z-50 active:scale-95"
                        title="Voltar ao Início"
                        type="button"
                    >
                        <Home size={18} /> <span className="hidden sm:inline">Início</span>
                    </button>

                     <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-vip-border rounded-full border border-white/5">
                        <span className="w-2 h-2 rounded-full bg-vip-green animate-pulse"></span>
                        <span className="text-xs font-medium text-vip-gray">{projects.length} arquivos ativos</span>
                     </div>
                </>
             )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none"></div>
        
        {projects.length === 0 ? (
          /* Empty State / Upload */
          <div className="flex-1 flex flex-col items-center justify-center p-6 animate-fadeIn z-10 overflow-y-auto">
            {/* Simple Static Glassmorphism Box */}
            <div className="w-full max-w-2xl group my-auto">
                <div className="bg-vip-dark/60 backdrop-blur-xl relative rounded-3xl p-8 md:p-12 overflow-hidden flex flex-col items-center text-center border border-white/10 shadow-2xl">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-vip-neon to-transparent opacity-20 group-hover:opacity-50 transition-all duration-500"></div>

                    <input 
                        type="file" 
                        onChange={handleFileChange} 
                        accept="image/*,video/*"
                        multiple
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-50"
                    />
                    
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-vip-border/30 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300 border border-vip-border group-hover:border-white/50 group-hover:bg-white/5">
                        <Upload size={32} className="text-vip-gray group-hover:text-white transition-colors md:w-10 md:h-10" />
                    </div>
                    
                    <h2 className="text-2xl md:text-3xl font-bold mb-3 text-white group-hover:text-white transition-colors">Upload <span className="text-vip-neon group-hover:text-white transition-colors">Studio</span></h2>
                    <p className="text-vip-gray mb-6 max-w-md mx-auto leading-relaxed text-sm md:text-base group-hover:text-gray-300 transition-colors">
                        <span className="md:hidden">Toque para anexar</span>
                        <span className="hidden md:inline">Arraste ou anexe</span>
                        {' '}seus arquivos para começar a edição em lote profissional.
                    </p>
                    
                    {/* Supported Formats List */}
                    <div className="flex flex-col items-center gap-2 mt-2">
                        <p className="text-[10px] uppercase tracking-widest text-vip-gray/50 font-bold">Formatos Suportados</p>
                        <div className="flex items-center gap-2 text-xs font-medium text-vip-gray bg-black/30 px-3 py-1.5 rounded-lg border border-white/5">
                            <span className="hover:text-white transition-colors">JPG</span>
                            <span className="w-1 h-1 rounded-full bg-vip-border"></span>
                            <span className="hover:text-white transition-colors">PNG</span>
                            <span className="w-1 h-1 rounded-full bg-vip-border"></span>
                            <span className="hover:text-white transition-colors">MP4</span>
                            <span className="w-1 h-1 rounded-full bg-vip-border"></span>
                            <span className="hover:text-white transition-colors">MOV</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        ) : (
          /* Main Studio Interface */
          <>
            {/* Desktop Sidebar */}
            <aside className="w-72 bg-vip-dark border-r border-vip-border hidden md:flex flex-col flex-shrink-0 z-20 shadow-2xl">
                <div className="p-5 border-b border-vip-border flex items-center justify-between bg-vip-black/20">
                    <div className="flex items-center gap-2 text-vip-neon font-bold text-sm tracking-wide">
                        <Upload size={16} /> UPLOAD
                    </div>
                    <div className="relative group">
                         <input 
                            type="file" 
                            onChange={handleFileChange} 
                            accept="image/*,video/*"
                            multiple
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <button className="w-8 h-8 flex items-center justify-center rounded-lg bg-vip-neon hover:bg-emerald-400 text-black transition-colors shadow-lg shadow-vip-neon/20">
                            <Plus size={18} strokeWidth={3} />
                        </button>
                    </div>
                </div>
                
                <div className="p-3">
                    <button 
                        onClick={applySettingsToAll}
                        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider bg-vip-border/50 hover:bg-vip-neon/10 hover:text-vip-neon rounded-lg text-vip-gray border border-vip-border hover:border-vip-neon/30 transition-all">
                        <Copy size={14} /> REPLICAR EDIÇÃO (LOTE)
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                    {projects.map((p, idx) => (
                        <div 
                            key={p.id}
                            onClick={() => {
                                if (batchQueueIndex === null) setActiveIndex(idx);
                            }}
                            className={`group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border relative overflow-hidden ${
                                activeIndex === idx 
                                ? 'bg-gradient-to-r from-vip-neon/10 to-transparent border-vip-neon/50' 
                                : 'bg-transparent border-transparent hover:bg-vip-border/30'
                            } ${batchQueueIndex !== null && activeIndex !== idx ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {activeIndex === idx && <div className="absolute left-0 top-0 bottom-0 w-1 bg-vip-neon"></div>}
                            
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${activeIndex === idx ? 'bg-vip-neon text-black' : 'bg-vip-border text-vip-gray'}`}>
                                {p.type === AppMode.PHOTO ? <ImageIcon size={18} /> : <VideoIcon size={18} />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className={`text-sm font-semibold truncate ${activeIndex === idx ? 'text-white' : 'text-gray-400'}`}>
                                    {p.file.name}
                                </p>
                                <p className="text-[10px] text-gray-500 truncate uppercase font-medium">
                                    {(p.file.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                            {batchQueueIndex === null && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); removeProject(idx); }}
                                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-red-500/20 hover:text-red-400 rounded-lg text-gray-500 transition-all"
                                >
                                    <X size={14} />
                                </button>
                            )}
                            {batchQueueIndex !== null && idx === batchQueueIndex && (
                                <div className="p-2">
                                    <Loader2 size={14} className="animate-spin text-vip-green" />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
                
                <div className="p-4 border-t border-vip-border bg-vip-black/20">
                    <button 
                        onClick={(e) => handleReset(e)}
                        className="w-full py-2 text-xs font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors uppercase tracking-widest"
                    >
                        Resetar Projeto
                    </button>
                </div>
            </aside>

            {projects.length > 1 && (
                <div className="md:hidden absolute top-0 left-0 right-0 bg-vip-dark border-b border-vip-border z-30 flex overflow-x-auto p-2 gap-2 scrollbar-hide shadow-xl">
                    {projects.map((p, idx) => (
                        <button
                            key={p.id}
                            onClick={() => {
                                if (batchQueueIndex === null) setActiveIndex(idx);
                            }}
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                                activeIndex === idx 
                                ? 'bg-vip-neon text-black border-vip-neon shadow-[0_0_10px_rgba(52,211,153,0.4)]' 
                                : 'bg-vip-border text-gray-400 border-transparent'
                            }`}
                        >
                            {p.type === AppMode.PHOTO ? <ImageIcon size={12} /> : <VideoIcon size={12} />}
                            <span className="max-w-[80px] truncate">{p.file.name}</span>
                        </button>
                    ))}
                     <div className="relative flex-shrink-0">
                         <input 
                            type="file" 
                            onChange={handleFileChange} 
                            accept="image/*,video/*"
                            multiple
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <button className="flex items-center justify-center w-8 h-8 rounded-full bg-vip-border border border-white/10 text-vip-neon">
                            <Plus size={14} />
                        </button>
                     </div>
                </div>
            )}

            {/* Editor Area - Allows scrolling on mobile */}
            <div className={`flex-1 p-2 md:p-8 bg-black/50 overflow-y-auto overflow-x-hidden relative scrollbar-thin ${projects.length > 1 ? 'pt-14 md:pt-8' : ''}`}>
                 {activeProject && (
                     <div className="min-h-full max-w-[1600px] mx-auto animate-fadeIn pb-20 md:pb-0">
                        {activeProject.type === AppMode.VIDEO ? (
                            <VideoEditor 
                                key={activeProject.id} 
                                project={activeProject} 
                                onUpdate={updateProject}
                                onApplyAll={applySettingsToAll}
                                onApplyPresetAll={applyPresetToAllVideos}
                                isAutoProcessing={batchQueueIndex === activeIndex}
                                onAutoProcessDone={handleBatchVideoComplete}
                            />
                        ) : (
                            <PhotoEditor 
                                key={activeProject.id} 
                                project={activeProject} 
                                onUpdate={updateProject} 
                                onApplyAll={applySettingsToAll}
                            />
                        )}
                     </div>
                 )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;
