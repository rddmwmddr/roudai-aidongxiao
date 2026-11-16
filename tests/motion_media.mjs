import fs from 'node:fs';import assert from 'node:assert/strict';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';
import {chromium} from '../scripts/node_modules/playwright-core/index.mjs';
const O=createRequire(import.meta.url)('../src/opus_config.js'),out='质检/paper';
const invalid=O.defaults('number-counter');invalid.audio.gain=-1;assert.throws(()=>O.validate(invalid),/audio.gain/);
const legacy=O.defaults('text-match-cut');delete legacy.audio;delete legacy.timeline.pauses;assert.deepEqual(O.validate(legacy).timeline.pauses,[]);
const b=await chromium.launch({channel:'chrome'});try{
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(pathToFileURL(process.cwd()+'/dist/肉呆爱动效.html').href);await p.waitForFunction(()=>DMApp?.ready);
 const result=await p.evaluate(async()=>{
  const cookie=Uint8Array.from("038080802200000004808080144014001800000000000000000005808080021190068080800102".match(/../g),x=>parseInt(x,16));
  const normalized=DM.Audio.aacMetadata({decoderConfig:{description:cookie.buffer}});if([...new Uint8Array(normalized.decoderConfig.description)].join()!=="17,144")throw new Error("WebKit AAC cookie normalization");
  const c=DMOpus.defaults('number-counter');c.data={keyframes:[[0,0],[.2,2],[.5,10],[.8,200],[1,200]]};c.timeline.pauses=[{id:'hold-1',at:1.5,duration:.75}];c.timeline.duration+=.75;c.output={width:960,height:540,fps:30};c.audio.enabled=true;c.audio.auto.enabled=true;
  const sample=DM.Audio.builtin('builtin:tick'),wav=new ArrayBuffer(44+sample.length*2),v=new DataView(wav),write=(at,s)=>Array.from(s).forEach((c,i)=>v.setUint8(at+i,c.charCodeAt(0)));write(0,'RIFF');v.setUint32(4,wav.byteLength-8,true);write(8,'WAVEfmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,48000,true);v.setUint32(28,96000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);write(36,'data');v.setUint32(40,wav.byteLength-44,true);for(let i=0;i<sample.length;i++)v.setInt16(44+i*2,sample.getChannelData(0)[i]*32767,true);
  const uri='data:audio/wav;base64,'+btoa(String.fromCharCode(...new Uint8Array(wav))),info=await DM.Audio.assetInfo(uri);c.audio.assets=[{id:'local-tick',name:'自制轻点.wav',src:uri,duration:info.duration}];c.audio.clips=[{id:'clip-1',sourceId:'local-tick',start:.2,trimStart:0,trimEnd:info.duration,volume:.5,rate:1,fadeIn:.002,fadeOut:.008}];DMOpus.validate(c);
  const event=DM.Audio.events(c),buffer=await DM.Audio.render(c),samples=buffer.getChannelData(0),holdPeak=Math.max(...samples.slice(Math.round(1.6*48000),Math.round(2.2*48000)).map(Math.abs));
  const draw=t=>{const cv=document.createElement('canvas');cv.width=960;cv.height=540;DM.createScene({...DMOpus.row(c),template:c.templateId},960).draw(cv.getContext('2d'),t);return cv.toDataURL()};const frozen=draw(1.6)===draw(2.1);
  const sixty=structuredClone(c);sixty.output.fps=60;const fpsInvariant=JSON.stringify(event)===JSON.stringify(DM.Audio.events(sixty));
  const rendered=await DM.exportMP4({...DMOpus.row(c),template:c.templateId});const mp4=await new Promise(ok=>{const r=new FileReader();r.onload=()=>ok(r.result);r.readAsDataURL(rendered.blob)});
  return {config:c,event,holdPeak,frozen,fpsInvariant,wav:uri,mp4};
 });
 assert.equal(result.frozen,true);assert.equal(result.fpsInvariant,true);assert.ok(result.holdPeak<.00001,'hold should be silent');assert.ok(result.event.length>10);
 fs.writeFileSync(out+'/数字变速-停顿-音效.mp4',Buffer.from(result.mp4.split(',')[1],'base64'));delete result.mp4;
 fs.writeFileSync('examples/paper/assets/自制轻点.wav',Buffer.from(result.wav.split(',')[1],'base64'));delete result.wav;
 fs.writeFileSync(out+'/数字变速-停顿-音效.dmboard',JSON.stringify({title:'演示数据 · 变速卡点与中途停顿',rows:[O.row(result.config)]},null,2));
 const paper=O.defaults('text-match-cut');await p.evaluate(c=>{DMApp.rows.splice(0,DMApp.rows.length,DMOpus.row(c));DMApp.select(0)},paper);await p.waitForTimeout(300);
 const canvas=p.locator('#cv'),rect=await canvas.boundingBox();await p.locator('.dme').dblclick({position:{x:rect.width/2,y:rect.height*.38}});const dialog=p.locator('dialog');await dialog.waitFor();const text=dialog.getByRole('textbox',{name:'固定关键词'});assert.equal(await text.inputValue(),'用户体验');await text.fill('真实使用体验');await dialog.getByRole('button',{name:'应用文字'}).click();await p.waitForFunction(()=>DMApp.rows[0].motion.options.keyword==='真实使用体验');
 if(!await p.locator('#mediaEditor').isVisible())await p.locator('#btnInspector').click();const media=p.locator('#mediaEditor');await media.locator('summary').click();await p.locator('#mediaAddPause').click();await p.waitForFunction(()=>DMApp.rows[0].motion.timeline.pauses.length===1);
 const hold=p.locator('[data-pause="0:duration"][type=range]');await hold.fill('1.75');await hold.dispatchEvent('change');await p.waitForFunction(()=>DMApp.rows[0].motion.timeline.pauses[0].duration===1.75);
 await p.locator('#mediaImportAudio').setInputFiles('examples/paper/assets/自制轻点.wav');await p.waitForFunction(()=>DMApp.rows[0].motion.audio.assets.length===1);await p.locator('#mediaAddClip').click();await p.waitForFunction(()=>DMApp.rows[0].motion.audio.clips.length===1);
 const saved=await p.evaluate(()=>({title:'文字停顿音效 · 人工编辑',rows:structuredClone(DMApp.rows)}));fs.writeFileSync(out+'/文字-停顿-音效-人工编辑.dmboard',JSON.stringify(saved,null,2));fs.writeFileSync(out+'/motion-media-acceptance.json',JSON.stringify({...result,copyPasteTextEditing:true,pauseSlider:true,audioImport:true,manualClip:true},null,2));assert.deepEqual(errors,[]);console.log('PASS editable Canvas text, hold slider, imported audio, manual trim and automatic numeric AAC export; events',result.event.length);
}finally{await b.close()}
