
import React, { useState, useEffect } from 'react';
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
import ParserViewer from './components/modules/ParserViewer';

// Icons
const IconTuner = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2-2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
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
const IconParser = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
  </svg>
);

const IconCollapseArrow = ({ color }: { color?: string }) => (
  <svg className="w-4 h-4" style={{ filter: `drop-shadow(0 0 8px ${color || 'currentColor'})` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
  </svg>
);

const IconExpandArrow = ({ color }: { color?: string }) => (
  <svg className="w-4 h-4" style={{ filter: `drop-shadow(0 0 8px ${color || 'currentColor'})` }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
  </svg>
);

const IconUnload = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l-5-5-5 5m5-5v12m-9-4h18" />
  </svg>
);

const IconExport = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0L8 8m4-4v12" />
  </svg>
);

type ViewMode = 'tuner' | 'discovery' | 'hexEdit' | 'library' | 'compare' | 'parview';
type NavLevel = 0 | 1 | 2;

const VIEW_CONFIG: Record<ViewMode, { label: string; icon: React.FC; color: string; hex: string; glow: string; shadow: string }> = {
  tuner: { label: 'TuneDex', icon: IconTuner, color: 'text-cyan-400', hex: 'rgba(34, 211, 238, 1)', glow: 'shadow-cyan-500/10', shadow: '0 0 40px rgba(34, 211, 238, 0.05)' },
  discovery: { label: 'HexBRO', icon: IconDiscovery, color: 'text-lime-400', hex: 'rgba(163, 230, 53, 1)', glow: 'shadow-lime-500/10', shadow: '0 0 40px rgba(163, 230, 53, 0.05)' },
  hexEdit: { label: 'HexED', icon: IconSurgery, color: 'text-red-500', hex: 'rgba(239, 68, 68, 1)', glow: 'shadow-red-500/10', shadow: '0 0 40px rgba(239, 68, 68, 1)' },
  library: { label: 'DEFman', icon: IconLibrary, color: 'text-purple-400', hex: 'rgba(192, 132, 252, 1)', glow: 'shadow-purple-500/10', shadow: '0 0 40px rgba(192, 132, 252, 0.05)' },
  compare: { label: 'CompaRU', icon: IconCompare, color: 'text-yellow-400', hex: 'rgba(250, 204, 21, 1)', glow: 'shadow-yellow-500/10', shadow: '0 0 40px rgba(250, 204, 21, 0.05)' },
  parview: { label: 'PARview', icon: IconParser, color: 'text-emerald-400', hex: 'rgba(52, 211, 153, 1)', glow: 'shadow-emerald-500/10', shadow: '0 0 40px rgba(52, 211, 153, 0.05)' },
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<ViewMode>('parview'); 
  const [rom, setRom] = useState<ROMFile | null>(null);
  const [activeDefinition, setActiveDefinition] = useState<VersionInfo | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [library, setLibrary] = useState<VersionInfo[]>(DEFINITION_LIBRARY);
  const [editingData, setEditingData] = useState<number[][] | null>(null);
  const [navLevel, setNavLevel] = useState<NavLevel>(0);
  const [showLoader, setShowLoader] = useState(false);
  const [showUnloadConfirm, setShowUnloadConfirm] = useState(false);
  
  // Cross-module teleportation state
  const [lastNavRequest, setLastNavRequest] = useState<{ module: ViewMode; offset?: number; mapId?: string } | null>(null);

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

  const handleUnloadRom = () => {
    setRom(null);
    setActiveDefinition(null);
    setSelectedMapId(null);
    setEditingData(null);
    setShowUnloadConfirm(false);
  };

  const handleSaveActiveToLibrary = (mapsToSave: DMEMap[]) => {
    if (!rom) return;
    const newDef: VersionInfo = {
      id: `user_${Date.now()}`,
      hw: rom.version?.hw || 'Unknown',
      sw: rom.version?.sw || 'Unknown',
      description: `Saved Workspace: ${rom.name}`,
      maps: JSON.parse(JSON.stringify(mapsToSave)),
      version: 1,
      isBuiltIn: false
    };
    setLibrary(prev => [newDef, ...prev]);
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

    const romBlob = new Blob([newData], { type: 'application/octet-stream' });
    const romUrl = URL.createObjectURL(romBlob);
    const romLink = document.createElement('a');
    romLink.href = romUrl;
    romLink.download = `tuned_${rom.name}`;
    document.body.appendChild(romLink);
    romLink.click();
    document.body.removeChild(romLink);
    URL.revokeObjectURL(romUrl);

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
    // Corrected to expand to full state if in micro OR icon-collapsed state
    if (navLevel === 1 || navLevel === 2) setNavLevel(0);
  };

  const handleTeleport = (module: ViewMode, offset?: number, mapId?: string) => {
    setActiveView(module);
    setLastNavRequest({ module, offset, mapId });
    if (mapId) setSelectedMapId(mapId);
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

  const handleRomLoaded = (loadedRom: ROMFile, definition?: VersionInfo) => {
    // If definition is undefined, user chose Heuristic Discovery
    if (!definition) {
      const heuristicDef: VersionInfo = {
        id: `heuristic_${Date.now()}`,
        hw: loadedRom.version?.hw || 'Unknown',
        sw: loadedRom.version?.sw || 'Unknown',
        description: `Heuristic Discovery: ${loadedRom.name}`,
        maps: JSON.parse(JSON.stringify(loadedRom.detectedMaps)),
        version: 1,
        isBuiltIn: false
      };
      setLibrary(prev => [heuristicDef, ...prev]);
      setActiveDefinition(heuristicDef);
    } else {
      // Use the chosen definition
      loadedRom.detectedMaps = JSON.parse(JSON.stringify(definition.maps));
      setActiveDefinition(definition);
    }

    setRom(loadedRom);
    setShowLoader(false);
    setSelectedMapId(null);
  };

  const currentTheme = VIEW_CONFIG[activeView];

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100 bg-slate-950 font-sans">
      
      {showLoader && (
        <ROMLoader 
          onLoad={handleRomLoaded} 
          onCancel={() => setShowLoader(false)} 
          themeColor={VIEW_CONFIG[activeView].hex} 
        />
      )}

      {showUnloadConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xl animate-in fade-in duration-300" onClick={() => setShowUnloadConfirm(false)} />
          <div className="relative w-full max-sm bg-slate-900 border border-red-900/40 rounded-3xl p-8 shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-red-600/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500 mb-2">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-black text-white uppercase italic">Binary Purge</h3>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Unloading will lose all unsaved session data.</p>
              <div className="grid grid-cols-2 gap-3 w-full mt-4">
                <button onClick={() => setShowUnloadConfirm(false)} className="py-3 rounded-xl bg-slate-800 text-slate-300 text-[10px] font-black uppercase italic">Dismiss</button>
                <button onClick={handleUnloadRom} className="py-3 rounded-xl bg-red-600 text-white text-[10px] font-black uppercase italic">Confirm Purge</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <aside 
        onClick={expandNav} 
        className={`bg-slate-950 border-r border-slate-900 flex flex-col shadow-2xl z-30 transition-all duration-500 relative group/aside ${navLevel === 0 ? 'w-72' : navLevel === 1 ? 'w-20 cursor-pointer hover:bg-slate-900/40' : 'w-[1px] cursor-pointer'}`}
        style={{
          '--neon-color': currentTheme.hex,
          '--neon-mid': currentTheme.hex.replace('1)', '0.4)'),
          '--neon-outer': currentTheme.hex.replace('1)', '0.1)'),
        } as React.CSSProperties}
      >
        {/* Neon Line Pulse on Right Edge */}
        <div className="absolute right-[-1px] top-0 bottom-0 w-[2px] z-50 neon-line-pulse" style={{ backgroundColor: currentTheme.hex }} />

        {/* Circular Navigation Toggle Button shifted UP per drawing */}
        <button 
          onClick={toggleNav}
          className="absolute -right-6 top-16 w-12 h-12 bg-slate-950 border-2 border-slate-800 rounded-full flex items-center justify-center z-[100] transition-all hover:bg-slate-900 group/navbtn shadow-[0_0_40px_rgba(0,0,0,0.9)]"
          style={{ borderColor: currentTheme.hex }}
        >
          {/* Internal Circle Wrapper */}
          <div 
            className="w-9 h-9 rounded-full border border-slate-700/50 flex items-center justify-center transition-all group-hover/navbtn:border-slate-300"
            style={{ borderColor: currentTheme.hex.replace('1)', '0.2)') }}
          >
            <div className="transition-all duration-500 transform">
              {/* Corrected Arrow Direction Logic: Point RIGHT only when MICRO/HIDDEN (navLevel 2) */}
              {navLevel === 2 ? <IconExpandArrow color={currentTheme.hex} /> : <IconCollapseArrow color={currentTheme.hex} />}
            </div>
          </div>
        </button>

        <div className="flex flex-col h-full w-full overflow-hidden">
          <div className="border-b border-slate-900 p-6 h-24 flex items-center shrink-0">
            {navLevel === 0 ? (
              <h1 className="flex items-baseline font-black italic uppercase tracking-tighter">
                <span className={`text-5xl ${currentTheme.color}`}>BRO</span>
                <span className={`text-2xl opacity-80 ml-1 ${currentTheme.color}`}>TRONIC</span>
              </h1>
            ) : (
              <div className="w-full flex justify-center">
                <div className="w-10 h-10 rounded-lg border-2 flex items-center justify-center" style={{ borderColor: currentTheme.hex }}>
                  <span className={`font-black italic text-xl ${currentTheme.color}`}>B</span>
                </div>
              </div>
            )}
          </div>
          <div className={`flex-1 p-4 space-y-2 overflow-y-auto transition-opacity duration-300 ${navLevel === 2 ? 'opacity-0' : 'opacity-100'}`}>
             <NavItem mode="parview" />
             <NavItem mode="tuner" />
             <NavItem mode="discovery" />
             <NavItem mode="hexEdit" />
             <NavItem mode="library" />
          </div>
          <div className={`p-4 border-t border-slate-900 shrink-0 space-y-2 transition-opacity duration-300 ${navLevel === 2 ? 'opacity-0' : 'opacity-100'}`}>
             <button 
               onClick={(e) => { e.stopPropagation(); setShowUnloadConfirm(true); }} 
               disabled={!rom} 
               title="Unload ROM"
               className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase bg-slate-800/50 text-slate-500 border border-slate-800 disabled:opacity-20 transition-all hover:text-red-400 flex items-center justify-center ${navLevel === 0 ? 'space-x-2' : ''}`}
             >
               <IconUnload />
               {navLevel === 0 && <span>UNLOAD ROM</span>}
             </button>
             <button 
               onClick={(e) => { e.stopPropagation(); handleSaveRom(); }} 
               disabled={!rom} 
               title="Export ROM & DEF"
               className={`w-full py-3 rounded-xl text-[10px] font-black uppercase bg-slate-800 text-slate-400 border border-slate-700 disabled:opacity-20 transition-all flex items-center justify-center ${navLevel === 0 ? 'space-x-2' : ''}`}
             >
               <IconExport />
               {navLevel === 0 && <span>EXPORT ROM&DEF</span>}
             </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-950 relative overflow-hidden">
        {activeView === 'library' ? (
          <LibraryModule 
            library={library} 
            rom={rom} 
            activeDefinition={activeDefinition}
            onSelectMap={(id) => setSelectedMapId(id)}
            onAddActiveMap={m => setRom(p => p ? {...p, detectedMaps: [m, ...p.detectedMaps]} : null)}
            onUpdateActiveMap={(up, id) => setRom(p => p ? {...p, detectedMaps: p.detectedMaps.map(m => m.id === id ? {...m, ...up} : m)} : null)}
            onDeleteActiveMap={id => setRom(p => p ? {...p, detectedMaps: p.detectedMaps.filter(m => m.id !== id)} : null)}
            onUpdateLibraryMap={(vid, mid, up) => setLibrary(prev => prev.map(v => v.id === vid ? { ...v, maps: v.maps.map(m => m.id === mid ? { ...m, ...up } : m) } : v))}
            onDeleteLibraryMap={(vid, mid) => setLibrary(prev => prev.map(v => v.id === vid ? { ...v, maps: v.maps.filter(m => m.id !== mid) } : v))}
            onAddLibraryMap={(vid, nm) => setLibrary(prev => prev.map(v => v.id === vid ? { ...v, maps: [nm, ...v.maps] } : v))}
            onAddVersion={v => setLibrary(prev => [v, ...prev])}
            onUpdateFullVersion={v => setLibrary(prev => prev.map(o => o.id === v.id ? v : o))}
            onApplyLibrary={maps => { 
               setRom(prev => prev ? {...prev, detectedMaps: JSON.parse(JSON.stringify(maps))} : null); 
               const match = library.find(v => v.maps === maps);
               if (match) setActiveDefinition(match);
               setActiveView('tuner'); 
            }}
            onSaveActiveToLibrary={handleSaveActiveToLibrary}
          />
        ) : rom ? (
          <>
            {activeView === 'tuner' && (
              <TunerModule 
                rom={rom} 
                activeDefinition={activeDefinition}
                selectedMapId={selectedMapId} 
                setSelectedMapId={setSelectedMapId} 
                editingData={editingData} 
                onUpdateValue={handleUpdateValue} 
              />
            )}
            {activeView === 'discovery' && (
              <DiscoveryModule 
                rom={rom} 
                activeDefinition={activeDefinition} 
                lastNavRequest={lastNavRequest?.module === 'discovery' ? lastNavRequest : undefined}
                onAddMapDefinition={m => setRom(p => p ? {...p, detectedMaps: [m, ...p.detectedMaps]} : null)} 
              />
            )}
            {activeView === 'hexEdit' && (
              <SurgeryModule 
                rom={rom} 
                activeDefinition={activeDefinition}
                lastNavRequest={lastNavRequest?.module === 'hexEdit' ? lastNavRequest : undefined}
                onUpdateByte={(o, v) => {
                  const newData = new Uint8Array(rom.data);
                  newData[o] = v;
                  setRom({...rom, data: newData});
                }} 
              />
            )}
            {activeView === 'parview' && <ParserViewer rom={rom} activeDefinition={activeDefinition} onNavigate={handleTeleport} />}
            {activeView === 'compare' && <CompareModule rom={rom} activeDefinition={activeDefinition} />}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-12 text-center">
            <div className="max-w-md space-y-6">
               <button 
                 onClick={() => setShowLoader(true)}
                 className="w-24 h-24 rounded-3xl flex items-center justify-center mx-auto border-2 transition-all hover:scale-110 active:scale-95 hover:bg-slate-900/50 cursor-pointer shadow-2xl group" 
                 style={{ 
                   color: currentTheme.hex, 
                   borderColor: currentTheme.hex, 
                   boxShadow: `0 0 80px ${currentTheme.hex}, 0 0 160px ${currentTheme.hex}80, inset 0 0 40px ${currentTheme.hex}` 
                 }}
               >
                 <div className="scale-150 transition-transform group-hover:scale-[1.7]" style={{ filter: `drop-shadow(0 0 30px ${currentTheme.hex}) drop-shadow(0 0 60px ${currentTheme.hex}80)` }}>
                   {React.createElement(currentTheme.icon)}
                 </div>
               </button>
               <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter" style={{ textShadow: `0 0 40px ${currentTheme.hex}` }}>Initialize {currentTheme.label}</h2>
               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em] italic opacity-50">Click Icon To Load Binary Context</p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
