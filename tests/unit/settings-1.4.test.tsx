import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { APP_VERSION } from '../../src/appInfo';
import Settings from '../../src/pages/Settings';
import { useAppStore } from '../../src/store';
import { defaultSavePath } from '../../src/converters/tasks';
import { detectCategory, getSourceFormats } from '../../src/converters/formats';
import '../../src/i18n';
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=vi.fn(function(this:HTMLDialogElement){this.open=true;});
  HTMLDialogElement.prototype.close=vi.fn(function(this:HTMLDialogElement){this.open=false;});
  useAppStore.setState({files:[],batchRunning:false,toolsRunning:false});
  useAppStore.getState().updateSettings({language:'en',outputDirectory:undefined});
  vi.mocked(open).mockReset();vi.mocked(invoke).mockReset();
});
describe('settings and archives 1.4',()=>{
  it('configures and remembers a shared save directory, and can return to manual saving',async()=>{
    render(<Settings/>);vi.mocked(open).mockResolvedValueOnce('/Users/test/Exports');
    fireEvent.click(screen.getByRole('button',{name:'Choose folder'}));
    await waitFor(()=>expect(useAppStore.getState().settings.outputDirectory).toBe('/Users/test/Exports'));
    expect(defaultSavePath('result.tar.gz')).toBe('/Users/test/Exports/result.tar.gz');
    expect(localStorage.getItem('vert-enhanced-store')).toContain('/Users/test/Exports');
    vi.mocked(invoke).mockResolvedValueOnce('/Users/test/Downloads');fireEvent.click(screen.getByRole('button',{name:'Use Downloads'}));
    await waitFor(()=>expect(useAppStore.getState().settings.outputDirectory).toBe('/Users/test/Downloads'));
    vi.mocked(open).mockResolvedValueOnce(null);fireEvent.click(screen.getByRole('button',{name:'Choose folder'}));
    await waitFor(()=>expect(open).toHaveBeenCalledTimes(2));expect(useAppStore.getState().settings.outputDirectory).toBe('/Users/test/Downloads');
    fireEvent.click(screen.getByRole('button',{name:'Save manually'}));expect(defaultSavePath('result.zip')).toBe('result.zip');
  });
  it('opens a feedback draft only on submission and does not attach paths/history',async()=>{
    render(<Settings/>);expect(invoke).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button',{name:'Feedback & suggestions'}));
    expect(screen.getByText('zjhyyds2024@gmail.com')).toBeInTheDocument();
    const send=screen.getByRole('button',{name:'Open email draft'});expect(send).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Feedback message'),{target:{value:'Please add a new format'}});
    vi.mocked(invoke).mockResolvedValueOnce(undefined);fireEvent.click(send);
    await waitFor(()=>expect(invoke).toHaveBeenCalledWith('open_feedback',{subject:`耄耋格式 ${APP_VERSION} · Suggestion`,body:`Please add a new format\n\n耄耋格式 ${APP_VERSION}`}));
    expect(screen.getByRole('status')).toHaveTextContent('Review and send');
  });
  it('detects common archives and limits non-ZIP sources to extraction',()=>{
    for(const name of ['sample.7z','sample.rar','sample.tar','sample.tar.gz','sample.tgz','sample.tar.bz2','sample.tbz2','sample.tar.xz','sample.txz','file.gz']) {
      expect(detectCategory(name)).toBe('archive');expect(getSourceFormats(name.split('.').pop()!,'archive').map(f=>f.ext)).toEqual(['unpack']);
    }
    expect(getSourceFormats('zip','archive').map(f=>f.ext)).toEqual(['unpack','pdf']);
  });
});
