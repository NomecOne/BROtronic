
import { useState, useCallback } from 'react';
import { ROMFile, DMEMap, VersionInfo } from '../types';
import { ROMParser } from '../services/romParser';

/**
 * useROM Hook
 * Centralizes state management for ROM loading, map selection, and definition updates.
 */
export const useROM = (library: VersionInfo[], initialDefId: string | null) => {
  const [rom, setRom] = useState<ROMFile | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null);
  const [activeDefinitionId, setActiveDefinitionId] = useState<string | null>(initialDefId);

  const handleFileUpload = useCallback(async (file: File) => {
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
  }, [library]);

  const updateMapDefinition = useCallback((updates: Partial<DMEMap>, mapId: string) => {
    setRom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        detectedMaps: prev.detectedMaps.map(m => m.id === mapId ? { ...m, ...updates } : m)
      };
    });
  }, []);

  const addMapDefinition = useCallback((newMap: DMEMap) => {
    setRom(prev => {
      if (!prev) return null;
      return {
        ...prev,
        detectedMaps: [newMap, ...prev.detectedMaps]
      };
    });
  }, []);

  const unloadRom = useCallback(() => {
    setRom(null);
    setSelectedMapId(null);
    setActiveDefinitionId(null);
  }, []);

  return {
    rom,
    setRom,
    selectedMapId,
    setSelectedMapId,
    activeDefinitionId,
    setActiveDefinitionId,
    handleFileUpload,
    updateMapDefinition,
    addMapDefinition,
    unloadRom
  };
};
