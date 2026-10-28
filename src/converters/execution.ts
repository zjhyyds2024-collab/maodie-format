import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store';
import { useHistoryStore, type HistoryEntry } from '../store/history';
import { isEncryptedAudio } from "./formats";
import { defaultOptions } from './presets';
import { errorMessage, outputFilename, saveInDirectory, type ConversionResult } from './tasks';
import type { ConvertFile } from './types';
export async function executeConversion(file: ConvertFile): Promise<void> {
  const store=useAppStore.getState();
  const settings={...store.settings}; const options={...defaultOptions(settings),...file.options};
  const id=crypto.randomUUID(); const startedAt=Date.now();
  const entry:HistoryEntry={id,kind:'conversion',name:file.name,inputPaths:[file.filePath],target:file.targetFormat,options,startedAt,finishedAt:startedAt,status:'error'};
  store.updateFile(file.id,{historyId:id,status:'converting',progress:0,startedAt,finishedAt:undefined,error:undefined,outputPath:undefined,savedPath:undefined,outputSizeBytes:undefined,warnings:undefined,stage:'正在转换 / Converting'});
  try {
    const result=await invoke<ConversionResult>('convert_file',{request:{job_id:file.id,input_path:file.filePath,output_format:file.targetFormat,options:{quality:options.quality,audio_bitrate:options.audioBitrate,sample_rate:options.sampleRate,preserve_metadata:options.preserveMetadata,...(isEncryptedAudio(file.extension)?{music_ekey:store.musicAccess.ekey,music_key_db:store.musicAccess.keyDatabase}:{})}}});
    Object.assign(entry,{status:'done',outputPath:result.output_path,outputSize:result.size_bytes,warnings:result.warnings,outputExtension:result.output_extension,isDirectory:result.is_directory});
    if(settings.outputDirectory) {
      try { entry.savedPath=await saveInDirectory(result.output_path,settings.outputDirectory,outputFilename(file.name,result.output_extension??file.targetFormat,result.is_directory)); }
      catch(error) {entry.warnings=[...(entry.warnings??[]),'自动保存失败 / Automatic save failed: '+errorMessage(error)];}
    }
    store.updateFile(file.id,{status:'done',progress:100,outputPath:entry.outputPath,outputSizeBytes:entry.outputSize,outputExtension:entry.outputExtension,isDirectory:entry.isDirectory,savedPath:entry.savedPath,warnings:entry.warnings});
  } catch(error) {
    entry.error=errorMessage(error);entry.status=/取消|cancel/i.test(entry.error)?'cancelled':'error';
    store.updateFile(file.id,{status:entry.status,error:entry.error,progress:0});
    if(entry.status==='error')store.addToast(entry.error,'error');
  } finally {entry.finishedAt=Date.now();store.updateFile(file.id,{finishedAt:entry.finishedAt});useHistoryStore.getState().put(entry);}
}
