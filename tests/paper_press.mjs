import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {chromium} from '../scripts/node_modules/playwright-core/index.mjs';
const require=createRequire(import.meta.url),O=require('../src/opus_config.js');
const old=O.defaults('text-match-cut');old.templateVersion='paper-canvas-1';delete old.options.contextBlur;delete old.options.articleScale;old.data.pages=old.data.pages.map(({heading,before,after,body})=>({heading,before,after,body}));
const migrated=O.validate(old);assert.equal(migrated.templateVersion,'paper-canvas-5');assert.equal(migrated.options.keyword,old.options.keyword);assert.equal(migrated.data.pages[0].focusX,.5);
const b=await chromium.launch({channel:'chrome'});
try {
 const p=await b.newPage();await p.goto('file://'+process.cwd()+'/dist/肉呆爱动效.html');await p.waitForFunction(()=>DMApp?.ready);
 const result=await p.evaluate(async()=>{
  await DM.PaperPress.prepareMaterial();const c=DMOpus.defaults('text-match-cut');c.demo=false;c.options.highlight=false;c.options.contextBlur=0;c.options.contextDimming=0;
  const row={...DMOpus.row(c),template:c.templateId},original=document.createElement('canvas');original.width=1920;original.height=1080;DM.createScene(row,1920).draw(original.getContext('2d'),.4);
  const images=[],offsets=[[60,80],[400,600]];
  c.data.pages=offsets.map(([x,y],i)=>{const cv=document.createElement('canvas');cv.width=2500;cv.height=1900;const g=cv.getContext('2d');g.fillStyle='#F4F1E9';g.fillRect(0,0,2500,1900);g.drawImage(original,x,y);const src=cv.toDataURL();images.push(src);return{heading:'自制报道排版截图 '+(i+1),before:'',after:'',body:'',image:src,focusX:(960+x)/2500,focusY:(1080*.38+y)/1900,focusWidth:280/2500,focusHeight:72/1900}});
  c.options.contextBlur=6;c.options.contextDimming=0;c.options.paperCount=2;c.options.cutSeconds=.5;DMOpus.validate(c);const raw={...DMOpus.row(c),template:c.templateId};await DM.Opus.prepareAssets(raw);
  const crops=[],frames=[];for(const t of [.4,1]){const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;DM.createScene(raw,1920).draw(cv.getContext('2d'),t);crops.push(Array.from(cv.getContext('2d').getImageData(850,390,220,40).data));frames.push(cv.toDataURL())}
  const mean=crops[0].reduce((s,v,i)=>s+Math.abs(v-crops[1][i]),0)/crops[0].length;
  return {images,frames,mean,config:c};
 });
 assert.ok(result.mean<1,'image registration pixel error '+result.mean);
 for(let i=0;i<2;i++){fs.writeFileSync(`examples/paper/assets/自制报道截图-${i+1}.png`,Buffer.from(result.images[i].split(',')[1],'base64'));fs.writeFileSync(`质检/paper/报道截图匹配-${i+1}.png`,Buffer.from(result.frames[i].split(',')[1],'base64'))}
 fs.writeFileSync('质检/paper/报道截图对齐.dmboard',JSON.stringify({title:'自制报道截图匹配演示',rows:[O.row(result.config)]},null,2));
 fs.writeFileSync('质检/paper/press-alignment.json',JSON.stringify({migration:true,imageRegistrationMeanError:result.mean,source:'self-rendered editorial screenshots'},null,2));
 console.log('PASS legacy migration and original screenshot registration, pixel error',result.mean);
}finally{await b.close()}
