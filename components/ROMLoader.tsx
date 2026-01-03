
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
type SourceType = 'upload' | 'link' | 'reference';

const REFERENCE_ROMS = [
  { 
    name: 'BMW DME413 SW623 D466.29 C16x900A 94 RedLabel', 
    path: 'rom/BMW DME413 SW623 D466.29 C16x900A 94 RedLabel.bin',
    hw: '0261200413',
    sw: '1267357623'
  }
];

const ROMLoader: React.FC<ROMLoaderProps> = ({ onLoad, onCancel, themeColor = '#06b6d4' }) => {
  const [step, setStep] = useState<LoadStep>('source');
  const [sourceType, setSourceType] = useState<SourceType>('reference');
  const [error, setError] = useState<string | null>(null);
  const [tempRom, setTempRom] = useState<ROMFile | null>(null);
  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);
  const [customDef, setCustomDef] = useState<VersionInfo | null>(null);
  const [activeReference, setActiveReference] = useState<typeof REFERENCE_ROMS[0] | null>(null);

  const handleProcessBuffer = useCallback(async (buffer: ArrayBuffer, name: string) => {
    setStep('scanning');
    setError(null);
    try {
      await new Promise(r => setTimeout(r, 1200));
      const parsed = await ROMParser.parse(buffer, name);
      setTempRom(parsed);
      
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

  const handleUrlLoad = async (ref: typeof REFERENCE_ROMS[0]) => {
    setStep('scanning');
    setActiveReference(ref);
    try {
      // Use relative path - ROMLoaderService will handle subpath resolution
      const buffer = await ROMLoaderService.fetchFromUrl(ref.path);
      handleProcessBuffer(buffer, ref.name);
    } catch (err: any) {
      setError(err.message);
      setStep('source');
      setActiveReference(null);
    }
  };

  const selectedDef = useMemo(() => {
    if (!selectedDefId || selectedDefId === 'heuristic') return null;
    if (customDef && selectedDefId === 'custom') return customDef;
    return DEFINITION_LIBRARY.find(d => d.id === selectedDefId) || null;
  }, [selectedDefId, customDef]);

  const validation = useMemo(() => {
    if (!tempRom) return null;
    return ROMLoaderService.getFileValidation(tempRom.size);
  }, [tempRom]);

  const reviewStats = useMemo(() => {
    if (!tempRom) return null;
    
    const hw = tempRom.version?.hw || 'Unknown';
    const sw = tempRom.version?.sw || 'Unknown';
    const id = tempRom.version?.id || 'Unknown';
    const size = tempRom.size;
    const cs16 = tempRom.checksum16;

    const hwMatch = selectedDef ? hw.includes(selectedDef.hw) || selectedDef.hw.includes(hw) : true;
    const swMatch = selectedDef ? sw.includes(selectedDef.sw) || selectedDef.sw.includes(sw) : true;
    
    const isReferenceVerified = activeReference 
      ? (hw.includes(activeReference.hw.slice(-3)) && sw.includes(activeReference.sw.slice(-3)))
      : false;

    const getCol = (match: boolean) => match ? 'text-cyan-400' : 'text-red-500';

    return {
      hw: { val: hw, color: getCol(hwMatch) },
      sw: { val: sw, color: getCol(swMatch) },
      id: { val: id },
      size: { val: size },
      cs16: { val: `0x${cs16.toString(16).toUpperCase()}` },
      isReferenceVerified
    };
  }, [tempRom, selectedDef, activeReference]);

  const handleFinalConfirm = () => {
    if (!tempRom) return;
    let finalDef = selectedDef;
    const finalRom = { ...tempRom };
    if (finalDef) {
      finalRom.detectedMaps = JSON.parse(JSON.stringify(finalDef.maps));
    }
    onLoad(finalRom, finalDef || undefined);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onCancel} />
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[90vh]">
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

        <div className="flex-1 overflow-y-auto p-8">
          {step === 'source' && (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="flex justify-center space-x-2 p-1 bg-slate-950 border border-slate-800 rounded-2xl w-fit mx-auto">
                <button 
                  onClick={() => setSourceType('reference')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase italic transition-all ${sourceType === 'reference' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Factory Repository
                </button>
                <button 
                  onClick={() => setSourceType('upload')}
                  className={`px-6 py-2 rounded-xl text-xs font-black uppercase italic transition-all ${sourceType === 'upload' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  Local Upload
                </button>
              </div>

              {sourceType === 'reference' && (
                <div className="grid grid-cols-1 gap-4">
                  {REFERENCE_ROMS.map((ref) => (
                    <button 
                      key={ref.path}
                      onClick={() => handleUrlLoad(ref)}
                      className="group flex items-center p-5 bg-slate-950 border border-slate-800 hover:border-cyan-500/50 rounded-3xl transition-all text-left"
                    >
                      <div className="w-12 h-12 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mr-4 group-hover:bg-cyan-950 transition-colors">
                         <svg className="w-6 h-6 text-slate-500 group-hover:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                      </div>
                      <div className="flex-1">
                        <div className="text-xs font-black text-white uppercase italic truncate">{ref.name}</div>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-[9px] text-slate-600 font-mono uppercase">HW{ref.hw} / SW{ref.sw}</span>
                          <span className="text-[9px] text-cyan-900 font-bold uppercase tracking-widest italic bg-cyan-400/10 px-1.5 rounded">Verified Baseline</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {sourceType === 'upload' && (
                <label className="group flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-800 hover:border-cyan-500/50 bg-slate-950/50 rounded-3xl cursor-pointer transition-all">
                  <div className="p-4 bg-slate-900 rounded-2xl border border-slate-800 mb-4 group-hover:scale-110 transition-transform">
                    <svg className="w-8 h-8 text-slate-500 group-hover:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1M16 8l-4-4m0 0L8 8m4-4v12" /></svg>
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase italic">Drop binary here or click to browse</span>
                  <input type="file" className="hidden" accept=".bin,.rom" onChange={handleFileUpload} />
                </label>
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
                  <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Forensic Pattern Match</h3>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-widest animate-pulse">Scanning Memory Registers...</p>
               </div>
            </div>
          )}

          {step === 'review' && tempRom && reviewStats && (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-inner w-full">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">DME Identity</span>
                    {reviewStats.isReferenceVerified && (
                      <span className="text-[8px] font-black text-cyan-400 uppercase italic bg-cyan-950/50 px-1.5 py-0.5 rounded border border-cyan-500/20">Verified Match</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400 font-bold uppercase">HW:</span>
                       <span className={`text-sm font-mono font-bold ${reviewStats.hw.color}`}>{reviewStats.hw.val}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400 font-bold uppercase">SW:</span>
                       <span className={`text-sm font-mono font-bold ${reviewStats.sw.color}`}>{reviewStats.sw.val}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-inner w-full">
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Integrity Check</span>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] text-slate-400 font-bold uppercase">Size:</span>
                       <span className={`text-[10px] font-bold uppercase text-cyan-400`}>{validation?.message}</span>
                    </div>
                    <div className="flex justify-between items-center space-x-2">
                       <span className="text-[10px] text-slate-400 font-bold uppercase shrink-0">CS16:</span>
                       <span className={`text-[10px] font-mono font-black italic truncate text-right text-cyan-400`}>
                        {reviewStats.cs16.val}
                       </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Protocol Definition Registry</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-2 scrollbar-hide">
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
                      <div className="text-xs font-black text-white uppercase truncate italic">Heuristic Discovery Mode</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[9px] text-slate-500 font-mono">Dynamic Analysis</span>
                        <span className="text-[9px] text-lime-600 font-black uppercase tracking-tighter">[{tempRom.detectedMaps.length} MAPS DISCOVERED]</span>
                      </div>
                    </div>
                  </button>

                  {DEFINITION_LIBRARY.map((match) => {
                    const isSelected = selectedDefId === match.id;
                    return (
                      <button 
                        key={match.id}
                        onClick={() => { setSelectedDefId(match.id); setCustomDef(null); }}
                        className={`w-full flex items-center p-4 rounded-2xl border transition-all text-left group
                          ${isSelected ? 'bg-cyan-600/20 border-cyan-500 shadow-lg shadow-cyan-900/20' : 'bg-slate-950 border-slate-800 hover:border-slate-700'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mr-4 border transition-colors
                          ${isSelected ? 'bg-cyan-500 border-cyan-400 text-white' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-black text-white uppercase truncate italic">{match.description}</div>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-[9px] text-slate-500 font-mono">HW: {match.hw}</span>
                            <span className="text-[9px] text-cyan-600 font-black uppercase tracking-tighter">[{match.maps.length} REGISTERS]</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="p-6 bg-slate-950/50 border-t border-slate-800 flex justify-end space-x-4">
          <button onClick={onCancel} className="px-6 py-3 rounded-2xl text-xs font-black uppercase italic text-slate-500 hover:text-slate-300 transition-colors">Abort</button>
          <button 
            disabled={step !== 'review'}
            onClick={handleFinalConfirm}
            className="px-10 py-3 bg-cyan-600 disabled:opacity-20 hover:bg-cyan-500 text-white rounded-2xl text-xs font-black uppercase italic tracking-widest shadow-xl transition-all active:scale-95"
          >
            Load Environment
          </button>
        </footer>
      </div>
    </div>
  );
};

export default ROMLoader;
