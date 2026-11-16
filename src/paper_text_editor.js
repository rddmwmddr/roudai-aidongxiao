// Real text editing above the Canvas; image-only backgrounds never own the words.
(function(root){const D=root.DM;
 function bind(o){
  o.surface.addEventListener('dblclick',e=>{
   const raw=o.raw();if(raw?.motion?.templateId!=='text-match-cut')return;
   const c=root.DMOpus.validate(raw.motion),inside=D.MotionMedia.inner(c),r=o.canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*1920,y=(e.clientY-r.top)/r.height*(1920*c.output.height/c.output.width);
   const hit=D.PaperPress.textAt(inside,D.MotionMedia.motionTime(c,o.time()),x,y);if(!hit)return;e.preventDefault();e.stopImmediatePropagation();o.pause();
   const dialog=document.createElement('dialog');dialog.style.cssText='width:min(540px,85vw);border:1px solid #bbb;border-radius:14px;background:#F7F1E8;color:#25251F;padding:22px;font:14px system-ui;box-shadow:0 14px 60px #0005';
   const title=document.createElement('h3');title.textContent='编辑'+hit.label;title.style.marginTop='0';const hint=document.createElement('p');hint.textContent='可选中文字复制、粘贴；应用后保留纸张、节奏与高亮设置。';
   const field=document.createElement('textarea');field.setAttribute('aria-label',hit.label);field.value=hit.value;field.rows=hit.label==='正文'?10:3;field.style.cssText='box-sizing:border-box;width:100%;padding:12px;font:17px/1.6 system-ui;user-select:text;-webkit-user-select:text;border:1px solid #aaa;border-radius:8px;resize:vertical;background:#fff;color:#222';
   const error=document.createElement('p');error.setAttribute('role','alert');error.style.color='#b23b25';const bar=document.createElement('div');bar.style.cssText='display:flex;justify-content:flex-end;gap:12px;margin-top:16px';
   const cancel=document.createElement('button');cancel.textContent='取消';const apply=document.createElement('button');apply.textContent='应用文字';for(const b of [cancel,apply])b.style.cssText='font:inherit;padding:8px 18px;border:1px solid #aaa;border-radius:8px;cursor:pointer';
   cancel.onclick=()=>dialog.close();apply.onclick=()=>{try{const latest=o.raw();if(latest?.id!==raw.id||latest?.motion?.templateId!==c.templateId)throw new Error('镜头已切换，请重新打开文字编辑');const next=root.DMOpus.validate(latest.motion);let parent=next;for(const k of hit.path.slice(0,-1))parent=parent[k];parent[hit.path.at(-1)]=field.value;o.commit(root.DMOpus.validate(next));dialog.close()}catch(e){error.textContent=e.message}};
   bar.append(cancel,apply);dialog.append(title,hint,field,error,bar);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());dialog.showModal();field.focus();field.select();
  },{capture:true});
 }
 D.PaperText={bind};
})(window);
