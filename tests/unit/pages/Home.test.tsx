import { describe,it,expect,beforeEach } from 'vitest';
import { render,screen,fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from '../../../src/pages/Home';
import { useAppStore } from '../../../src/store';
import { useHistoryStore } from '../../../src/store/history';
import '../../../src/i18n';
const show=()=>render(<MemoryRouter><Home/></MemoryRouter>);
beforeEach(()=>{useAppStore.setState({files:[],batchRunning:false});useHistoryStore.getState().clear();});
describe('Unified home workspace',()=>{
  it('offers upload and presets directly on the home page',()=>{show();expect(screen.getByRole('heading',{name:'Conversion workspace'})).toBeInTheDocument();expect(screen.getByRole('button',{name:/Drop files here/})).toBeInTheDocument();expect(screen.getByRole('heading',{name:'Quick presets'})).toBeInTheDocument();});
  it('keeps recent records collapsed until requested',()=>{useHistoryStore.getState().put({id:'one',kind:'tool',name:'sample.pdf',inputPaths:['/sample.pdf'],target:'rotate-pdf',status:'done',startedAt:1,finishedAt:2});show();const summary=screen.getByText('Recent tasks');expect(summary.closest('details')).not.toHaveAttribute('open');fireEvent.click(summary);expect(summary.closest('details')).toHaveAttribute('open');expect(screen.getByText('sample.pdf').closest('a')).toHaveAttribute('href','/history');});
});
