import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../src/store';
import { useHistoryStore, cleanEntry, type HistoryEntry } from '../../src/store/history';
import { presetPatch } from '../../src/converters/presets';
import { executeConversion } from '../../src/converters/execution';
import { invoke } from '@tauri-apps/api/core';
vi.mock('@tauri-apps/api/core',()=>({invoke:vi.fn()}));
const entry=(n=1):HistoryEntry=>({id:String(n),kind:'conversion',name:'sample.png',inputPaths:['/sample.png'],target:'jpg',startedAt:n,finishedAt:n,status:'done',options:{quality:88}});
beforeEach(()=>{
  useHistoryStore.getState().clear();
  useAppStore.setState({files:[],selectedPreset:'original',batchRunning:false,batchStopRequested:false});
  useAppStore.getState().updateSettings({outputDirectory:undefined,quality:92});
  localStorage.clear();vi.mocked(invoke).mockReset();
  vi.mocked(invoke).mockImplementation(async command=>command==='get_file_info'?{size_bytes:100,output_formats:['jpg','png','webp']}:undefined);
});
describe('1.3 conversion workflows',()=>{
  it('applies matching presets only and uses them for later additions',async()=>{
    await useAppStore.getState().addFilePaths(['/a.png']);
    const result=useAppStore.getState().applyPreset('webp');
    expect(result).toEqual({applied:1,skipped:0});
    await useAppStore.getState().addFilePaths(['/b.png']);
    for(const file of useAppStore.getState().files){expect(file.targetFormat).toBe('webp');expect(file.options?.quality).toBe(82);}
    const file=useAppStore.getState().files[0];const settings=useAppStore.getState().settings;
    expect(presetPatch({...file,status:'done'},'jpg',settings)).toBeNull();
    expect(presetPatch({...file,category:'audio'},'jpg',settings)).toBeNull();
    expect(presetPatch({...file,allowedFormats:['png']},'jpg',settings)).toBeNull();
    useAppStore.getState().applyPreset('original');expect(useAppStore.getState().files[0].options).toBeUndefined();
  });
  it('records separate attempts with immutable snapshots and synchronizes saving',async()=>{
    await useAppStore.getState().addFilePaths(['/a.png']);useAppStore.getState().applyPreset('jpg');
    const file=useAppStore.getState().files[0];
    vi.mocked(invoke).mockResolvedValue({output_path:'/tmp/a.jpg',size_bytes:50,output_extension:'jpg'});
    await executeConversion(file);const first=useHistoryStore.getState().entries[0];
    expect(first.status).toBe('done');expect(first.options?.quality).toBe(88);expect(first.outputSize).toBe(50);
    useAppStore.getState().updateFile(file.id,{savedPath:'/saved/a.jpg'});
    expect(useHistoryStore.getState().entries[0].savedPath).toBe('/saved/a.jpg');
    useAppStore.getState().updateSettings({quality:10});
    await executeConversion({...file,options:{quality:10}});
    expect(useHistoryStore.getState().entries).toHaveLength(2);
    expect(useHistoryStore.getState().entries.find(e=>e.id===first.id)?.options?.quality).toBe(88);
  });
  it('records cancellation, failure and automatic save errors accurately',async()=>{
    await useAppStore.getState().addFilePaths(['/a.png']);const file=useAppStore.getState().files[0];
    vi.mocked(invoke).mockRejectedValueOnce('任务已取消');await executeConversion(file);
    expect(useHistoryStore.getState().entries[0].status).toBe('cancelled');
    vi.mocked(invoke).mockRejectedValueOnce('broken image');await executeConversion(file);
    expect(useAppStore.getState().files[0].status).toBe('error');
    useAppStore.getState().updateSettings({outputDirectory:'/saved'});
    vi.mocked(invoke).mockResolvedValueOnce({output_path:'/tmp/a.jpg',size_bytes:50}).mockRejectedValueOnce('disk full');
    await executeConversion(file);const final=useHistoryStore.getState().entries.find(e=>e.status==='done')!;
    expect(final.savedPath).toBeUndefined();expect(final.warnings?.[0]).toContain('disk full');
  });
  it('retries with recorded settings and rejects missing files/targets',async()=>{
    await useAppStore.getState().retryConversion(entry());
    expect(useAppStore.getState().files[0].options?.quality).toBe(88);
    expect(useAppStore.getState().files[0].status).toBe('idle');
    const before=useAppStore.getState().files.length;
    vi.mocked(invoke).mockRejectedValueOnce('missing');await expect(useAppStore.getState().retryConversion(entry())).rejects.toBe('missing');
    expect(useAppStore.getState().files).toHaveLength(before);
    await expect(useAppStore.getState().retryConversion({...entry(),target:'fake'})).rejects.toThrow('Target unavailable');
    expect(useAppStore.getState().files).toHaveLength(before);
  });
  it('bounds history, upserts idempotently and excludes unknown secret fields',()=>{
    for(let n=0;n<110;n++)useHistoryStore.getState().put(entry(n));
    expect(useHistoryStore.getState().entries).toHaveLength(100);
    const test=entry(109);useHistoryStore.getState().put(test);expect(useHistoryStore.getState().entries).toHaveLength(100);
    test.options!.quality=5;expect(useHistoryStore.getState().entries[0].options?.quality).toBe(88);
    expect(cleanEntry({...entry(),password:'secret'} as HistoryEntry)).not.toHaveProperty('password');
    const stored=localStorage.getItem('vert-enhanced-history')!;expect(JSON.parse(stored).version).toBe(1);
    useHistoryStore.getState().clear();expect(useHistoryStore.getState().entries).toHaveLength(0);
  });
});
