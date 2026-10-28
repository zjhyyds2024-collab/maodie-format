import { test, expect } from '@playwright/test';
const bridge = `
let id=1;window.__selection=[];window.__toolRequests=[];window.__conversionRequests=[];window.__failOnce=false;window.__holdConversion=false;window.__pendingConversions={};window.__savedFiles=[];
window.__TAURI_EVENT_PLUGIN_INTERNALS__={unregisterListener(){}};
window.__TAURI_INTERNALS__={transformCallback(){return id++;},unregisterCallback(){},async invoke(cmd,args){
 if(cmd==='plugin:event|listen')return id++;
 if(cmd==='plugin:dialog|open')return window.__selection;
 if(cmd==='default_output_directory')return '/Users/test/Downloads';
 if(cmd==='open_feedback'){window.__feedback=args;return null;}
 if(cmd==='engine_status')return [];
 if(cmd==='expand_input_paths')return args.paths.flatMap(p=>p==='/fixtures/music-folder'?['/fixtures/one.qmc0','/fixtures/sub/two.kwm']:p);
 if(cmd==='plugin:dialog|save')return '/exports/results.zip';
 if(cmd==='zip_conversion_results'){window.__zipFiles=args.files;return {output_path:'/tmp/result.zip',size_bytes:100,output_extension:'zip'};}
 if(cmd==='save_file'){window.__savedFiles.push(args);return null;}
 if(cmd==='get_file_info')return {size_bytes:1000,output_formats:/[.](ncm|qmc0|kwm)$/.test(args.path.toLowerCase())?['restore-audio','mp3','flac','wav','opus']:args.path.endsWith('.wav')?['mp3','flac','opus']:args.path.endsWith('.mp4')?['mp4','mkv','webm']:['jpg','png','webp','pdf','txt']};
 if(cmd==='convert_file'){
 window.__conversionRequests.push(args.request);
 if(window.__holdConversion)return await new Promise((resolve,reject)=>{window.__pendingConversions[args.request.job_id]={resolve,reject};});
 if(window.__failOnce){window.__failOnce=false;throw '测试文件损坏，请更换源文件';}
 const actual=args.request.output_format==='restore-audio'?'mp3':args.request.output_format;return {output_path:'/tmp/result.'+actual,size_bytes:500,output_extension:actual};
 }
 if(cmd==='cancel_job'){window.__pendingConversions[args.jobId]?.reject('用户取消 / Cancelled');delete window.__pendingConversions[args.jobId];return null;}
 if(cmd==='document_tool'){window.__toolRequests.push(args.request);return {output_path:['pdf-text','ocr'].includes(args.request.operation)?'/tmp/text.txt':'/tmp/result.pdf',size_bytes:16};}
 if(cmd==='preview_file'){const png=atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=');return args.path.endsWith('.mp3')?{kind:'audio',size:500,bytes:Array.from(png,c=>c.charCodeAt(0)),audio_info:{title:'测试歌名',artist:'测试歌手',album:'测试专辑',duration:1,sample_rate:48000}}:args.path.endsWith('.txt')?{kind:'text',size:16,text:'<script>plain text</script>',truncated:false}:{kind:'image',size:500,bytes:Array.from(png,c=>c.charCodeAt(0))};}
 return null;
}};`;
test.beforeEach(async ({page})=>{await page.addInitScript({content:bridge});});
test('preset, image comparison, persisted history and conversion retry',async({page})=>{
 await page.goto('/convert');await page.getByRole('button',{name:/^图片转 WebP/}).click();
 await page.evaluate(`window.__selection=['/fixtures/photo.png']`);await page.getByRole('button',{name:/将文件拖放到此处/}).click();
 await expect(page.locator('select').first()).toHaveValue('webp');await page.getByRole('button',{name:'全部转换',exact:true}).click();
 await expect(page.getByText('结果大小：500 B')).toBeVisible();await page.getByRole('button',{name:'预览',exact:true}).click();
 await expect(page.locator('dialog img')).toBeVisible();await page.getByRole('button',{name:'对比原文件'}).click();await expect(page.locator('dialog img')).toHaveCount(2);await page.keyboard.press('Escape');
 await page.getByRole('link',{name:/任务记录/}).click();await expect(page.locator('article')).toHaveCount(1);await page.reload();await expect(page.locator('article')).toHaveCount(1);
 await page.getByRole('button',{name:'重新加入',exact:true}).click();await expect(page.getByRole('heading',{name:'转换工作台'})).toBeVisible();await expect(page.locator('select').first()).toHaveValue('webp');
});
test('tool history, text rendered as text, and tool retry',async({page})=>{
 await page.goto('/tools');await page.getByRole('button',{name:'PDF 提取文字',exact:true}).click();await page.evaluate(`window.__selection=['/fixtures/doc.pdf']`);
 await page.getByRole('button',{name:'点击添加，或将文件拖入窗口'}).click();await page.getByRole('button',{name:'开始处理',exact:true}).click();await page.getByRole('button',{name:'预览',exact:true}).click();
 await expect(page.getByText('<script>plain text</script>',{exact:true})).toBeVisible();await expect(page.locator('dialog script')).toHaveCount(0);await page.keyboard.press('Escape');
 await page.getByRole('link',{name:/任务记录/}).click();await page.getByRole('button',{name:'重新加入',exact:true}).click();await expect(page.getByRole('heading',{name:'PDF 提取文字',exact:true})).toBeVisible();await expect(page.getByText('doc.pdf',{exact:true})).toBeVisible();
});
for(const theme of ['light','dark'])test(`800px layouts fit in ${theme} mode`,async({page})=>{
 await page.setViewportSize({width:800,height:650});
 await page.addInitScript(theme=>localStorage.setItem('vert-enhanced-store',JSON.stringify({state:{settings:{language:'zh-CN',theme,quality:92,audioBitrate:192,sampleRate:44100}},version:0})),theme);
 for(const route of ['/','/convert','/tools','/tools?tool=rotate-pdf','/history','/settings']){
  await page.goto(route);await expect(page.locator('html')).toHaveClass(theme==='dark'?'dark':'');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&[...document.querySelectorAll('main')].every(e=>e.scrollWidth<=e.clientWidth))).toBe(true);
 }
});

test('edit, cancel, persist, apply and reset a quick preset', async ({page}) => {
 await page.goto('/convert');
 await page.getByRole('button',{name:'编辑 图片转 JPG',exact:true}).click();
 await page.getByLabel('预设名称',{exact:true}).fill('我的网页图片');
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await expect(page.getByRole('button',{name:'我的网页图片',exact:false})).toHaveCount(0);
 await page.getByRole('button',{name:'编辑 图片转 JPG',exact:true}).click();
 await page.getByLabel('预设名称',{exact:true}).fill('我的网页图片');
 await page.getByLabel('输出格式',{exact:true}).selectOption('webp');
 await page.getByRole('dialog').getByRole('slider').press('Home');await page.getByRole('dialog').getByRole('slider').press('ArrowRight');
 await page.getByRole('button',{name:'保存预设',exact:true}).click();
 await page.reload();await page.getByRole('button',{name:'我的网页图片',exact:false}).filter({hasNot:page.locator('svg')}).click();
 await page.evaluate(`window.__selection=['/fixtures/photo.png']`);await page.getByRole('button',{name:/将文件拖放到此处/}).click();
 await expect(page.locator('select').first()).toHaveValue('webp');
 await page.getByRole('button',{name:'全部转换',exact:true}).click();await expect(page.getByText('结果大小：500 B')).toBeVisible();
 const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('vert-enhanced-history')!).state.entries[0]);
 expect(record.options.quality).toBe(2);expect(record.target).toBe('webp');
 await page.getByRole('link',{name:/^转换/}).click();
 await page.getByRole('button',{name:'编辑 我的网页图片',exact:true}).click();
 await page.getByRole('button',{name:'恢复默认',exact:true}).click();
 await expect(page.getByRole('button',{name:'编辑 图片转 JPG',exact:true})).toBeVisible();
});

test('empty conversion page, clean tools, settings dialogs and save location',async({page})=>{
 await page.goto('/convert');
 await expect(page).toHaveURL('/');await expect(page.getByRole('heading',{name:'转换工作台'})).toBeVisible();
 await expect(page.getByRole('button',{name:/将文件拖放到此处/})).toBeVisible();
 await page.getByRole('link',{name:'工具箱',exact:true}).click();await expect(page.getByText('本地转换组件',{exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'压缩与解压',exact:true}).click();
 for(const name of ['文件压缩 ZIP','文件压缩 7Z','文件压缩 TAR','文件压缩 TAR.GZ','文件压缩 TAR.BZ2','文件压缩 TAR.XZ','解压压缩包']) await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 await page.getByRole('link',{name:'设置',exact:true}).click();await expect(page.getByRole('heading',{name:'关于软件',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'关于软件',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByText(/Sikander RAVATE/)).toBeVisible();await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'使用下载文件夹',exact:true}).click();await expect(page.getByText('/Users/test/Downloads',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('/Users/test/Downloads',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'反馈与建议',exact:true}).click();await expect(page.getByText('zjhyyds2024@gmail.com')).toBeVisible();await page.getByLabel('反馈内容',{exact:true}).fill('希望增加更多格式');await page.getByRole('button',{name:'打开邮件草稿'}).click();await expect(page.getByRole('status')).toContainText('邮件草稿已打开');
});

test('tool catalog search, page rotation parameters and history retry',async({page})=>{
 await page.goto('/tools');await page.getByLabel('搜索工具',{exact:true}).fill('旋转PDF');
 await expect(page.getByRole('button',{name:'旋转 PDF 页面',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'合并 PDF',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'旋转 PDF 页面',exact:true}).click();await expect(page).toHaveURL(/tool=rotate-pdf/);
 await page.evaluate(`window.__selection=['/fixtures/doc.pdf']`);await page.getByRole('button',{name:'点击添加，或将文件拖入窗口'}).click();
 await page.getByLabel('PDF pages',{exact:true}).fill('2');await page.getByLabel('旋转角度',{exact:true}).selectOption('180');await page.getByRole('button',{name:'开始处理',exact:true}).click();
 await expect(page.getByRole('heading',{name:'处理结果',exact:true})).toBeVisible();
 const request=await page.evaluate(`window.__toolRequests[0]`);expect(request.rotation).toBe(180);expect(request.pages).toBe('2');
 await page.getByRole('link',{name:/任务记录/}).click();await page.getByRole('button',{name:'重新加入',exact:true}).click();await expect(page).toHaveURL(/tool=rotate-pdf/);await expect(page.getByLabel('旋转角度',{exact:true})).toHaveValue('180');await expect(page.getByLabel('PDF pages',{exact:true})).toHaveValue('2');
 await page.getByRole('button',{name:'所有工具',exact:true}).click();await expect(page.getByLabel('搜索工具',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'删除 PDF 页面',exact:true}).click();await page.evaluate(`window.__selection=['/fixtures/doc.pdf']`);await page.getByRole('button',{name:'点击添加，或将文件拖入窗口'}).click();await expect(page.getByRole('button',{name:'开始处理',exact:true})).toBeDisabled();
});


test('mixed queue continues after a failure and retries only the failed item',async({page})=>{
 await page.goto('/');
 await page.evaluate(`window.__selection=['/fixtures/broken.png','/fixtures/music.wav','/fixtures/clip.mp4'];window.__failOnce=true;`);
 await page.getByRole('button',{name:/将文件拖放到此处/}).click();
 await expect(page.locator('.queue-file-status')).toHaveText(['等待转换','等待转换','等待转换']);
 await page.getByRole('button',{name:'全部转换',exact:true}).click();
 await expect(page.locator('.queue-file-status')).toHaveText(['转换失败','已完成','已完成']);
 await expect(page.getByRole('alert')).toContainText('测试文件损坏');
 expect(await page.evaluate(`window.__conversionRequests.length`)).toBe(3);
 await page.locator('.queue-file').first().getByRole('button',{name:'重新转换',exact:true}).click();
 await page.getByRole('button',{name:'转换未完成项',exact:true}).click();
 await expect(page.locator('.queue-file-status')).toHaveText(['已完成','已完成','已完成']);
 expect(await page.evaluate(`window.__conversionRequests.length`)).toBe(4);
});

test('stopping a queue does not start the next file and releases controls',async({page})=>{
 await page.goto('/');
 await page.evaluate(`window.__selection=['/fixtures/one.png','/fixtures/two.png','/fixtures/three.png'];window.__holdConversion=true;`);
 await page.getByRole('button',{name:/将文件拖放到此处/}).click();
 await page.getByRole('button',{name:'全部转换',exact:true}).click();
 await expect(page.locator('.queue-file-status').first()).toHaveText('正在转换');
 await expect(page.getByRole('combobox',{name:'音频采样率',exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:/继续添加文件/})).toBeDisabled();
 await page.getByRole('button',{name:'停止队列',exact:true}).click();
 await expect(page.locator('.queue-file-status')).toHaveText(['已取消','已取消','等待转换']);
 await expect(page.getByRole('combobox',{name:'音频采样率',exact:true})).toBeEnabled();
 expect(await page.evaluate(`window.__conversionRequests.length`)).toBe(2);
});

for(const theme of ['light','dark'])test(`long filenames and inspector stay usable in ${theme}`,async({page})=>{
 await page.setViewportSize({width:1200,height:800});
 await page.addInitScript(theme=>localStorage.setItem('vert-enhanced-store',JSON.stringify({state:{settings:{language:'zh-CN',theme,quality:92,audioBitrate:192,sampleRate:0}},version:1})),theme);
 await page.goto('/');
 await page.screenshot({path:`work/ui-review-20261028/empty-${theme}.png`});
 await page.evaluate(`window.__selection=Array.from({length:24},(_,i)=>'/fixtures/'+i+'-很长的中文文件名'.repeat(10)+'.png');`);
 await page.getByRole('button',{name:/将文件拖放到此处/}).click();
 const toggle=page.getByRole('button',{name:'显示转换设置',exact:true});
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','false');
 await expect(page.getByRole('complementary',{name:'转换设置',exact:true})).toHaveCount(0);
 await toggle.click();await expect(toggle).toHaveAttribute('aria-expanded','true');
 await page.getByRole('combobox',{name:'音频采样率',exact:true}).selectOption('48000');
 await page.getByRole('link',{name:'设置',exact:true}).click();
 await expect(page.getByRole('combobox',{name:'音频采样率',exact:true})).toHaveValue('48000');
 await page.getByRole('link',{name:/转换工作台/}).click();
 await page.getByRole('button',{name:'全部转换',exact:true}).click();
 await expect(page.locator('.queue-file[data-status="done"]')).toHaveCount(24);
 for(const width of [1200,800]) {
  await page.setViewportSize({width,height:800});
  expect(await page.locator('main').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await page.getByRole('button',{name:'全部下载',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'全部下载',exact:true})).toBeInViewport();
  await page.locator('main').evaluate(el=>el.scrollTop=0);
  await page.locator('.workspace-queue').evaluate(el=>el.scrollTop=0);
  await page.screenshot({path:`work/ui-review-20261028/queue-${theme}-${width}.png`});
 }
});


test('Command O opens the picker and does not open it over a preset dialog',async({page})=>{
 await page.goto('/');await page.evaluate(`window.__selection=['/fixtures/shortcut.png'];`);
 await page.keyboard.press('Meta+o');await expect(page.getByText('shortcut.png',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'编辑 图片转 JPG',exact:true}).click();
 await page.evaluate(`window.__selection=['/fixtures/should-not-open.png'];`);
 await page.keyboard.press('Meta+o');await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('button',{name:'取消',exact:true}).click();
 await expect(page.getByText('should-not-open.png',{exact:true})).toHaveCount(0);
});


test('damaged file errors have readable recovery guidance and expandable diagnostics',async({page})=>{
 await page.goto('/');
 await page.evaluate(`window.__selection=['/fixtures/damaged.png'];const original=window.__TAURI_INTERNALS__.invoke;window.__TAURI_INTERNALS__.invoke=async(cmd,args)=>{if(cmd==='convert_file')throw 'magick: improper image header test';return original(cmd,args);};`);
 await page.getByRole('button',{name:/将文件拖放到此处/}).click();
 await page.getByRole('button',{name:'全部转换',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('源文件可能损坏');
 const detail=page.locator('.queue-error-details');
 await expect(detail.locator('p')).not.toBeVisible();
 await detail.locator('summary').click();await expect(detail.locator('p')).toHaveText('magick: improper image header test');
});


test('NCM imports as audio and defaults to restoration without advertising NCM output',async({page})=>{
 await page.goto('/');await page.evaluate(`window.__selection=['/fixtures/网易云歌曲.NCM'];`);
 await page.getByRole('button',{name:/将文件拖放到此处/}).click();
 const output=page.locator('.queue-file select');await expect(output).toHaveValue('restore-audio');
 expect(await output.locator('option').allTextContents()).not.toContain('NCM（网易云）');
 await output.selectOption('flac');await page.getByRole('button',{name:'全部转换',exact:true}).click();
 await expect(page.locator('.queue-file-status')).toHaveText('已完成');
 expect(await page.evaluate(`window.__conversionRequests[0].output_format`)).toBe('flac');
});


test('music folder, session-only keys, bounded concurrency and ZIP export',async({page})=>{
 await page.goto('/');await page.evaluate(`window.__selection='/fixtures/music-folder';`);
 await page.getByRole('button',{name:/添加文件夹/}).click();
 await expect(page.locator('.queue-file')).toHaveCount(2);
 await page.locator('.music-options summary').click();
 await page.getByRole('textbox',{name:'QQ 音乐 EKey',exact:true}).fill('PRIVATE_SESSION_ONLY_KEY');
 await page.getByRole('button',{name:'全部转换',exact:true}).click();
 await expect(page.locator('.queue-file[data-status="done"]')).toHaveCount(2);
 const storage=await page.evaluate(()=>Object.keys(localStorage).map(k=>localStorage.getItem(k)).join(''));
 expect(storage).not.toContain('PRIVATE_SESSION_ONLY_KEY');
 expect(await page.evaluate(`window.__conversionRequests[0].options.music_ekey`)).toBe('PRIVATE_SESSION_ONLY_KEY');
 await page.getByRole('button',{name:'打包 ZIP',exact:true}).click();
 await expect(page.getByText('ZIP 已保存，同名结果保留并自动编号。')).toBeVisible();
 const entries=await page.evaluate(`window.__zipFiles`);expect(entries).toHaveLength(2);
 await page.reload();await page.locator('.music-options summary').click();
 await expect(page.getByRole('textbox',{name:'QQ 音乐 EKey',exact:true})).toHaveValue('');
});


test('decoded music preview shows cover and song metadata',async({page})=>{
 await page.goto('/');await page.evaluate(`window.__selection=['/fixtures/track.ncm'];`);
 await page.getByRole('button',{name:/将文件拖放到此处/}).click();await page.getByRole('button',{name:'全部转换',exact:true}).click();
 await page.getByRole('button',{name:'预览',exact:true}).click();
 for(const text of ['测试歌名','测试歌手','测试专辑']) await expect(page.getByRole('dialog').getByText(text,{exact:true})).toBeVisible();
 await expect(page.getByRole('dialog').getByRole('img',{name:'专辑封面',exact:true})).toBeVisible();
});
