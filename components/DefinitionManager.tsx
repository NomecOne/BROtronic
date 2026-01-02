
import React, { useState, useMemo, useEffect } from 'react';
import { DMEMap, VersionInfo, MapDimension, MapType, AxisSource, Axis } from '../types';

interface DefinitionManagerProps {
  library: VersionInfo[];
  maps: DMEMap[];
  onUpdateActive: (updates: Partial<DMEMap>, mapId: string) => void;
  onDeleteActive: (mapId: string) => void;
  onAddActive: (newMap: DMEMap) => void;
  onUpdateLibrary: (versionId: string, mapId: string, updates: Partial<DMEMap>) => void;
  onDeleteLibrary: (versionId: string, mapId: string) => void;
  onAddLibrary: (versionId: string, newMap: DMEMap) => void;
  onSelect: (mapId: string) => void;
  onApplyLibrary?: (maps: DMEMap[]) => void;
  onAddVersion?: (newVersion: VersionInfo) => void;
  onUpdateFullVersion?: (version: VersionInfo) => void;
  onSaveActiveToLibrary?: (maps: DMEMap[]) => void;
  romLoaded: boolean;
}

type DefTab = 'active' | 'library';

/**
 * SUB-COMPONENTS MOVED OUTSIDE MAIN SCOPE TO PREVENT FOCUS LOSS
 */

interface AxisEditorProps {
  axKey: 'xAxis' | 'yAxis';
  axis?: Axis;
  effectiveLock: boolean;
  onUpdate: (axKey: 'xAxis' | 'yAxis', updates: Partial<Axis> | null) => void;
}

const AxisEditor: React.FC<AxisEditorProps> = ({ axKey, axis, effectiveLock, onUpdate }) => {
  if (!axis) return (
    <div className="p-4 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 flex flex-col items-center justify-center space-y-2">
      <span className="text-[10px] text-slate-600 font-bold uppercase">{axKey} Channel Closed</span>
      {!effectiveLock && (
        <button 
          onClick={() => onUpdate(axKey, { label: 'New Axis', unit: '', size: 1, offset: 0, source: AxisSource.STEP, dataSize: 8, formula: 'X' })} 
          className="px-4 py-1.5 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded text-[9px] font-black uppercase transition-all"
        >
          + Initialize Axis
        </button>
      )}
    </div>
  );

  return (
    <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 space-y-4 shadow-inner">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2 mb-2">
         <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">{axKey} Stream Definition</h4>
         {!effectiveLock && <button onClick={() => onUpdate(axKey, null)} className="text-red-500 hover:text-red-400 text-[9px] font-bold uppercase tracking-tighter hover:underline">Disable</button>}
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] text-slate-600 font-bold uppercase">Source Protocol</label>
          <select disabled={effectiveLock} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-blue-400 font-bold" value={axis.source} onChange={e => onUpdate(axKey, { source: e.target.value as AxisSource })}>
            {Object.values(AxisSource).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-slate-600 font-bold uppercase">Point Resolution</label>
          <input type="number" disabled={effectiveLock} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 font-mono" value={axis.size} onChange={e => onUpdate(axKey, { size: parseInt(e.target.value) || 1 })} />
        </div>
      </div>

      {axis.source === AxisSource.ROM && (
        <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950 rounded-lg border border-slate-800 shadow-xl">
          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 font-bold uppercase">Hex Offset</label>
            <input disabled={effectiveLock} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-500 font-mono" value={axis.offset.toString(16).toUpperCase()} onChange={e => onUpdate(axKey, { offset: parseInt(e.target.value, 16) || 0 })} />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 font-bold uppercase">Bit Depth</label>
            <select disabled={effectiveLock} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300" value={axis.dataSize} onChange={e => onUpdate(axKey, { dataSize: parseInt(e.target.value) as 8|16 })}>
              <option value={8}>8-Bit</option>
              <option value={16}>16-Bit</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] text-slate-500 font-bold uppercase">Endian</label>
            <select disabled={effectiveLock} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-300" value={axis.endian || 'be'} onChange={e => onUpdate(axKey, { endian: e.target.value as 'le'|'be' })}>
              <option value="be">Big</option>
              <option value="le">Little</option>
            </select>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-[9px] text-slate-600 font-bold uppercase">Axis Label</label>
          <input disabled={effectiveLock} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300" value={axis.label} onChange={e => onUpdate(axKey, { label: e.target.value })} />
        </div>
        <div className="space-y-1">
          <label className="text-[9px] text-slate-600 font-bold uppercase">Unit</label>
          <input disabled={effectiveLock} className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-300" value={axis.unit} onChange={e => onUpdate(axKey, { unit: e.target.value })} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[9px] text-indigo-500 font-bold uppercase">Axis Translation Formula (X = Raw)</label>
        <input disabled={effectiveLock} className="w-full bg-slate-950 border border-indigo-500/20 rounded px-2 py-2 text-xs text-indigo-300 font-mono focus:border-indigo-500/50 outline-none" value={axis.formula || 'X'} onChange={e => onUpdate(axKey, { formula: e.target.value })} />
      </div>
    </div>
  );
};

const DefinitionManager: React.FC<DefinitionManagerProps> = (props) => {
  const { library, maps, romLoaded } = props;
  const [activeTab, setActiveTab] = useState<DefTab>(romLoaded ? 'active' : 'library');
  const [isLocked, setIsLocked] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>(library[0]?.id || '');
  const [editingMapId, setEditingMapId] = useState<string | null>(null);
  const [localMap, setLocalMap] = useState<DMEMap | null>(null);

  const selectedLibrary = useMemo(() => library.find(v => v.id === selectedVersionId), [selectedVersionId, library]);
  
  const displayMaps = useMemo(() => {
    if (activeTab === 'active' && romLoaded) return maps;
    return selectedLibrary?.maps || [];
  }, [activeTab, romLoaded, maps, selectedLibrary]);

  const isCurrentTargetBuiltIn = useMemo(() => {
    if (activeTab === 'active') return false; 
    return selectedLibrary?.isBuiltIn || false;
  }, [activeTab, selectedLibrary]);

  const effectiveLock = useMemo(() => {
    if (activeTab === 'active') return isLocked;
    if (isCurrentTargetBuiltIn) return true; 
    return isLocked;
  }, [activeTab, isLocked, isCurrentTargetBuiltIn]);

  useEffect(() => {
    if (editingMapId) {
      const map = displayMaps.find(m => m.id === editingMapId);
      if (map) {
        setLocalMap(JSON.parse(JSON.stringify(map)));
      }
    } else {
      setLocalMap(null);
    }
  }, [editingMapId, displayMaps]);

  const filteredMaps = displayMaps.filter(m => 
    m.name.toLowerCase().includes(search.toLowerCase()) || 
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleLocalUpdate = (updates: Partial<DMEMap>) => {
    if (!localMap || effectiveLock) return;
    setLocalMap(prev => prev ? { ...prev, ...updates } : null);
  };

  const handleAxisUpdate = (axKey: 'xAxis' | 'yAxis', updates: Partial<Axis> | null) => {
    if (!localMap || effectiveLock) return;
    if (updates === null) {
      handleLocalUpdate({ [axKey]: undefined });
      return;
    }
    const current = localMap[axKey] || { label: 'New Axis', unit: '', size: 1, offset: 0, source: AxisSource.NONE, dataSize: 8, formula: 'X' } as Axis;
    handleLocalUpdate({ [axKey]: { ...current, ...updates } });
  };

  const handleCommitChanges = () => {
    if (!localMap || !editingMapId || effectiveLock) return;
    if (activeTab === 'active') {
      props.onUpdateActive(localMap, editingMapId);
    } else if (selectedVersionId && selectedLibrary) {
      if (props.onUpdateFullVersion) {
        const updatedMaps = selectedLibrary.maps.map(m => m.id === editingMapId ? localMap : m);
        props.onUpdateFullVersion({ ...selectedLibrary, maps: updatedMaps, version: (selectedLibrary.version || 1) + 1 });
      } else {
        props.onUpdateLibrary(selectedVersionId, editingMapId, localMap);
      }
    }
    setEditingMapId(null);
  };

  const handleCloneVersion = () => {
    if (!selectedLibrary) return;
    const newId = `user_${Date.now()}`;
    const cloned: VersionInfo = {
      ...JSON.parse(JSON.stringify(selectedLibrary)),
      id: newId,
      sw: `${selectedLibrary.sw} (USER)`,
      isBuiltIn: false,
      version: 1
    };
    if (props.onAddVersion) {
      props.onAddVersion(cloned);
      setSelectedVersionId(newId);
      setIsLocked(false);
      setActiveTab('library');
    }
  };

  const handleExportJson = () => {
    if (!selectedLibrary) return;
    const blob = new Blob([JSON.stringify(selectedLibrary, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedLibrary.hw || 'HW'}_${selectedLibrary.sw || 'SW'}_definition.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDefLabel = (v: VersionInfo) => {
    const hwPart = v.hw.slice(-3);
    const swPart = v.sw.slice(-3);
    const csPart = v.expectedChecksum16 ? `0x${v.expectedChecksum16.toString(16).toUpperCase()}` : '0x0000';
    const status = v.isBuiltIn ? ' (Locked Template)' : ' (User Workspace)';
    return `HW${hwPart}/SW${swPart}/ID${v.id}/${csPart}-${v.name || 'BRO'}${status}`;
  };

  if (localMap) {
    return (
      <div className="flex-1 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right-2 duration-200">
        <header className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button onClick={() => setEditingMapId(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-colors">
               <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div>
              <h2 className="text-xl font-bold text-white italic leading-none">{localMap.name}</h2>
              <div className="flex items-center space-x-2 mt-1.5">
                <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">{activeTab === 'active' ? 'Live Session Edit' : 'Global Definition Library'}</span>
                {effectiveLock && <span className="text-[8px] bg-red-900/40 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-md font-bold uppercase italic">Read Only (Factory)</span>}
              </div>
            </div>
          </div>
          <div className="flex space-x-2">
            {!effectiveLock && (
              <button 
                onClick={handleCommitChanges} 
                className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl transition-all italic hover:scale-105"
              >
                Commit Changes
              </button>
            )}
            <button 
              onClick={() => setEditingMapId(null)} 
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all italic"
            >
              Discard & Exit
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Identity Column */}
            <div className="xl:col-span-2 space-y-4 bg-slate-900/40 p-5 rounded-2xl border border-slate-800 shadow-inner">
               <h3 className="text-[11px] font-black text-blue-500 uppercase tracking-[0.2em] italic border-b border-slate-800 pb-2 mb-2">Map Identity & Registry</h3>
               <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase italic">Display Descriptor</label>
                    <input disabled={effectiveLock} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 outline-none" value={localMap.name} onChange={e => handleLocalUpdate({ name: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase italic">Group Category</label>
                    <input disabled={effectiveLock} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 outline-none" value={localMap.category} onChange={e => handleLocalUpdate({ category: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase italic">Z-Axis Base Address (HEX)</label>
                    <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 group focus-within:border-amber-500/50 transition-all">
                      <span className="text-slate-600 font-mono text-sm mr-2 italic">0x</span>
                      <input disabled={effectiveLock} className="bg-transparent w-full text-sm text-amber-500 font-mono uppercase focus:outline-none" value={localMap.offset.toString(16).toUpperCase()} onChange={e => handleLocalUpdate({ offset: parseInt(e.target.value, 16) || 0 })} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase italic">Physical Data Unit</label>
                    <input disabled={effectiveLock} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:border-blue-500/50 outline-none" value={localMap.unit} onChange={e => handleLocalUpdate({ unit: e.target.value })} />
                  </div>
                  <div className="col-span-2 space-y-1 pt-2 border-t border-slate-800/50 mt-2">
                    <label className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest italic">Global Normalization Formula (X = Raw Byte)</label>
                    <div className="flex space-x-4 items-center">
                       <input 
                         disabled={effectiveLock} 
                         className="flex-1 bg-slate-950 border border-indigo-500/30 rounded-xl px-4 py-3.5 font-mono text-2xl text-blue-300 shadow-2xl focus:border-indigo-500/70 focus:outline-none transition-all placeholder:text-slate-800"
                         placeholder="e.g. X * 0.75 + 12"
                         value={localMap.formula} 
                         onChange={e => handleLocalUpdate({ formula: e.target.value })} 
                       />
                       <div className="hidden lg:block text-[9px] text-slate-600 italic leading-tight max-w-[200px]">Standard JS Math notation.<br/>X represents the raw ROM value.</div>
                    </div>
                  </div>
               </div>
            </div>

            {/* Protocol Geometry Sidebar */}
            <div className="space-y-4 bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-2xl">
               <h3 className="text-[11px] font-black text-amber-500 uppercase tracking-[0.2em] italic border-b border-slate-800 pb-2 mb-2">Protocol Geometry</h3>
               <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold uppercase italic">Logical Map Structure</label>
                    <select disabled={effectiveLock} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500" value={localMap.type} onChange={e => handleLocalUpdate({ type: e.target.value as MapType })}>
                      {Object.values(MapType).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase italic">Depth (Bits)</label>
                      <select disabled={effectiveLock} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" value={localMap.dataSize} onChange={e => handleLocalUpdate({ dataSize: parseInt(e.target.value) as 8|16 })}>
                        <option value={8}>8-Bit (Byte)</option>
                        <option value={16}>16-Bit (Word)</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase italic">Endianness</label>
                      <select disabled={effectiveLock} className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100" value={localMap.endian || 'be'} onChange={e => handleLocalUpdate({ endian: e.target.value as 'le'|'be' })}>
                        <option value="be">Big (Standard)</option>
                        <option value="le">Little (Intel)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase italic">Y-Axis Count</label>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-700 text-xs font-black">ROWS:</span>
                        <input type="number" disabled={effectiveLock} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-mono" value={localMap.rows} onChange={e => handleLocalUpdate({ rows: parseInt(e.target.value) || 1 })} />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold uppercase italic">X-Axis Count</label>
                      <div className="flex items-center space-x-2">
                        <span className="text-slate-700 text-xs font-black">COLS:</span>
                        <input type="number" disabled={effectiveLock} className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-mono" value={localMap.cols} onChange={e => handleLocalUpdate({ cols: parseInt(e.target.value) || 1 })} />
                      </div>
                    </div>
                  </div>
               </div>
            </div>
          </section>

          {/* Dual Axis Configuration */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <AxisEditor axKey="xAxis" axis={localMap.xAxis} effectiveLock={effectiveLock} onUpdate={handleAxisUpdate} />
            <AxisEditor axKey="yAxis" axis={localMap.yAxis} effectiveLock={effectiveLock} onUpdate={handleAxisUpdate} />
          </section>

          {/* Documentation Section */}
          <section className="bg-slate-900/20 p-6 rounded-2xl border border-slate-800 shadow-inner space-y-4">
             <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest italic">Research & Discovery Notes</h3>
                <span className="text-[9px] text-slate-700 font-bold">INTERNAL DOCUMENTATION ENGINE</span>
             </div>
             <textarea 
               disabled={effectiveLock} 
               className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-4 text-sm text-slate-300 min-h-[160px] focus:border-slate-700 outline-none leading-relaxed transition-all italic placeholder:text-slate-800"
               placeholder="Describe functional logic, interpolation behaviors..."
               value={localMap.description || ''} 
               onChange={e => handleLocalUpdate({ description: e.target.value })} 
             />
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
      <header className="p-4 bg-slate-900 border-b border-slate-800">
        <div className="flex justify-between items-center mb-4">
           <div className="flex space-x-1 p-1 bg-slate-950 border border-slate-800 rounded-xl">
             <button onClick={() => setActiveTab('library')} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'library' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Definition Library</button>
             {romLoaded && <button onClick={() => setActiveTab('active')} className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'active' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Active Workspace</button>}
           </div>
           
           <div className="flex items-center space-x-3">
              <input type="text" placeholder="Search maps..." className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-300 w-48 outline-none focus:border-blue-500" value={search} onChange={e => setSearch(e.target.value)} />
              
              {activeTab === 'library' && isCurrentTargetBuiltIn ? (
                <div className="flex items-center space-x-2 px-3 py-1.5 bg-red-900/20 border border-red-500/30 rounded-lg text-red-400 text-[10px] font-black uppercase">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg>
                  Factory Locked
                </div>
              ) : (
                <button onClick={() => setIsLocked(!isLocked)} className={`p-2 rounded-lg border transition-all flex items-center space-x-2 ${isLocked ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-red-600/20 border-red-500/50 text-red-400'}`}>
                  {isLocked ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" /></svg> : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 002-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" /></svg>}
                  <span className="text-[10px] font-bold uppercase">{isLocked ? 'Unlock List' : 'Lock List'}</span>
                </button>
              )}
           </div>
        </div>

        {activeTab === 'library' && (
          <div className="flex items-center justify-between bg-slate-800/30 p-4 rounded-lg border border-slate-700/50">
            <div className="flex flex-col flex-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase italic">Active Library Source</span>
              <div className="flex items-center space-x-2 mt-1">
                <select className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-orange-400 font-mono focus:border-orange-500/50 outline-none w-full max-w-lg" value={selectedVersionId} onChange={e => setSelectedVersionId(e.target.value)}>
                  {library.map(v => <option key={v.id} value={v.id}>{formatDefLabel(v)}</option>)}
                </select>
                <button onClick={handleCloneVersion} className="flex items-center space-x-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600 rounded-lg text-blue-400 hover:text-white transition-all text-[10px] font-black uppercase tracking-tighter italic shadow-xl shrink-0">Clone For Edits</button>
                <button onClick={handleExportJson} className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-300 shrink-0" title="Export JSON"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg></button>
              </div>
            </div>
            {romLoaded && <button onClick={() => selectedLibrary && props.onApplyLibrary?.(selectedLibrary.maps)} className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all italic hover:scale-105 shrink-0 ml-4">Push Definitions To ROM</button>}
          </div>
        )}

        {activeTab === 'active' && (
           <div className="flex items-center justify-between bg-slate-900/50 p-4 rounded-xl border border-slate-800">
             <div className="flex flex-col">
               <span className="text-[9px] font-bold text-slate-500 uppercase italic">Binary Context Session</span>
               <h3 className="text-sm font-bold text-white mt-1 uppercase italic tracking-tighter">Live Tuning Registers <span className="text-[9px] text-slate-700 font-mono ml-2">(Session Changes)</span></h3>
             </div>
             <div className="flex items-center space-x-3">
               <button 
                onClick={() => props.onSaveActiveToLibrary?.(maps)}
                className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest italic shadow-xl transition-all"
               >
                 Save Workspace to Library
               </button>
               {!effectiveLock && (
                 <button 
                   onClick={() => {
                     const newId = `active_map_${Date.now()}`;
                     props.onAddActive({ id: newId, name: 'New Discovery Register', description: '', type: MapType.TABLE, offset: 0, dimension: MapDimension.Table2D, dataSize: 8, rows: 1, cols: 1, unit: '', category: 'Custom' });
                     setEditingMapId(newId);
                   }} 
                   className="px-4 py-2 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic shadow-xl"
                 >
                   + Map Discovery
                 </button>
               )}
             </div>
           </div>
        )}
      </header>

      <div className="flex-1 overflow-auto p-4">
        <table className="w-full text-left text-[11px] border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-900 text-slate-500 uppercase font-black tracking-widest sticky top-0 z-10">
              <th className="p-4 border-b border-slate-800 rounded-tl-xl">Descriptor</th>
              <th className="p-4 border-b border-slate-800">Category</th>
              <th className="p-4 border-b border-slate-800 text-center">Offset</th>
              <th className="p-4 border-b border-slate-800 text-center">Resolution</th>
              <th className="p-4 border-b border-slate-800 text-right rounded-tr-xl">Interface</th>
            </tr>
          </thead>
          <tbody className="bg-slate-950/50">
            {filteredMaps.map((map) => (
              <tr key={map.id} className="group hover:bg-slate-900/80 transition-all border-b border-slate-800/50">
                <td className="p-4"><div className="flex flex-col"><span className="text-slate-100 font-bold group-hover:text-blue-400 transition-colors">{map.name}</span><span className="text-[9px] text-slate-600 uppercase font-black tracking-tighter mt-0.5">{map.type}</span></div></td>
                <td className="p-4"><span className="text-slate-400 italic">{map.category}</span></td>
                <td className="p-4 font-mono text-amber-500 text-center italic">0x{map.offset.toString(16).toUpperCase()}</td>
                <td className="p-4 text-slate-500 text-center font-mono">{map.rows}x{map.cols}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end space-x-2">
                    <button onClick={() => setEditingMapId(map.id)} className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all italic ${effectiveLock ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'bg-orange-600/10 text-orange-400 border border-orange-500/30'}`}>
                      {effectiveLock ? 'View Protocol' : 'Edit Definition'}
                    </button>
                    {!effectiveLock && (
                      <button onClick={() => props.onDeleteActive(map.id)} className="p-1.5 bg-red-600/10 text-red-400 rounded hover:bg-red-600 hover:text-white transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7" /></svg>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredMaps.length === 0 && (
          <div className="p-20 text-center text-slate-700 font-black uppercase italic tracking-widest italic opacity-30">
            No Entry Registered in this Context
          </div>
        )}
      </div>
    </div>
  );
};

export default DefinitionManager;