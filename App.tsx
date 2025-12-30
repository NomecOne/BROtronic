
import React, { useState, useMemo, useEffect } from 'react';
import { ROMFile, DMEMap, VersionInfo } from './types';
import { ROMParser } from './services/romParser';
import ROMLoader from './components/ROMLoader';
import { DEFINITION_LIBRARY } from './constants';

// Modules
import TunerModule from './components/modules/TunerModule';
import DiscoveryModule from './components/modules/DiscoveryModule';
import SurgeryModule from './components/modules/SurgeryModule';
import LibraryModule from './components/modules/LibraryModule';
import CompareModule from './components/modules/CompareModule';

// --- Icons ---
const IconTuner = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);
const IconDiscovery = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
  </svg>
);
const IconSurgery = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
  </svg>
);
const IconLibrary = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);
const IconCompare = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

const IconCollapseArrow = ({ color }: { color?: string }) => (
  <svg className="w-4 h-4" style={{ filter: `drop-shadow(0 0 5px ${color || 'currentColor'})` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const IconExpandArrow = ({ color }: { color?: string }) => (
  <svg className="w-4 h-4" style={{ filter: `drop-shadow(0 0 5px ${color || 'currentColor'})` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

type ViewMode = 'tuner' | 'discovery' | 'hexEdit' | 'library' | 'compare';
type NavLevel = 0 | 1 | 2; // 0: Full, 1: Mini, 2: Hidden (Visible Sliver)

const VIEW_CONFIG: Record<ViewMode, { label: string; icon: React.FC; color: string; hex: string; glow: string; shadow: string }> = {
  tuner: { label: 'TuneDex', icon: IconTuner, color: 'text-cyan-400', hex: 'rgba(34, 211, 238, 1)', glow: 'shadow-cyan-500/10', shadow: '0 0 40px rgba(34, 211, 238, 0.05)' },
  discovery: { label: 'HexBRO', icon: IconDiscovery, color: 'text-lime-400', hex: 'rgba(163, 230, 53, 1)', glow: 'shadow-lime-500/10', shadow: '0 0 40px rgba(163, 230, 53, 0.05)' },
  hexEdit: { label: 'HexED', icon: IconSurgery, color: 'text-red-500', hex: 'rgba(239, 68, 68, 1)', glow: 'shadow-red-500/10', shadow: '0 0 40px rgba(239, 68, 68, 1)' },
  library: { label: 'DEFman', icon: IconLibrary, color: 'text-purple-400', hex: 'rgba(192, 132, 252, 1)', glow: 'shadow-purple-500/10', shadow: '0 0 40px rgba(192, 132, 252, 0.05)' },
  compare: { label: 'CompaRU', icon: IconCompare, color: 'text-yellow-400', hex: 'rgba(250, 204, 21, 1)', glow: 'shadow-yellow-500/10', shadow: '0 0 40px rgba(250, 204, 21, 0.05)' },
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>('tuner'); 
  const [rom, setRom] = useState<ROMFile | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [library, setLibrary] = useState<VersionInfo[]>(DEFINITION_LIBRARY);
  const [editingData, setEditingData] = useState<number[][] | null>(null);
  const [navLevel, setNavLevel] = useState<NavLevel>(0);
  const [showLoader, setShowLoader] = useState(false);
  const [showUnloadConfirm, setShowUnloadConfirm] = useState(false);

  useEffect(() => {
    const selectedMap = rom?.detectedMaps.find(m => m.id === selectedMapId);
    if (rom && selectedMap) {
      setEditingData(ROMParser.extractMapData(rom.data, selectedMap));
    } else {
      setEditingData(null);
    }
  }, [rom, selectedMapId]);

  const handleUpdateValue = (r: number, c: number, val: number) => {
    if (!editingData) return;
    const newData = [...editingData];
    newData[r] = [...newData[r]];
    newData[r][c] = val;
    setEditingData(newData);
  };

  const updateMapDefinition = (updates: Partial<DMEMap>, mapId: string) => {
    setRom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        detectedMaps: prev.detectedMaps.map(m => m.id === mapId ? { ...m, ...updates } : m)
      };
    });
  };

  const addMapDefinition = (newMap: DMEMap) => {
    setRom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        detectedMaps: [newMap, ...prev.detectedMaps]
      };
    });
  };

  const handleUnloadRom = () => {
    setRom(null);
    setSelectedMapId(null);
    setEditingData(null);
    setShowUnloadConfirm(false);
  };

  const handleSaveRom = () => {
    if (!rom) return;
    const newData = new Uint8Array(rom.data);
    const selectedMap = rom.detectedMaps.find(m => m.id === selectedMapId);

    if (selectedMap && editingData) {
        let currentOffset = selectedMap.offset;
        const step = selectedMap.dataSize / 8;
        for (let r = 0; r < selectedMap.rows; r++) {
            for (let c = 0; c < selectedMap.cols; c++) {
                const raw = ROMParser.reverseFormula(selectedMap.formula, editingData[r][c], selectedMap.dataSize);
                if (selectedMap.dataSize === 16) {
                    if (selectedMap.endian === 'le') {
                        newData[currentOffset] = raw & 0xFF;
                        newData[currentOffset + 1] = (raw >> 8) & 0xFF;
                    } else {
                        newData[currentOffset] = (raw >> 8) & 0xFF;
                        newData[currentOffset + 1] = raw & 0xFF;
                    }
                } else {
                    newData[currentOffset] = Math.max(0, Math.min(255, raw));
                }
                currentOffset += step;
            }
        }
    }
    const newSum = ROMParser.calculateCorrectChecksum(newData);
    newData[newData.length - 2] = (newSum >> 8) & 0xFF;
    newData[newData.length - 1] = newSum & 0xFF;

    // 1. Export ROM (.bin)
    const romBlob = new Blob([newData], { type: 'application/octet-stream' });
    const romUrl = URL.createObjectURL(romBlob);
    const romLink = document.createElement('a');
    romLink.href = romUrl;
    romLink.download = `tuned_${rom.name}`;
    document.body.appendChild(romLink);
    romLink.click();
    document.body.removeChild(romLink);
    URL.revokeObjectURL(romUrl);

    // 2. Export Definition (.json)
    const definition: VersionInfo = {
      id: `export_${Date.now()}`,
      hw: rom.version?.hw || 'Unknown',
      sw: rom.version?.sw || 'Unknown',
      description: `Project Definition exported for ${rom.name}`,
      maps: rom.detectedMaps,
      version: 1
    };
    const defBlob = new Blob([JSON.stringify(definition, null, 2)], { type: 'application/json' });
    const defUrl = URL.createObjectURL(defBlob);
    const defLink = document.createElement('a');
    defLink.href = defUrl;
    defLink.download = `def_${rom.version?.hw || 'HW'}_${rom.version?.sw || 'SW'}.json`;
    document.body.appendChild(defLink);
    defLink.click();
    document.body.removeChild(defLink);
    URL.revokeObjectURL(defUrl);
  };

  const toggleNav = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNavLevel((prev) => ((prev + 1) % 3) as NavLevel);
  };

  const expandNav = () => {
    if (navLevel === 1) setNavLevel(0);
  };

  const NavItem = ({ mode, disabled }: { mode: ViewMode, disabled?: boolean }) => {
    const config = VIEW_CONFIG[mode];
    const Icon = config.icon;
    const isActive = activeView === mode;

    return (
      <button 
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setActiveView(mode);
        }} 
        disabled={disabled}
        title={navLevel === 1 ? config.label : ''}
        className={`w-full flex items-center p-3 rounded-xl transition-all duration-300 group relative
          ${disabled ? 'opacity-20 cursor-not-allowed grayscale' : ''}
          ${isActive 
            ? `bg-slate-900 ring-1 ring-slate-800 shadow-xl ${config.glow}` 
            : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'}`}
      >
        <div className={`flex items-center justify-center shrink-0 transition-transform duration-300 
          ${isActive ? 'scale-110 ' + config.color : 'text-slate-500'} 
          ${navLevel === 1 ? 'mx-auto' : 'mr-3'}`}>
          <Icon />
        </div>
        {navLevel === 0 && (
          <span className={`text-xs font-black uppercase italic tracking-wider truncate transition-colors duration-300
            ${isActive ? config.color : 'text-slate-400 group-hover:text-slate-200'}`}>
            {config.label}
          </span>
        )}
        {isActive && (
          <div className={`absolute left-0 top-2 bottom-2 w-1 rounded-full shadow-[0_0_10px_currentColor] ${config.color.replace('text', 'bg')}`} />
        )}
      </button>
    );
  };

  const getSidebarWidthClass = () => {
    if (navLevel === 0) return 'w-72';
    if (navLevel === 1) return 'w-20';
    return 'w-[1px] border-r-0'; 
  };

  const mainStyle: React.CSSProperties = {
    boxShadow: `inset 0 0 100px ${VIEW_CONFIG[activeView].shadow.split('rgba')[1].replace(')', ', 0.02)')}`,
    transition: 'all 0.5s ease-in-out'
  };

  const activeColorHex = VIEW_CONFIG[activeView].hex;
  const activeColorTailwind = VIEW_CONFIG[activeView].color;

  const handleRomLoaded = (loadedRom: ROMFile) => {
    setRom(loadedRom);
    setShowLoader(false);
    setSelectedMapId(null);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100 bg-slate-950 font-sans">
      
      {showLoader && (
        <ROMLoader 
          onLoad={handleRomLoaded} 
          onCancel={() => setShowLoader(false)} 
          themeColor={activeColorHex} 
        />
      )}

      {/* Unload Confirmation Modal */}
      {showUnloadConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowUnloadConfirm(false)} />
          <div className="relative w-full max-w-sm bg-slate-900 border border-red-900/40 rounded-3xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.2)] animate-in zoom-in duration-200">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Binary Purge</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider leading-relaxed">
                Unloading will synchronize all active hardware registers. <br/>
                <span className="text-red-500">All unsaved workspace data will be lost.</span>
              </p>
              <div className="grid grid-cols-2 gap-3 w-full mt-4">
                <button 
                  onClick={() => setShowUnloadConfirm(false)}
                  className="py-3 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase italic tracking-widest hover:bg-slate-750 transition-all"
                >
                  Dismiss
                </button>
                <button 
                  onClick={handleUnloadRom}
                  className="py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase italic tracking-widest hover:bg-red-500 shadow-lg shadow-red-900/20 transition-all"
                >
                  Confirm Purge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Navigation Panel */}
      <aside 
        onClick={expandNav}
        className={`bg-slate-950 border-r border-slate-900 flex flex-col shadow-2xl z-30 transition-all duration-300 ease-in-out relative group/aside
          ${getSidebarWidthClass()} ${navLevel === 1 ? 'cursor-pointer hover:bg-slate-900/20' : ''}`}
      >
        <div 
          className={`absolute top-0 right-0 w-[3px] h-full transition-all duration-500 z-50 pointer-events-none ${navLevel === 2 ? 'neon-line-pulse' : ''}`}
          style={{ 
            backgroundColor: activeColorHex,
            // @ts-ignore: Custom CSS properties
            '--neon-color': activeColorHex,
            '--neon-mid': activeColorHex.replace('1)', '0.85)'),
            '--neon-outer': activeColorHex.replace('1)', '0.55)'),
            boxShadow: navLevel !== 2 ? `0 0 10px ${activeColorHex.replace('1)', '0.8)')}` : undefined
          } as React.CSSProperties}
        >
          {navLevel === 2 && (
            <div 
              className="absolute top-0 left-[-16px] w-[32px] h-full pointer-events-none flare-pulse overflow-hidden"
              style={{
                background: `linear-gradient(to right, transparent 0%, transparent 16.6%, ${activeColorHex.replace('1)', '0.12)')} 50%, ${activeColorHex.replace('1)', '0.12)')} 83.3%, transparent 100%)`,
                backdropFilter: 'blur(3px)',
              }}
            >
                <div className="absolute inset-0 translate-y-[-100%] animate-[scan_5s_linear_infinite]" style={{
                    background: `linear-gradient(to bottom, transparent, ${activeColorHex.replace('1)', '0.25)')}, transparent)`,
                    height: '15%'
                }} />
            </div>
          )}
        </div>

        <button 
          onClick={toggleNav}
          className="absolute top-20 -right-4 translate-y-[-50%] z-50 w-8 h-8 bg-slate-900 border-2 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90"
          style={{ 
            borderColor: activeColorHex.replace('1)', '0.8)'),
            color: activeColorHex,
            boxShadow: `0 0 15px ${activeColorHex.replace('1)', '0.4)')}`
          }}
          title={navLevel === 0 ? 'Minimize Sidebar' : navLevel === 1 ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          {navLevel === 2 ? <IconExpandArrow color={activeColorHex} /> : <IconCollapseArrow color={activeColorHex} />}
        </button>

        <div className={`flex flex-col h-full w-full overflow-hidden transition-opacity duration-300 ${navLevel === 2 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="border-b border-slate-900 p-6 h-24 flex items-center shrink-0">
            {navLevel === 0 ? (
              <h1 className="flex items-baseline font-black italic uppercase tracking-tighter select-none transition-all duration-500">
                <span className={`text-5xl ${activeColorTailwind} transition-all duration-500`} style={{ filter: `drop-shadow(0 0 12px ${activeColorHex.replace('1)', '0.9)')})` }}>BRO</span>
                <span className={`text-2xl opacity-80 ml-1 ${activeColorTailwind} transition-all duration-500`} style={{ filter: `drop-shadow(0 0 5px ${activeColorHex.replace('1)', '0.4)')})` }}>TRONIC</span>
              </h1>
            ) : (
              <div className="w-full flex justify-center">
                <div className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all duration-500`} style={{ borderColor: activeColorHex.replace('1)', '0.5)'), boxShadow: `0 0 15px ${activeColorHex.replace('1)', '0.5)')}` }}>
                  <span className={`font-black italic text-xl ${activeColorTailwind} transition-all duration-500`} style={{ filter: `drop-shadow(0 0 8px ${activeColorHex.replace('1)', '0.8)')})` }}>B</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex-1 p-4 space-y-2 overflow-y-auto overflow-x-hidden scrollbar-hide">
             <NavItem mode="tuner" />
             <NavItem mode="discovery" />
             <NavItem mode="hexEdit" />
             <NavItem mode="library" />
             <NavItem mode="compare" disabled={true} />
          </div>

          <div className="p-4 border-t border-slate-900 shrink-0 space-y-2">
             <button 
               onClick={(e) => { e.stopPropagation(); setShowUnloadConfirm(true); }} 
               disabled={!rom} 
               className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase bg-slate-800/50 text-slate-500 border border-slate-800 disabled:opacity-20 transition-all hover:bg-red-950/40 hover:text-red-400 hover:border-red-900/50 shadow-xl active:scale-95 flex items-center justify-center"
             >
               {navLevel === 1 ? (
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               ) : 'UNLOAD ROM'}
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); handleSaveRom(); }} 
               disabled={!rom} 
               className="w-full py-3 rounded-xl text-[10px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 disabled:opacity-50 transition-all hover:bg-cyan-600 hover:text-white hover:border-cyan-500 shadow-xl active:scale-95 flex items-center justify-center"
             >
               {navLevel === 1 ? (
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 12l-4 4m0 0l-4-4m4-4v12" /></svg>
               ) : 'EXPORT ROM&DEF'}
             </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative backdrop-blur-3xl overflow-hidden" style={mainStyle}>
        <div className={`absolute inset-0 pointer-events-none opacity-20 transition-all duration-700 ${VIEW_CONFIG[activeView].glow.replace('shadow', 'bg')}`} />

        {/* Modular View Rendering */}
        {rom ? (
          <>
            {activeView === 'tuner' && (
              <TunerModule 
                rom={rom} 
                selectedMapId={selectedMapId} 
                setSelectedMapId={setSelectedMapId} 
                editingData={editingData} 
                onUpdateValue={handleUpdateValue} 
              />
            )}
            
            {activeView === 'discovery' && (
              <DiscoveryModule 
                rom={rom} 
                onAddMapDefinition={addMapDefinition} 
              />
            )}

            {activeView === 'hexEdit' && (
              <SurgeryModule 
                rom={rom} 
                onUpdateByte={(o, v) => {
                  const newData = new Uint8Array(rom.data);
                  newData[o] = v;
                  setRom({...rom, data: newData});
                }} 
              />
            )}

            {activeView === 'library' && (
              <LibraryModule 
                library={library} 
                rom={rom} 
                onSelectMap={setSelectedMapId}
                onAddActiveMap={addMapDefinition}
                onUpdateActiveMap={updateMapDefinition}
                onDeleteActiveMap={(id) => setRom(prev => prev ? {...prev, detectedMaps: prev.detectedMaps.filter(m => m.id !== id)} : null)}
                onUpdateLibraryMap={(vid, mid, up) => setLibrary(prev => prev.map(v => v.id === vid ? {...v, maps: v.maps.map(m => m.id === mid ? {...m, ...up} : m)} : v))}
                onDeleteLibraryMap={(vid, mid) => setLibrary(prev => prev.map(v => v.id === vid ? {...v, maps: v.maps.filter(m => m.id !== mid)} : v))}
                onAddLibraryMap={(vid, nm) => setLibrary(prev => prev.map(v => v.id === vid ? {...v, maps: [nm, ...v.maps]} : v))}
                onAddVersion={(v) => setLibrary(prev => [v, ...prev])}
                onUpdateFullVersion={(v) => setLibrary(prev => prev.map(old => old.id === v.id ? v : old))}
                onApplyLibrary={(maps) => {
                  setRom({...rom, detectedMaps: JSON.parse(JSON.stringify(maps))});
                  setActiveView('tuner');
                }}
              />
            )}

            {activeView === 'compare' && <CompareModule />}
          </>
        ) : (
          /* "Initialize Hardware" Placeholder - Only if no ROM loaded */
          <div className="flex-1 flex items-center justify-center p-12 text-center relative z-10">
            <div className="max-w-md space-y-6">
               <div className={`w-24 h-24 rounded-3xl flex items-center justify-center mx-auto border shadow-[0_0_30px_rgba(255,255,255,0.05)] transition-all duration-500`} style={{ borderColor: `${activeColorHex.replace('1)', '0.2)')}`, backgroundColor: `${activeColorHex.replace('1)', '0.05)')}`, color: activeColorHex }}>
                 {React.createElement(VIEW_CONFIG[activeView].icon)}
               </div>
               <div>
                 <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Initialize {VIEW_CONFIG[activeView].label}</h2>
                 <p className="text-slate-500 mt-2 text-sm leading-relaxed italic">The module requires an active binary stream to synchronize with DME hardware.</p>
               </div>
               <button 
                onClick={() => setShowLoader(true)}
                className="px-12 py-4 rounded-2xl font-black uppercase italic tracking-widest text-xs shadow-2xl transition-all hover:scale-105 active:scale-95"
                style={{ backgroundColor: activeColorHex, color: 'white' }}
               >
                 Initialize Hardware
               </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
