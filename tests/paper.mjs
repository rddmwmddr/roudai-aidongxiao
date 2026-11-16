// Real editor, immutable time evaluation, embedded PNG and actual H.264 output acceptance.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const require=createRequire(import.meta.url),O=require('../src/opus_config.js');
const {chromium}=createRequire(new URL('../scripts/package.json',import.meta.url))('playwright-core');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=path.join(root,'质检/paper');fs.mkdirSync(out,{recursive:true});
for(const id of O.PAPER_IDS){const c=O.defaults(id);assert.deepEqual(O.validate(O.importTable(c,O.csv(c))).data,c.data);const ai=O.fromAI(id,{data:c.data,style:{title:'AI 写入后继续人工编辑'}});assert.equal(ai.demo,false);assert.equal(ai.templateVersion,'paper-canvas-5')}
const invalid=O.defaults('text-match-cut');invalid.options.paperCount=40;invalid.options.cutSeconds=.5;assert.throws(()=>O.validate(invalid),/纸张切换总时长/);
const fold=O.defaults('paper-unfold');fold.options.segments=2;assert.throws(()=>O.validate(fold),/分段数/);
const magazine=O.defaults('magazine-letters');magazine.data.letters=O.paperLetters('中文逐字编辑');assert.equal(O.validate(magazine).data.letters.length,6);
console.log('PASS four schemas, CSV/AI round trips, precise invalid parameter rejection');
const browser=await chromium.launch({channel:'chrome',args:['--allow-file-access-from-files']});
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let board=JSON.parse(fs.readFileSync(path.join(root,'examples/paper/纸张与拼贴-演示.dmboard')));
 await page.addInitScript(board=>{window.DM_BOARD_OVERRIDE=board;localStorage.clear()},board);
 await page.goto(pathToFileURL(path.join(root,'dist/肉呆爱动效.html')).href);await page.waitForFunction(()=>window.DMApp?.ready);
 const asset=await page.evaluate(()=>{const cv=document.createElement('canvas');cv.width=cv.height=512;const g=cv.getContext('2d');g.save();g.translate(256,256);g.rotate(-.12);g.fillStyle='#243449';g.fillRect(-120,-200,240,400);g.fillStyle='#B8D6CB';g.fillRect(-105,-183,210,366);g.fillStyle='#E7B846';g.beginPath();g.arc(0,-70,65,0,Math.PI*2);g.fill();g.fillStyle='#FFFFFF';for(let i=0;i<3;i++)g.fillRect(-78,35+i*38,156,22);g.restore();return cv.toDataURL()});
 fs.mkdirSync(path.join(root,'examples/paper/assets'),{recursive:true});
 const assetPath=path.join(root,'examples/paper/assets/透明手机-自制.png');fs.writeFileSync(assetPath,Buffer.from(asset.split(',')[1],'base64'));
 board.rows[1].motion.data.items[0].src=asset;board.rows[1].motion.data.items[0].caption='透明 PNG / 自制手机示意，可在面板中替换';
 fs.writeFileSync(path.join(root,'examples/paper/纸张与拼贴-演示.dmboard'),JSON.stringify(board,null,2));
 const report=await page.evaluate(async board=>{
  const fails=[],images={},metrics=[];const catalog=DM.catalog().filter(c=>c.category==='paper');if(catalog.length!==4)fails.push('category count');
  for(const word of ['纸张','拼贴','剪贴','匹配剪辑','Paper','Match Cut'])if(catalog.filter(c=>[c.name,c.en,...c.keywords].some(v=>v.toLowerCase().includes(word.toLowerCase()))).length!==4)fails.push('search '+word);
  const draw=async(c,t)=>{const cv=document.createElement('canvas');cv.width=c.output.width;cv.height=c.output.height;const row={...DMOpus.row(c),template:c.templateId};await DM.Opus.prepareAssets(row);DM.createScene(row,c.output.width).draw(cv.getContext('2d'),t);return cv.toDataURL()};
  for(const row of board.rows){const c=DMOpus.validate(row.motion),a=await draw(c,2.5);await draw(c,.75);if(a!==await draw(c,2.5))fails.push(c.templateId+' reverse seek');
   const edited=structuredClone(c);edited.style.title='人工改写中文内容';edited.style.accent='#B44728';edited.style.ink='#604229';if(a===await draw(edited,2.5))fails.push(c.templateId+' edited pixels');
   const slow=structuredClone(c);slow.output.fps=30;if(a!==await draw(slow,2.5))fails.push(c.templateId+' fps timing');
   const portrait=structuredClone(c);portrait.output={width:1080,height:1920,fps:60};images[c.templateId+'-portrait']=await draw(portrait,2.5);images[c.templateId]=a;
   metrics.push({id:c.templateId,deterministic:true,fpsInvariant:true,version:c.templateVersion});
  }
  const match=DMOpus.defaults('text-match-cut'),anchors=[.5,1.5,2,3,4].map(t=>DM.Paper.state(match,t).anchor);if(anchors.some(p=>p.x!==anchors[0].x||p.y!==anchors[0].y))fails.push('keyword anchor');
  for(const direction of ['right','left','up','down']){const c=DMOpus.defaults('paper-unfold');c.options.direction=direction;images['fold-'+direction+'-partial']=await draw(c,1);images['fold-'+direction+'-open']=await draw(c,5)}
  return {fails,metrics,images,anchors,catalog};
 },board);
 for(const [name,uri] of Object.entries(report.images))fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(uri.split(',')[1],'base64'));delete report.images;
 assert.deepEqual(report.fails,[]);console.log('PASS catalog/search, keyword alignment, reverse seek, 30/60fps and portrait rendering');
 await page.evaluate(()=>DMApp.select(0));if(!await page.locator('#motionEditor').isVisible())await page.locator('#btnInspector').click();
 for(const [index,key,value] of [[0,'options.keyword','真实声音'],[2,'options.direction','down'],[3,'style.title','人工编辑后保存的剪字']]){
  await page.evaluate(i=>DMApp.select(i),index);const el=page.locator(`[data-motion="${key}"]`);if(!await el.isVisible())await el.locator("xpath=ancestor::details[1]").locator("summary").first().click();await el.fill(value);await el.dispatchEvent('change');
  await page.waitForFunction(({index,key,value})=>{const [a,b]=key.split('.');return DMApp.rows[index].motion[a][b]===value},{index,key,value});
 }
 await page.locator('#paperText').fill('声音被听见');await page.locator('#paperLettersApply').click();await page.waitForFunction(()=>DMApp.rows[3].motion.data.letters.map(l=>l.text).join('')==='声音被听见');
 await page.locator('#kUndo').click();assert.equal(await page.evaluate(()=>DMApp.rows[3].motion.data.letters.map(l=>l.text).join('')),'重构真实体验');
 await page.evaluate(()=>DMApp.select(1));await page.locator('[data-media="paper"]').setInputFiles(assetPath);await page.waitForFunction(()=>DMApp.rows[1].motion.data.items[0].src.startsWith('data:image/png'));
 const editedBoard=await page.evaluate(()=>({title:'纸张拼贴 · 实际编辑验收',rows:structuredClone(DMApp.rows)}));fs.writeFileSync(path.join(out,'人工编辑后.dmboard'),JSON.stringify(editedBoard,null,2));
 const reopened=await context.newPage();await reopened.addInitScript(board=>{window.DM_BOARD_OVERRIDE=board},board);await reopened.goto(pathToFileURL(path.join(root,'dist/肉呆爱动效.html')).href);await reopened.waitForFunction(()=>window.DMApp?.ready);
 assert.equal(await reopened.evaluate(()=>DMApp.rows[0].motion.options.keyword),'真实声音');assert.equal(await reopened.evaluate(()=>DMApp.rows[2].motion.options.direction),'down');
 assert.equal(await reopened.evaluate(()=>DMApp.rows[1].motion.data.items[0].src),asset);await reopened.close();
 console.log('PASS actual inspector text/parameters/PNG replacement, undo and save/reopen');
 await page.screenshot({path:path.join(out,'web-editor.png')});
 for(let i=0;i<board.rows.length;i++){
  const result=await page.evaluate(async row=>{const raw={...row,template:row.tpl},video=await DM.exportMP4(raw);const url=await new Promise(ok=>{const reader=new FileReader();reader.onload=()=>ok(reader.result);reader.readAsDataURL(video.blob)});
   const cv=document.createElement('canvas');cv.width=video.width;cv.height=video.height;const sampleTime=2.5;await DM.Opus.prepareAssets(raw);DM.createScene(raw,video.width).draw(cv.getContext('2d'),sampleTime);return {url,png:cv.toDataURL(),width:video.width,height:video.height,fps:video.fps,frames:video.frames,duration:video.duration,sampleTime};},board.rows[i]);
  fs.writeFileSync(path.join(out,board.rows[i].tpl+'.mp4'),Buffer.from(result.url.split(',')[1],'base64'));fs.writeFileSync(path.join(out,board.rows[i].tpl+'-expected.png'),Buffer.from(result.png.split(',')[1],'base64'));delete result.url;delete result.png;report.metrics[i].export=result;console.log('PASS actual 1080p60 MP4',board.rows[i].tpl,result.frames);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'acceptance.json'),JSON.stringify(report,null,2));
}finally{await browser.close()}
