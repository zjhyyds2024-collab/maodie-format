import { describe,it,expect } from 'vitest';
import { render,screen,fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Tools from '../../src/pages/Tools';
import '../../src/i18n';
const show=(route='/tools')=>render(<MemoryRouter initialEntries={[route]}><Tools/></MemoryRouter>);
describe('tool catalog',()=>{
  it('searches names ignoring spaces and switches categories',()=>{
    show();fireEvent.change(screen.getByLabelText('Search tools'),{target:{value:'rotate PDF'}});expect(screen.getByRole('button',{name:'Rotate PDF pages',exact:true})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Merge PDFs',exact:true})).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Clear search'}));fireEvent.click(screen.getByRole('button',{name:'Archives',exact:true}));expect(screen.getByRole('button',{name:'Create 7Z',exact:true})).toBeInTheDocument();expect(screen.queryByRole('button',{name:'Rotate PDF pages',exact:true})).not.toBeInTheDocument();
  });
  it('opens a single workspace, then returns to the catalog',()=>{
    show();fireEvent.click(screen.getByRole('button',{name:'Delete PDF pages',exact:true}));expect(screen.getByRole('heading',{name:'Delete PDF pages',exact:true})).toBeInTheDocument();expect(screen.queryByLabelText('Search tools')).not.toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'All tools',exact:true}));expect(screen.getByLabelText('Search tools')).toBeInTheDocument();
  });
  it('supports direct links to a tool',()=>{show('/tools?tool=rotate-pdf');expect(screen.getByRole('heading',{name:'Rotate PDF pages',exact:true})).toBeInTheDocument();expect(screen.getByLabelText('Rotation angle')).toBeInTheDocument();});
});
