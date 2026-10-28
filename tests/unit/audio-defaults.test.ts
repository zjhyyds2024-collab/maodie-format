import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../src/store';
import { defaultOptions, resolvePreset, validatePreset } from '../../src/converters/presets';
import { executeConversion } from '../../src/converters/execution';
import { invoke } from '@tauri-apps/api/core';
import type { ConvertFile } from '../../src/converters/types';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
beforeEach(()=>{localStorage.clear();useAppStore.setState({files:[],toasts:[]});vi.mocked(invoke).mockReset();});
describe('automatic audio sample rate',()=>{
  it('does not send a forced rate for automatic settings and supports auto in presets',()=>{
    expect(defaultOptions({...useAppStore.getState().settings,sampleRate:0}).sampleRate).toBeUndefined();
    expect(resolvePreset('mp3')).toMatchObject({options:{sampleRate:0}});
    expect(validatePreset('mp3',{name:'Auto Opus',format:'opus',options:{audioBitrate:192,sampleRate:0}})).toMatchObject({options:{sampleRate:0}});
    expect(()=>validatePreset('mp3',{name:'Invalid',format:'opus',options:{audioBitrate:192,sampleRate:1}})).toThrow();
  });
  it('migrates the former hidden 44.1 kHz default without changing custom rates or locations',async()=>{
    localStorage.setItem('vert-enhanced-store',JSON.stringify({state:{settings:{sampleRate:44100,outputDirectory:'/keep',language:'fr'}},version:0}));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().settings).toMatchObject({sampleRate:0,outputDirectory:'/keep',language:'fr'});
    localStorage.setItem('vert-enhanced-store',JSON.stringify({state:{settings:{sampleRate:96000}},version:0}));
    await useAppStore.persist.rehydrate();expect(useAppStore.getState().settings.sampleRate).toBe(96000);
    localStorage.setItem('vert-enhanced-store',JSON.stringify({state:{settings:{sampleRate:44100}},version:1}));
    await useAppStore.persist.rehydrate();expect(useAppStore.getState().settings.sampleRate).toBe(44100);
  });
  it('sends the real UI options on an Opus job without inheriting a hidden forced rate',async()=>{
    const file:ConvertFile={id:'opus',filePath:'/audio.wav',name:'audio.wav',sizeBytes:100,extension:'wav',category:'audio',targetFormat:'opus',status:'idle',progress:0};
    useAppStore.setState({files:[file]});useAppStore.getState().updateSettings({sampleRate:0,outputDirectory:undefined});
    vi.mocked(invoke).mockResolvedValue({output_path:'/tmp/audio.opus',size_bytes:50,output_extension:'opus'});
    await executeConversion(file);
    expect(vi.mocked(invoke).mock.calls[0][1]?.request.options.sample_rate).toBeUndefined();
  });
});
