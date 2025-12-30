
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { ROMFile, DMEMap, MapDimension, Endian, Axis, VersionInfo, MapType, AxisSource } from './types';
import { ROMParser } from './services/romParser';
import HexViewer from './components/HexViewer';
import ManualHexEditor from './components/ManualHexEditor';
import MapTableEditor from './components/MapTableEditor';
import Visualizer from './components/Visualizer';
import DefinitionManager from './components/DefinitionManager';
import { DEFINITION_LIBRARY } from './constants';

const PageID = ({ id }: { id: string }) => (
  <div className="absolute top-2 right-2 z-[100] pointer-events-none select-none drop-shadow-[0_0_10px_rgba(163,230,53,0.8)]">
    <span className="text-[9px] font-mono font-black text-lime-400 bg-black px-2 py-0.5 rounded border border-lime-500/50 tracking-wider">
      NODE_ID::{id}
    </span>
  </div>
);

type ViewMode = 'tuner' | 'discovery' | 'hexEdit' | 'library';

const App: React.FC = () => {
  const [rom, setRom] = useState<ROMFile | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<number[][] | null>(null);
  const [activeView, setActiveView] = useState<ViewMode>('tuner'); 
  const [isLocked, setIsLocked] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [library, setLibrary] = useState<VersionInfo[]>(DEFINITION_LIBRARY);
  const [activeDefinitionId, setActiveDefinitionId] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement> | File) => {
    const file = event instanceof File ? event : event.target.files?.[0];
    if (!file) return;

    const buffer = await file.arrayBuffer();
    const parsed = await ROMParser.parse(buffer, file.name);
    
    if (parsed.version) {
      const match = library.find(v => v.hw === parsed.version?.hw && v.sw === parsed.version?.sw);
      if (match) {
        parsed.detectedMaps = JSON.parse(JSON.stringify(match.maps));
        setActiveDefinitionId(match.id);
      }
    }

    setRom(parsed);
    setSelectedMapId(null);
    if (!(event instanceof File)) {
        setActiveView('tuner');
        if (event.target) event.target.value = '';
    }
  };

  const handleUpdateBinaryByte = (offset: number, value: number) => {
    if (!rom) return;
    const newData = new Uint8Array(rom.data);
    newData[offset] = value;
    setRom({ ...rom, data: newData });
  };

  const handleUnloadRom = () => {
    setRom(null);
    setSelectedMapId(null);
    setEditingData(null);
    setActiveView('tuner');
    setActiveDefinitionId(null);
  };

  const selectedMap = useMemo(() => {
    return rom?.detectedMaps.find(m => m.id === selectedMapId);
  }, [rom, selectedMapId]);

  useEffect(() => {
    if (rom && selectedMap) {
      const data = ROMParser.extractMapData(rom.data, selectedMap);
      setEditingData(data);
    }
  }, [rom, selectedMap]);

  const handleUpdateValue = (r: number, c: number, val: number) => {
    if (!editingData) return;
    const newData = [...editingData];
    newData[r] = [...newData[r]];
    newData[r][c] = val;
    setEditingData(newData);
  };

  const updateMapDefinition = (updates: Partial<DMEMap>, mapId: string) => {
    if (rom) {
      setRom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          detectedMaps: prev.detectedMaps.map(m => m.id === mapId ? { ...m, ...updates } : m)
        };
      });
    }
  };

  const deleteMapDefinition = (mapId: string) => {
    if (rom) {
      setRom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          detectedMaps: prev.detectedMaps.filter(m => m.id !== mapId)
        };
      });
      if (selectedMapId === mapId) setSelectedMapId(null);
    }
  };

  const addMapDefinition = (newMap: DMEMap) => {
    if (rom) {
      setRom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          detectedMaps: [newMap, ...prev.detectedMaps]
        };
      });
    }
  };

  const updateLibraryMap = (versionId: string, mapId: string, updates: Partial<DMEMap>) => {
    setLibrary(prev => prev.map(v => {
      if (v.id !== versionId) return v;
      return {
        ...v,
        maps: v.maps.map(m => m.id === mapId ? { ...m, ...updates } : m)
      };
    }));
  };

  const deleteLibraryMap = (versionId: string, mapId: string) => {
    setLibrary(prev => prev.map(v => {
      if (v.id !== versionId) return v;
      return {
        ...v,
        maps: v.maps.filter(m => m.id !== mapId)
      };
    }));
  };

  const addMapToLibrary = (versionId: string, newMap: DMEMap) => {
    setLibrary(prev => prev.map(v => {
      if (v.id !== versionId) return v;
      return {
        ...v,
        maps: [newMap, ...v.maps]
      };
    }));
  };

  const handleUpdateFullVersion = (updatedVersion: VersionInfo) => {
    setLibrary(prev => prev.map(v => v.id === updatedVersion.id ? updatedVersion : v));
  };

  const handleAddVersion = (newVersion: VersionInfo) => {
    setLibrary(prev => [...prev, newVersion]);
  };

  const applyDefinitionSet = (maps: DMEMap[], definitionId?: string) => {
    if (!rom) return;
    setRom(prev => prev ? { ...prev, detectedMaps: JSON.parse(JSON.stringify(maps)) } : null);
    setSelectedMapId(null);
    setActiveView('tuner');
    if (definitionId) setActiveDefinitionId(definitionId);
  };

  const handleSaveRom = () => {
    if (!rom) return;
    const newData = new Uint8Array(rom.data);
    
    if (selectedMap && editingData) {
        let currentOffset = selectedMap.offset;
        const step = selectedMap.dataSize / 8;
        for (let r = 0; r < selectedMap.rows; r++) {
            for (let c = 0; c < selectedMap.cols; c++) {
                const val = editingData[r][c];
                const raw = ROMParser.reverseFormula(selectedMap.formula, val, selectedMap.dataSize);
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
    newData[0xFFFE] = (newSum >> 8) & 0xFF;
    newData[0xFFFF] = newSum & 0xFF;
    const blob = new Blob([newData], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tuned_${rom.name}`;
    a.click();
  };

  const categorizedMaps = useMemo<Record<string, DMEMap[]>>(() => {
    if (!rom) return {} as Record<string, DMEMap[]>;
    return rom.detectedMaps.reduce((acc, map) => {
      const cat = map.category || 'General';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(map);
      return acc;
    }, {} as Record<string, DMEMap[]>);
  }, [rom]);

  const activeDefName = useMemo(() => {
    if (!activeDefinitionId) return rom ? 'Custom / Manual' : 'None';
    const def = library.find(v => v.id === activeDefinitionId);
    return def ? `${def.hw} - ${def.sw}` : 'Imported';
  }, [activeDefinitionId, library, rom]);

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-100 bg-slate-900">
      <aside className={`transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'w-16' : 'w-72'} bg-slate-950 border-r border-slate-800 flex flex-col shadow-2xl z-10 relative group`}>
        <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="absolute -right-3 top-20 bg-slate-800 border border-slate-700 rounded-full p-1 text-slate-400 hover:text-white hover:bg-slate-700 z-20 shadow-lg">
          {isSidebarCollapsed ? <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg> : <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>}
        </button>
        
        <div className={`border-b border-slate-800 flex flex-col ${isSidebarCollapsed ? 'items-center px-1' : ''}`}>
          <button onClick={() => { setActiveView('tuner'); setSelectedMapId(null); }} className={`w-full text-left p-6 transition-all hover:bg-slate-900 group/brand ${isSidebarCollapsed ? 'flex justify-center p-3 my-3' : ''}`}>
            {!isSidebarCollapsed ? (
              <>
                <div className="text-[8px] font-bold text-slate-600 uppercase tracking-widest mb-0.5">v1.2.0-ELITE</div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent truncate group-hover/brand:from-blue-300 group-hover/brand:to-indigo-400 transition-all">Brotronic Master</h1>
                <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-semibold truncate">3.1 / 3.3 / 3.3.1</p>
              </>
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center font-black text-white text-xl italic shadow-blue-500/20 shadow-lg group-hover/brand:scale-110 transition-transform">B</div>
            )}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
            {!isSidebarCollapsed && <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">Tuning Workflows</h2>}
            <div className="space-y-1">
              <button onClick={() => setActiveView('tuner')} className={`w-full flex items-center rounded-lg transition-all ${isSidebarCollapsed ? 'justify-center p-1' : 'px-3 py-2.5 text-xs font-bold uppercase italic tracking-wider'} ${activeView === 'tuner' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
                <svg className={`transition-all ${!isSidebarCollapsed ? 'w-5 h-5 mr-3' : 'w-10 h-10'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                {!isSidebarCollapsed && <span>Tuner Deck</span>}
              </button>

              <button onClick={() => setActiveView('discovery')} className={`w-full flex items-center rounded-lg transition-all ${isSidebarCollapsed ? 'justify-center p-1' : 'px-3 py-2.5 text-xs font-bold uppercase italic tracking-wider'} ${activeView === 'discovery' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
                <svg className={`transition-all ${!isSidebarCollapsed ? 'w-5 h-5 mr-3' : 'w-10 h-10'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                {!isSidebarCollapsed && <span>Hex Bro</span>}
              </button>

              <button onClick={() => setActiveView('hexEdit')} className={`w-full flex items-center rounded-lg transition-all ${isSidebarCollapsed ? 'justify-center p-1' : 'px-3 py-2.5 text-xs font-bold uppercase italic tracking-wider'} ${activeView === 'hexEdit' ? 'bg-red-600/20 text-red-400 border border-red-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
                <svg className={`transition-all ${!isSidebarCollapsed ? 'w-5 h-5 mr-3' : 'w-10 h-10'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                {!isSidebarCollapsed && <span>Hex Edit</span>}
              </button>

              <button onClick={() => setActiveView('library')} className={`w-full flex items-center rounded-lg transition-all ${isSidebarCollapsed ? 'justify-center p-1' : 'px-3 py-2.5 text-xs font-bold uppercase italic tracking-wider'} ${activeView === 'library' ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' : 'text-slate-400 hover:bg-slate-800'}`}>
                <svg className={`transition-all ${!isSidebarCollapsed ? 'w-5 h-5 mr-3' : 'w-10 h-10'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                {!isSidebarCollapsed && <span>Library</span>}
              </button>
            </div>
          </section>

          <section>
             {!isSidebarCollapsed && <h2 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-1">File Controls</h2>}
             <div className="space-y-2">
                <label className="block w-full cursor-pointer bg-slate-800 hover:bg-slate-700 p-2.5 border border-slate-700 rounded-lg text-center transition-all">
                  <span className="text-[10px] font-black uppercase text-blue-400">Load Binary</span>
                  <input type="file" className="hidden" accept=".bin,.rom" onChange={handleFileUpload} />
                </label>
                <button onClick={handleSaveRom} disabled={!rom} className={`w-full py-2.5 rounded-lg text-[10px] font-black uppercase border transition-all ${!rom ? 'opacity-20 border-slate-700' : 'bg-blue-600 border-blue-500 text-white shadow-lg'}`}>Export ROM</button>
                {rom && <button onClick={handleUnloadRom} className="w-full py-2 text-[9px] font-bold uppercase text-red-500 hover:bg-red-900/10 rounded">Unload</button>}
             </div>
          </section>
        </div>

        {rom && !isSidebarCollapsed && (
          <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center text-[10px]">
            <span className="text-slate-500 font-bold uppercase">Linked ID:</span>
            <span className="text-blue-400 font-mono font-bold truncate max-w-[100px]">{activeDefName}</span>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-slate-900 relative">
        {activeView === 'library' && (
          <div className="flex-1 p-6 overflow-hidden flex flex-col relative">
             <PageID id="04" />
             <DefinitionManager 
                library={library}
                maps={rom?.detectedMaps || []} 
                onUpdateActive={updateMapDefinition} 
                onDeleteActive={deleteMapDefinition} 
                onAddActive={addMapDefinition}
                onUpdateLibrary={updateLibraryMap}
                onDeleteLibrary={deleteLibraryMap}
                onAddLibrary={addMapToLibrary}
                onUpdateFullVersion={handleUpdateFullVersion}
                onAddVersion={handleAddVersion}
                onSelect={(id) => { setSelectedMapId(id); setActiveView('tuner'); }}
                onApplyLibrary={(maps) => applyDefinitionSet(maps)}
                romLoaded={!!rom}
              />
          </div>
        )}

        {activeView === 'discovery' && (
          <div className="flex-1 p-6 overflow-hidden flex flex-col relative">
            <PageID id="03" />
            <HexViewer data={rom?.data} onFileUpload={handleFileUpload} onAddDefinition={(newMap) => {
              if (rom) {
                setRom({ ...rom, detectedMaps: [newMap, ...rom.detectedMaps] });
                setSelectedMapId(newMap.id);
                setActiveView('tuner');
              }
            }} />
          </div>
        )}

        {activeView === 'hexEdit' && (
          <div className="flex-1 p-6 overflow-hidden flex flex-col relative">
             <PageID id="06" />
             <ManualHexEditor data={rom?.data} onUpdateByte={handleUpdateBinaryByte} onFileUpload={handleFileUpload} />
          </div>
        )}

        {activeView === 'tuner' && !rom && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center relative">
            <PageID id="01" />
            <h2 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">No Binary Registered</h2>
            <p className="text-slate-500 max-w-sm">Load a ROM file or start the discovery engine to begin identification.</p>
          </div>
        )}

        {activeView === 'tuner' && rom && !selectedMapId && (
          <div className="flex-1 p-8 overflow-y-auto relative">
            <PageID id="05" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(Object.entries(categorizedMaps) as [string, DMEMap[]][]).map(([category, maps]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800 pb-2 italic">{category}</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {maps.map(map => (
                      <button key={map.id} onClick={() => setSelectedMapId(map.id)} className="group flex items-center justify-between p-4 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition-all text-left">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-200 group-hover:text-blue-400">{map.name}</span>
                          <span className="text-[9px] text-slate-500 font-mono mt-1">0x{map.offset.toString(16).toUpperCase()}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeView === 'tuner' && rom && selectedMap && editingData && (
          <div className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden relative">
            <PageID id="02" />
            <header className="bg-slate-950 p-4 border border-slate-800 rounded-xl flex justify-between items-center shadow-2xl">
              <div className="flex items-center space-x-4">
                <button onClick={() => setSelectedMapId(null)} className="p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <div>
                   <h2 className="text-xl font-black text-white italic tracking-tighter uppercase">{selectedMap.name}</h2>
                   <p className="text-[9px] text-slate-500 font-mono tracking-widest">MAP_OFFSET::0x{selectedMap.offset.toString(16).toUpperCase()}</p>
                </div>
              </div>
              <div className="flex space-x-2">
                 <div className="px-3 py-1 bg-blue-900/20 border border-blue-500/20 rounded-lg text-[10px] text-blue-400 font-black uppercase italic">Z-Axis: {selectedMap.unit}</div>
                 <div className="px-3 py-1 bg-indigo-900/20 border border-indigo-500/20 rounded-lg text-[10px] text-indigo-400 font-black uppercase italic">{selectedMap.dataSize}-Bit</div>
              </div>
            </header>

            <div className="flex-1 grid grid-cols-1 xl:grid-cols-4 gap-6 overflow-hidden">
              <div className="xl:col-span-3 flex flex-col min-h-0">
                <MapTableEditor 
                  map={selectedMap} 
                  data={editingData} 
                  xAxis={ROMParser.getAxisValues(rom.data, selectedMap.xAxis)} 
                  yAxis={ROMParser.getAxisValues(rom.data, selectedMap.yAxis)} 
                  onUpdate={handleUpdateValue} 
                />
              </div>
              <div className="space-y-6 overflow-y-auto pr-1">
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl">
                  <Visualizer data={editingData} xAxis={ROMParser.getAxisValues(rom.data, selectedMap.xAxis)} yAxis={ROMParser.getAxisValues(rom.data, selectedMap.yAxis)} />
                </div>
                <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic border-b border-slate-800 pb-2">Normalization</h3>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 font-mono text-xs text-blue-300 italic shadow-inner">{selectedMap.formula}</div>
                  <p className="text-[9px] text-slate-600 leading-relaxed">Scaling logic is handled via internal transfer functions defined in the active XML/JSON overlay.</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
