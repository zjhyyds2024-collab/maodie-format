import { MemoryRouter } from "react-router-dom";
import { describe,it,expect,vi,beforeEach } from "vitest";
import { render,screen,fireEvent,waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import Tools from "../../../src/pages/Tools";
import { useHistoryStore } from "../../../src/store/history";
import { useAppStore } from "../../../src/store";
import i18n from "../../../src/i18n";
beforeEach(async()=>{useHistoryStore.getState().clear();await i18n.changeLanguage("en");vi.mocked(invoke).mockReset();vi.mocked(open).mockReset();useAppStore.setState({toasts:[],settings:{...useAppStore.getState().settings,outputDirectory:undefined}});vi.mocked(invoke).mockImplementation(async(command)=>command==="engine_status"?[]:{output_path:"/tmp/out.pdf",size_bytes:100});});
describe("PDF / OCR tools",()=>{
  it("merges in the user-selected page order",async()=>{
    vi.mocked(open).mockResolvedValue(["/files/a.pdf","/files/b.pdf"]);
    render(<MemoryRouter><Tools/></MemoryRouter>);fireEvent.click(screen.getByRole("button",{name:"Merge PDFs",exact:true}));fireEvent.click(screen.getByText("Add files or drop them into this window"));
    await screen.findByText("a.pdf");fireEvent.click(screen.getAllByTitle("Move down")[0]);
    fireEvent.click(screen.getByRole("button",{name:"Start"}));
    await waitFor(()=>expect(invoke).toHaveBeenCalledWith("document_tool",{request:expect.objectContaining({operation:"merge-pdf",input_paths:["/files/b.pdf","/files/a.pdf"]})}));
    await screen.findByText("Merge PDFs.pdf");
    expect(useHistoryStore.getState().entries[0]).toMatchObject({kind:"tool",target:"merge-pdf",status:"done",inputPaths:["/files/b.pdf","/files/a.pdf"]});
  });
  it("passes a page range and group size when splitting",async()=>{
    vi.mocked(open).mockResolvedValue(["/files/中文.pdf"]);render(<MemoryRouter><Tools/></MemoryRouter>);
    fireEvent.click(screen.getByRole("button",{name:"Split PDF"}));fireEvent.click(screen.getByText("Add files or drop them into this window"));await screen.findByText("中文.pdf");
    fireEvent.change(screen.getByLabelText("PDF pages"),{target:{value:"2-5,8"}});fireEvent.change(screen.getByLabelText("Pages per group"),{target:{value:"2"}});fireEvent.click(screen.getByRole("button",{name:"Start"}));
    await waitFor(()=>expect(invoke).toHaveBeenCalledWith("document_tool",{request:expect.objectContaining({operation:"split-pdf",pages:"2-5,8",group_size:2})}));
  });
  it("keeps batch OCR results when another file fails",async()=>{
    vi.mocked(open).mockResolvedValue(["/files/bad.png","/files/good.png"]);
    vi.mocked(invoke).mockImplementation(async(command,args)=>{
      if(command==="engine_status")return[];
      const request=(args as {request:{input_paths:string[]}}).request;
      if(request.input_paths[0].includes("bad"))throw {message:"Unreadable image"};
      return {output_path:"/tmp/good.txt",size_bytes:42};
    });
    render(<MemoryRouter><Tools/></MemoryRouter>);fireEvent.click(screen.getByRole("button",{name:"Chinese / English OCR"}));fireEvent.click(screen.getByText("Add files or drop them into this window"));await screen.findByText("good.png");fireEvent.click(screen.getByRole("button",{name:"Start"}));
    await screen.findByText("Unreadable image");await screen.findByText("good-Chinese - English OCR.txt");
    expect(vi.mocked(invoke).mock.calls.filter(([command])=>command==="document_tool")).toHaveLength(2);
  });
});

describe("Archive and password workflows",()=>{
  it("accepts arbitrary files in the ZIP tool",async()=>{
    vi.mocked(open).mockResolvedValue(["/files/data.custom","/files/photo.png"]);render(<MemoryRouter><Tools/></MemoryRouter>);
    fireEvent.click(screen.getByRole("button",{name:"Archives"}));fireEvent.click(screen.getByRole("button",{name:"Create ZIP",exact:true}));fireEvent.click(screen.getByText("Add files or drop them into this window"));await screen.findByText("data.custom");
    fireEvent.click(screen.getByRole("button",{name:"Start"}));
    await waitFor(()=>expect(invoke).toHaveBeenCalledWith("document_tool",{request:expect.objectContaining({operation:"create-zip",input_paths:["/files/data.custom","/files/photo.png"]})}));
  });
  it("clears the PDF password after the task and does not persist it",async()=>{
    vi.mocked(open).mockResolvedValue(["/files/protected.pdf"]);render(<MemoryRouter><Tools/></MemoryRouter>);
    fireEvent.click(screen.getByRole("button",{name:"Decrypt PDF"}));fireEvent.click(screen.getByText("Add files or drop them into this window"));await screen.findByText("protected.pdf");
    fireEvent.change(screen.getByLabelText("PDF password"),{target:{value:"fixture-secret"}});fireEvent.click(screen.getByRole("button",{name:"Start"}));
    await waitFor(()=>expect(invoke).toHaveBeenCalledWith("document_tool",{request:expect.objectContaining({operation:"decrypt-pdf",password:"fixture-secret"})}));
    await waitFor(()=>expect(screen.getByLabelText("PDF password")).toHaveValue(""));
    expect(localStorage.getItem("vert-enhanced-store")??"").not.toContain("fixture-secret");
    expect(localStorage.getItem("vert-enhanced-history")??"").not.toContain("fixture-secret");
    expect(useHistoryStore.getState().entries[0]).toMatchObject({kind:"tool",target:"decrypt-pdf",status:"done"});
  });
});
