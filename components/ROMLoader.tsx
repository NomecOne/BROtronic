
import React, { useState, useCallback, useMemo } from 'react';
import { ROMFile, VersionInfo } from '../types';
import { ROMParser } from '../services/romParser';
import { ROMLoaderService } from '../services/romLoader';
import { DEFINITION_LIBRARY } from '../constants';

interface ROMLoaderProps {
  onLoad: (rom: ROMFile, definition?: VersionInfo) => void;
  onCancel: () => void;
  themeColor?: string;
}

type LoadStep = 'source' | 'scanning' | 'review';
type SourceType = 'upload' | 'link';

const ROMLoader: React.FC<ROMLoaderProps> = ({ onLoad, onCancel, themeColor = '#06b6d4' }) => {
  const [step, setStep] = useState<LoadStep>('source');
  const [sourceType, setSourceType] = useState<SourceType>('upload');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tempRom, setTempRom] = useState<ROMFile | null>(null);
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [customDef, setCustomDef] = useState<VersionInfo | null>(null);

  const handleProcessBuffer = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setStep('scanning');
    setError(null);
    try {
      // Artifical delay for "scanning" aesthetic
      await new Promise(r => setTimeout(r, 1500));
      const parsed = await ROMParser.parse(buffer, name);
      setTempRom(parsed);
      
      // Auto-select best match if available
      const suggestions = ROMLoaderService.getSuggestedDefinitions(parsed, DEFINITION_LIBRARY);
      if (suggestions.length > 0 && suggestions[0].score >= 80) {
        setSelectedDefId(suggestions[0].match.id);
      } else {
        setSelectedDefId('heuristic');
      }
      
      setStep('review');
    } catch (err: any) {
      setError(err.message || 'Failed to process binary');
      setStep('source');
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const buffer = await file.arrayBuffer();
        handleProcessBuffer(buffer, file.name);
      } catch (err) {
        setError('Failed to read file buffer');
      }
    }
  };

  const handleUrlLoad = async () => {
    if (!url) return;
    setStep('scanning');
    try {
      const buffer = await ROMLoaderService.fetchFromUrl(url);
      const name = url.split('/').pop() || 'remote_rom.bin';
      handleProcessBuffer(buffer, name);
    } catch (err: any) {
      setError(err.message);
      setStep('source');
    }
  };

  const suggestions = useMemo(() => {
    if (!tempRom) return [];
    return ROMLoaderService.getSuggestedDefinitions(tempRom, DEFINITION_LIBRARY);
  }, [tempRom]);

  const selectedDef = useMemo(() => {
    if (!selectedDefId || selectedDefId === 'heuristic') return null;
    if (customDef && selectedDefId === 'custom') return customDef;
    return DEFINITION_LIBRARY.find(d => d.id === selectedDefId) || null;
  }, [selectedDefId, customDef]);

  const validation = useMemo(() => {
    if (!tempRom) return null;
    return ROMLoaderService.getFileValidation(tempRom.size);
  }, [tempRom]);

  // Review status calculations
  const reviewStats = useMemo(() => {
    if (!tempRom) return null;
    
    const hw = tempRom.version?.hw || 'Unknown';
    const sw = tempRom.version?.sw || 'Unknown';
    const id = tempRom.version?.id || 'Unknown';
    const size = tempRom.size;
    const cs16 = tempRom.checksum16;

    // Match checking logic
    const hwMatch = selectedDef ? hw === selectedDef.hw : true;
    const swMatch = selectedDef ? sw === selectedDef.sw : true;
    const idMatch = selectedDef ? id === selectedDef.id : true;
    const sizeMatch = selectedDef?.expectedSize ? size === selectedDef.expectedSize : true;
    const cs16Match = selectedDef?.expectedChecksum16 ? cs16 === selectedDef.expectedChecksum16 : true;

    const getCol = (match: boolean) => match ? 'text-cyan-400' : 'text-red-500';

    return {
      hw: { val: hw, color: getCol(hwMatch) },
      sw: { val: sw, color: getCol(swMatch) },
      id: { val: id, color: getCol(idMatch) },
      size: { val: size, color: getCol(sizeMatch) },
      cs16: { val: `0x${cs16.toString(16).toUpperCase()}`, color: getCol(cs16Match) }
    };
  }, [tempRom, selectedDef]);

  const handleFinalConfirm = () => {
    if (!tempRom) return;
    let finalDef = selectedDef;
    
    // If a definition is selected, inject it into the ROM object before returning
    const finalRom = { ...tempRom };
    if (finalDef) {
      finalRom.detectedMaps = JSON.parse(JSON.stringify(finalDef.maps));
    }

    onLoad(finalRom, finalDef || undefined);
  };

  const handleCustomDefUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const text = await file.text();
      try {
        const def = JSON.parse(text) as VersionInfo;
        setCustomDef(def);
        setSelectedDefId('custom');
      } catch (err) {
        setError('Invalid Definition JSON');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onCancel} />
      
      {/* Modal Container */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <header className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900/50">
          <div>
            <h2 className="text-xl font-black text-white italic tracking-tight uppercase">
              Binary <span style={{ color: themeColor }}>Initialization</span>
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">DME Hardware Interface v3.3.1</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-slate-800 rounded-full text-slate-500 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {step === 'source' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-center space-x-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl w-fit mx-auto">
                <button 
                  onClick={() => setSourceType('upload')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase italic transition-all ${sourceType === 'upload' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Local Upload
                </button>
                <button 
                  onClick={() => setSourceType('link')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase italic transition-all ${sourceType === 'link' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Remote Link
                </button>
              </div>

              {sourceType === 'upload' ? (
                <label className="group flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-slate-950/50 rounded-3xl cursor-pointer transition-all">
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-slate-500 group-hover:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase italic">Drop binary here or click to browse</span>
                  <input type="file" className="hidden" accept=".bin,.rom" onChange={handleFileUpload} />
                </label>
              ) : (
                <div className="space-y-4">
                  <input 
                    type="text" 
                    placeholder="https://example.com/rom.bin"
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-sm text-cyan-400 placeholder:text-slate-700 focus:border-cyan-500 outline-none font-mono"
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                  />
                  <button 
                    onClick={handleUrlLoad}
                    className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black uppercase italic tracking-widest shadow-xl transition-all"
                  >
                    Initiate Remote Fetch
                  </button>
                </div>
              )}

              {error && (
                <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-2xl text-red-400 text-[10px] font-bold uppercase flex items-center space-x-3">
                   <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                   <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {step === 'scanning' && (
            <div className="flex flex-col items-center justify-center py-12 space-y-8 animate-in zoom-in duration-500">
               <div className="relative w-32 h-32">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-cyan-500 animate-spin" />
                  <div className="absolute inset-4 rounded-full border-4 border-slate-800 border-b-cyan-500 animate-[spin_2s_linear_infinite_reverse]" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-8 h-8 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                  </div>
               </div>
               <div className="text-center space-y-2">
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Deep Scan Protocol Active</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">Analyzing Hexadecimal Patterns...</p>
               </div>
            </div>
          )}

          {step === 'review' && tempRom && reviewStats && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              
              {/* ROM Metadata Review */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-inner w-full">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Detected Version</span>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400 font-bold uppercase">HW:</span>
                       <span className={`text-sm font-mono font-bold ${reviewStats.hw.color}`}>{reviewStats.hw.val}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400 font-bold uppercase">SW:</span>
                       <span className={`text-sm font-mono font-bold ${reviewStats.sw.color}`}>{reviewStats.sw.val}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400 font-bold uppercase">ID:</span>
                       <span className={`text-sm font-mono font-bold ${reviewStats.id.color}`}>{reviewStats.id.val}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-inner w-full">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Integrity Check</span>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400 font-bold uppercase">Size:</span>
                       <span className={`text-[10px] font-bold uppercase ${reviewStats.size.color}`}>{validation?.message}</span>
                    </div>
                    <div className="flex justify-between items-center space-x-2">
                       <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">CS16:</span>
                       <span className={`text-[10px] font-mono font-black italic truncate text-right ${reviewStats.cs16.color}`}>
                        {reviewStats.cs16.val}
                       </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Definition Selection */}
              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Protocol Definition Matching</h4>
                
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
                  {/* Option: Heuristic Parser Results */}
                  <button 
                    onClick={() => { setSelectedDefId('heuristic'); setCustomDef(null); }}
                    className={`w-full flex items-center p-4 rounded-2xl border transition-all text-left group
                      ${selectedDefId === 'heuristic' ? 'bg-lime-600/20 border-lime-500 shadow-lg shadow-lime-900/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mr-4 border transition-colors
                      ${selectedDefId === 'heuristic' ? 'bg-lime-500 border-lime-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black text-white uppercase truncate italic">Heuristic Discovery Protocol</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[9px] text-slate-500 font-mono">Dynamic Analysis</span>
                        <span className="text-[9px] text-lime-600 font-black uppercase tracking-tighter">[{tempRom.detectedMaps.length} MAPS FOUND]</span>
                      </div>
                    </div>
                  </button>

                  {suggestions.length > 0 ? (
                    suggestions.map(({ match, score, reason }) => {
                      const isSelected = selectedDefId === match.id;
                      const isPerfect = score === 100;
                      
                      return (
                        <button 
                          key={match.id}
                          onClick={() => { setSelectedDefId(match.id); setCustomDef(null); }}
                          className={`w-full flex items-center p-4 rounded-2xl border transition-all text-left group
                            ${isSelected 
                              ? (isPerfect ? 'bg-cyan-600/20 border-cyan-500 shadow-lg shadow-cyan-900/20' : 'bg-amber-600/20 border-amber-500 shadow-lg shadow-amber-900/20') 
                              : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mr-4 border transition-colors
                            ${isSelected 
                              ? (isPerfect ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-amber-500 border-amber-400 text-white') 
                              : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-black text-white uppercase truncate italic">{match.description}</div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-[9px] text-slate-500 font-mono">HW: {match.hw}</span>
                              <span className={`text-[9px] font-black uppercase tracking-tighter ${isPerfect ? 'text-cyan-600' : 'text-amber-600'}`}>[{reason}]</span>
                            </div>
                          </div>
                          <div className="text-right ml-4 shrink-0">
                            <div className={`text-xs font-black italic ${isPerfect ? 'text-cyan-400' : 'text-amber-400'}`}>{score}%</div>
                            <div className="text-[8px] text-slate-600 font-bold uppercase">Match</div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-6 bg-slate-950 border border-dashed border-slate-800 rounded-3xl text-center">
                       <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest italic">No matching definitions found in local library</p>
                    </div>
                  )}
                </div>

                {/* Additional Options */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                   <button 
                    onClick={() => { setSelectedDefId(null); setCustomDef(null); }}
                    className={`p-3 rounded-2xl border text-[10px] font-black uppercase italic transition-all
                      ${!selectedDefId && !customDef ? 'bg-slate-800 border-slate-600 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}
                   >
                     Manual Discovery Mode
                   </button>
                   <label className={`p-3 rounded-2xl border text-[10px] font-black uppercase italic transition-all cursor-pointer text-center
                     ${customDef ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300'}`}>
                     {customDef ? `Def: ${customDef.hw.slice(-4)}` : 'Upload Definition (.json)'}
                     <input type="file" className="hidden" accept=".json" onChange={handleCustomDefUpload} />
                   </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="p-6 bg-slate-950/50 border-t border-slate-800 flex justify-end space-x-4">
          <button 
            onClick={onCancel}
            className="px-6 py-3 rounded-2xl text-xs font-black uppercase italic text-slate-500 hover:text-slate-300 transition-colors"
          >
            Abort Mission
          </button>
          <button 
            disabled={step !== 'review'}
            onClick={handleFinalConfirm}
            className="px-10 py-3 bg-cyan-600 disabled:opacity-20 hover:bg-cyan-500 text-white rounded-2xl text-xs font-black uppercase italic tracking-widest shadow-xl transition-all active:scale-95"
          >
            Initialize Environment
          </button>
        </footer>

      </div>
    </div>
  );
};

export default ROMLoader;
