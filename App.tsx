
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ROMFile, DMEMap, VersionInfo } from './types';
import { ROMParser } from './services/romParser';
import HexViewer from './components/HexViewer';
import ManualHexEditor from './components/ManualHexEditor';
import MapTableEditor from './components/MapTableEditor';
import Visualizer from './components/Visualizer';
import DefinitionManager from './components/DefinitionManager';
import { DEFINITION_LIBRARY } from './constants';

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none">
    <span className="text-[9px] font-mono font-black text-lime-400 bg-black px-2 py-0.5 rounded border border-lime-500/50 tracking-wider">
      NODE_ID::{id}
    </span>
  </div>
);

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

const IconCollapseArrow = () => (
  <svg className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const IconExpandArrow = () => (
  <svg className="w-4 h-4 text-cyan-400 drop-shadow-[0_0_5px_rgba(34,211,238,0.8)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

type ViewMode = 'tuner' | 'discovery' | 'hexEdit' | 'library' | 'compare';
type NavLevel = 0 | 1 | 2; // 0: Full, 1: Mini, 2: Hidden (Visible Sliver)

const VIEW_CONFIG: Record<ViewMode, { label: string; icon: React.FC; color: string; hex: string; glow: string; shadow: string }> = {
  tuner: { label: 'TuneDex', icon: IconTuner, color: 'text-cyan-400', hex: 'rgba(34, 211, 238, 1)', glow: 'shadow-cyan-500/10', shadow: '0 0 40px rgba(34, 211, 238, 0.05)' },
  discovery: { label: 'HexBRO', icon: IconDiscovery, color: 'text-lime-400', hex: 'rgba(163, 230, 53, 1)', glow: 'shadow-lime-500/10', shadow: '0 0 40px rgba(163, 230, 53, 0.05)' },
  hexEdit: { label: 'HexED', icon: IconSurgery, color: 'text-red-500', hex: 'rgba(239, 68, 68, 1)', glow: 'shadow-red-500/10', shadow: '0 0 40px rgba(239, 68, 68, 0.05)' },
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

  const selectedMap = useMemo(() => rom?.detectedMaps.find(m => m.id === selectedMapId), [rom, selectedMapId]);

  useEffect(() => {
    if (rom && selectedMap) {
      setEditingData(ROMParser.extractMapData(rom.data, selectedMap));
    }
  }, [rom, selectedMap]);

  const handleFileUpload = useCallback(async (file: File) => {
    const buffer = await file.arrayBuffer();
    const parsed = await ROMParser.parse(buffer, file.name);
    if (parsed.version) {
      const match = library.find(v => v.hw === parsed.version?.hw && v.sw === parsed.version?.sw);
      if (match) {
        parsed.detectedMaps = JSON.parse(JSON.stringify(match.maps));
      }
    }
    setRom(parsed);
    setSelectedMapId(null);
  }, [library]);

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

  const handleSaveRom = () => {
    if (!rom) return;
    const newData = new Uint8Array(rom.data);
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

    const blob = new Blob([newData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tuned_${rom.name}`;
    a.click();
    URL.revokeObjectURL(url);
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
    return 'w-[1px] border-r-0'; // Fully collapsed but keeping the edge sliver visible
  };

  // Neon Glass Effect Styling for Main Content
  const mainStyle: React.CSSProperties = {
    boxShadow: `inset 0 0 100px ${VIEW_CONFIG[activeView].shadow.split('rgba')[1].replace(')', ', 0.02)')}`,
    transition: 'all 0.5s ease-in-out'
  };

  // Dynamic Logo Color based on active module
  const activeColorHex = VIEW_CONFIG[activeView].hex;
  const activeColorTailwind = VIEW_CONFIG[activeView].color;

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100 bg-slate-950 font-sans">
      {/* Global Navigation Panel */}
      <aside 
        onClick={expandNav}
        className={`bg-slate-950 border-r border-slate-900 flex flex-col shadow-2xl z-30 transition-all duration-300 ease-in-out relative group/aside
          ${getSidebarWidthClass()} ${navLevel === 1 ? 'cursor-pointer hover:bg-slate-900/20' : ''}`}
      >
        {/* Dynamic Neon Edge Line - Increased glow (30px) and intensity (0.9 opacity) when level 2 (fully collapsed) */}
        <div 
          className="absolute top-0 right-0 w-[1px] h-full transition-all duration-500 z-50 pointer-events-none"
          style={{ 
            backgroundColor: activeColorHex,
            boxShadow: navLevel === 2 
              ? `0 0 30px ${activeColorHex.replace('1)', '0.9)')}` 
              : `0 0 15px ${activeColorHex.replace('1)', '0.8)')}` 
          }}
        />

        {/* Protruding Tab Toggle Button - Neon Outline Style */}
        <button 
          onClick={toggleNav}
          className="absolute top-20 -right-4 translate-y-[-50%] z-50 w-8 h-8 bg-slate-900 border-2 border-cyan-500/60 rounded-full flex items-center justify-center text-cyan-400 hover:text-cyan-300 hover:border-cyan-400 transition-all shadow-[0_0_10px_rgba(34,211,238,0.3)] active:scale-90"
          title={navLevel === 0 ? 'Minimize Sidebar' : navLevel === 1 ? 'Hide Sidebar' : 'Show Sidebar'}
        >
          {navLevel === 2 ? <IconExpandArrow /> : <IconCollapseArrow />}
        </button>

        {/* Sidebar Content Wrapper */}
        <div className={`flex flex-col h-full w-full overflow-hidden transition-opacity duration-300 ${navLevel === 2 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <div className="border-b border-slate-900 p-6 h-24 flex items-center shrink-0">
            {navLevel === 0 ? (
              <h1 className="flex items-baseline font-black italic uppercase tracking-tighter select-none transition-all duration-500">
                <span 
                  className={`text-5xl ${activeColorTailwind} transition-all duration-500`}
                  style={{ filter: `drop-shadow(0 0 12px ${activeColorHex.replace('1)', '0.9)')})` }}
                >
                  BRO
                </span>
                <span 
                  className={`text-2xl opacity-80 ml-1 ${activeColorTailwind} transition-all duration-500`}
                  style={{ filter: `drop-shadow(0 0 5px ${activeColorHex.replace('1)', '0.4)')})` }}
                >
                  TRONIC
                </span>
              </h1>
            ) : (
              <div className="w-full flex justify-center">
                <div 
                  className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center transition-all duration-500`}
                  style={{ 
                    borderColor: activeColorHex.replace('1)', '0.5)'),
                    boxShadow: `0 0 15px ${activeColorHex.replace('1)', '0.5)')}`
                  }}
                >
                  <span 
                    className={`font-black italic text-xl ${activeColorTailwind} transition-all duration-500`}
                    style={{ filter: `drop-shadow(0 0 8px ${activeColorHex.replace('1)', '0.8)')})` }}
                  >
                    B
                  </span>
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

          <div className="p-4 border-t border-slate-900 space-y-3 shrink-0">
             <label 
               onClick={(e) => e.stopPropagation()}
               className={`block w-full cursor-pointer bg-slate-900/50 border border-slate-800 hover:border-slate-700 p-3 rounded-xl text-center text-[10px] font-black uppercase text-slate-500 hover:text-cyan-400 transition-all shadow-inner
               ${navLevel === 1 ? 'px-0' : ''}`}>
               {navLevel === 1 ? (
                 <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0L8 8m4-4v12" /></svg>
               ) : 'Load Binary'}
               <input type="file" className="hidden" accept=".bin,.rom" onChange={e => e.target.files?.[0] && handleFileUpload(e.target.files[0])} />
             </label>
             
             <button 
               onClick={(e) => { e.stopPropagation(); handleSaveRom(); }} 
               disabled={!rom} 
               className="w-full py-3 rounded-xl text-[10px] font-black uppercase bg-slate-800 text-slate-500 border border-slate-700 disabled:opacity-20 transition-all hover:bg-cyan-600 hover:text-white hover:border-cyan-500 shadow-xl active:scale-95 flex items-center justify-center"
             >
               {navLevel === 1 ? (
                 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 12l-4 4m0 0l-4-4m4-4v12" /></svg>
               ) : 'Export ROM'}
             </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area - Neon Glass Container */}
      <main 
        className="flex-1 flex flex-col min-w-0 bg-slate-950 relative backdrop-blur-3xl overflow-hidden"
        style={mainStyle}
      >
        {/* Dynamic Glow Background Overlay */}
        <div className={`absolute inset-0 pointer-events-none opacity-20 transition-all duration-700 ${VIEW_CONFIG[activeView].glow.replace('shadow', 'bg')}`} />

        {activeView === 'tuner' && rom && (
          <div className="flex-1 flex min-w-0 overflow-hidden relative z-10">
            {/* Live Registers Panel */}
            <aside className="w-64 bg-black/40 border-r border-slate-900/50 flex flex-col shrink-0 backdrop-blur-xl">
               <div className="p-4 border-b border-slate-900/50 bg-black/20 flex flex-col">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic mb-1">Live Registers</span>
                  <div className="flex items-center space-x-2 text-[10px] text-cyan-400/80 font-bold font-mono">
                    <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
                    <span>{rom.detectedMaps.length} Active Profiles</span>
                  </div>
               </div>
               <div className="flex-1 overflow-y-auto p-3 space-y-1">
                 {rom.detectedMaps.map(m => (
                   <button 
                    key={m.id} 
                    onClick={() => setSelectedMapId(m.id)} 
                    className={`w-full text-left px-3 py-2.5 text-[11px] font-bold rounded-lg truncate transition-all flex items-center justify-between group
                      ${selectedMapId === m.id 
                        ? 'bg-cyan-500/20 text-cyan-100 shadow-lg ring-1 ring-cyan-500/30' 
                        : 'text-slate-500 hover:bg-slate-900/50 hover:text-slate-300'}`}
                   >
                     <span className="truncate">{m.name}</span>
                     <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0 ml-2 ${selectedMapId === m.id ? 'bg-cyan-400 text-cyan-950' : 'bg-slate-950 text-slate-600 group-hover:text-slate-400'}`}>0x{m.offset.toString(16).toUpperCase()}</span>
                   </button>
                 ))}
               </div>
            </aside>

            {/* Tuner Editor Area */}
            <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden relative">
              <PageID id="02" />
              {selectedMap && editingData ? (
                <>
                  <div className="h-64 flex flex-col shrink-0 bg-black/40 rounded-2xl border border-slate-800/50 overflow-hidden shadow-2xl backdrop-blur-md">
                    <Visualizer data={editingData} xAxis={ROMParser.getAxisValues(rom.data, selectedMap.xAxis)} yAxis={ROMParser.getAxisValues(rom.data, selectedMap.yAxis)} />
                  </div>
                  <div className="flex-1 min-h-0">
                    <MapTableEditor 
                        map={selectedMap} 
                        data={editingData} 
                        xAxis={ROMParser.getAxisValues(rom.data, selectedMap.xAxis)} 
                        yAxis={ROMParser.getAxisValues(rom.data, selectedMap.yAxis)} 
                        onUpdate={handleUpdateValue} 
                    />
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center p-12 text-center">
                  <div className="max-w-md space-y-4">
                    <div className="w-20 h-20 bg-cyan-500/5 rounded-full flex items-center justify-center mx-auto border border-cyan-500/10 mb-6 drop-shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                       <svg className="w-10 h-10 text-cyan-900/40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="text-xl font-black text-slate-400 uppercase tracking-widest italic">Register Standby</h3>
                    <p className="text-slate-600 text-sm leading-relaxed">Select a map from the register explorer on the left to initialize the master tuning deck.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {activeView === 'discovery' && (
          <div className="flex-1 p-6 flex flex-col overflow-hidden relative z-10">
            <PageID id="03" />
            <HexViewer data={rom?.data} onAddDefinition={addMapDefinition} />
          </div>
        )}

        {activeView === 'hexEdit' && (
          <div className="flex-1 p-6 flex flex-col overflow-hidden relative z-10">
            <PageID id="04" />
            <ManualHexEditor data={rom?.data} onUpdateByte={(o, v) => {
              if (rom) {
                const newData = new Uint8Array(rom.data);
                newData[o] = v;
                setRom({...rom, data: newData});
              }
            }} />
          </div>
        )}

        {activeView === 'library' && (
           <div className="flex-1 p-6 flex flex-col overflow-hidden relative z-10">
              <PageID id="05" />
              <DefinitionManager 
                library={library} 
                maps={rom?.detectedMaps || []} 
                romLoaded={!!rom}
                onSelect={setSelectedMapId}
                onAddActive={addMapDefinition}
                onUpdateActive={updateMapDefinition}
                onDeleteActive={(id) => setRom(prev => prev ? {...prev, detectedMaps: prev.detectedMaps.filter(m => m.id !== id)} : null)}
                onUpdateLibrary={(vid, mid, up) => setLibrary(prev => prev.map(v => v.id === vid ? {...v, maps: v.maps.map(m => m.id === mid ? {...m, ...up} : m)} : v))}
                onDeleteLibrary={(vid, mid) => setLibrary(prev => prev.map(v => v.id === vid ? {...v, maps: v.maps.filter(m => m.id !== mid)} : v))}
                onAddLibrary={(vid, nm) => setLibrary(prev => prev.map(v => v.id === vid ? {...v, maps: [nm, ...v.maps]} : v))}
                onAddVersion={(v) => setLibrary(prev => [v, ...prev])}
                onUpdateFullVersion={(v) => setLibrary(prev => prev.map(old => old.id === v.id ? v : old))}
                onApplyLibrary={(maps) => {
                  if(rom) setRom({...rom, detectedMaps: JSON.parse(JSON.stringify(maps))});
                  setActiveView('tuner');
                }}
              />
           </div>
        )}

        {activeView === 'tuner' && !rom && (
          <div className="flex-1 flex items-center justify-center p-12 text-center relative z-10">
            <div className="max-w-md space-y-6">
               <div className="w-24 h-24 bg-cyan-600/10 rounded-3xl flex items-center justify-center mx-auto border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.2)] text-cyan-500">
                 <IconTuner />
               </div>
               <div>
                 <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">BROTRONIC Master Deck</h2>
                 <p className="text-slate-500 mt-2 text-sm leading-relaxed">Waiting for hardware interface. Please load a Bosch Motronic 3.1, 3.3, or 3.3.1 binary file to initialize calibration systems.</p>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
