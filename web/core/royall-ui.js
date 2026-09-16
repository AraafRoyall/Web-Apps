
(function(global){
  "use strict";

  const R = {
    _toastTimer:null,
    init(opts){
      opts = opts || {};
      const app = document.querySelector(opts.mount || "#app");
      if(!app) throw new Error("RoyallUI: mount element not found.");

      app.classList.add("royall-app");
      app.innerHTML = "";

      const header = el("header","royall-header");
      const icon = el("div","royall-header-icon", opts.icon || "🥏");
      const copy = el("div","royall-header-copy");
      copy.append(el("div","royall-title",opts.title || "Royall Tool"));
      copy.append(el("div","royall-description",opts.description || ""));
      const actions = el("div","royall-header-actions");
      header.append(icon,copy,actions);
      app.append(header);

      if(opts.headerButton){
        const b = button(opts.headerButton.text || "Action", opts.headerButton.className || "soft");
        if(opts.headerButton.icon) b.prepend(document.createTextNode(opts.headerButton.icon+" "));
        b.onclick = opts.headerButton.onClick || null;
        actions.append(b);
      }

      const main = el("main","royall-main");
      app.append(main);

      if(opts.status){
        const s = el("div","royall-status "+(opts.status.type || ""));
        s.innerHTML = '<span class="royall-status-main">'+(opts.status.text || "")+'</span>'
          + (opts.status.right ? '<span>'+opts.status.right+'</span>' : "");
        main.append(s);
      }

      if(opts.developer !== false){
        const foot = el("div","royall-footer");
        foot.innerHTML = '• Feature Provided by <span class="royall-developer">Araaf Royall</span> ❣️';
        app.append(foot);
      }

      return {app, main, header, actions};
    },

    box(opts){
      opts=opts||{};
      const b=el("section","royall-box");
      const h=el("div","royall-box-head");
      const left=el("div");
      left.append(el("div","royall-box-title",opts.title||""));
      if(opts.subtitle) left.append(el("div","royall-box-subtitle",opts.subtitle));
      h.append(left);
      if(opts.actions){
        const a=el("div","royall-row");
        opts.actions.forEach(x=>a.append(button(x.text,x.className||"soft",x.onClick,x.icon)));
        h.append(a);
      }
      const body=el("div","royall-box-body");
      if(opts.content) body.append(opts.content);
      b.append(h,body);
      return {el:b,body,head:h};
    },

    button(text, cls, onClick, icon){ return button(text,cls,onClick,icon); },

    textField(opts){
      opts=opts||{};
      const wrap=el("div");
      const row=el("div","royall-input-row");
      const input=document.createElement("input");
      input.className="royall-input";
      input.type=opts.type||"text";
      input.placeholder=opts.placeholder||"";
      if(opts.value!=null) input.value=opts.value;
      row.append(input);
      if(opts.actions) opts.actions.forEach(a=>row.append(button(a.text,a.className||"soft",a.onClick,a.icon)));
      wrap.append(row);
      return {el:wrap,input};
    },

    areaField(opts){
      opts=opts||{};
      const wrap=el("div");
      const ta=document.createElement("textarea");
      ta.className="royall-textarea";
      ta.placeholder=opts.placeholder||"";
      if(opts.value!=null) ta.value=opts.value;
      wrap.append(ta);
      if(opts.count){
        const c=el("div","royall-count","0 chars");
        ta.addEventListener("input",()=>c.textContent=countText(ta.value,opts.words!==false));
        wrap.append(el("div","royall-row"));
        wrap.lastChild.append(el("div","royall-spacer"),c);
      }
      return {el:wrap,textarea:ta};
    },

    chips(items, onChange){
      const row=el("div","royall-chip-row");
      let active=0;
      items.forEach((it,i)=>{
        const c=el("button","royall-chip",it.label);
        c.type="button";
        c.onclick=()=>{active=i;[...row.children].forEach((x,j)=>x.classList.toggle("active",j===i));if(onChange)onChange(it.value,it,i);};
        if(i===0)c.classList.add("active");
        row.append(c);
      });
      return {el:row,get value(){return items[active]&&items[active].value;}};
    },

    bottomBar(items, mount=document.body){
      const bar=el("div","royall-bottom-bar");
      items.forEach(it=>bar.append(button(it.text,it.className||"primary",it.onClick,it.icon)));
      mount.append(bar);
      return bar;
    },

    fab(text,onClick,cls){
      const b=button(text,cls||"primary big",onClick);
      b.classList.add("royall-fab");
      document.body.append(b);
      return b;
    },

    confirm(opts,onYes){
      opts=normalizeDialog(opts,"⚠️","Confirm");
      let dlg=dialog(opts);
      dlg.actions.append(
        button(opts.cancelText||"Cancel","soft",()=>dlg.close()),
        button(opts.confirmText||"Confirm",opts.danger!==false?"danger-soft":"primary",()=>{dlg.close();if(onYes)onYes();})
      );
      dlg.open(); return dlg;
    },

    choice(opts, choices){
      opts=normalizeDialog(opts,"🔹","Choose");
      let dlg=dialog(opts);
      (choices||[]).forEach((c,i)=>dlg.actions.append(button(c[0]||c.text||("Option "+(i+1)),c.className||"primary",()=>{dlg.close();if(c[1])c[1]();})));
      dlg.open(); return dlg;
    },

    prompt(opts,onSubmit){
      opts=normalizeDialog(opts,"✏️","Enter");
      let dlg=dialog(opts);
      const input=document.createElement("input");
      input.className="royall-input"; input.placeholder=opts.placeholder||"";
      if(opts.value!=null)input.value=opts.value;
      dlg.body.insertBefore(input,dlg.actions);
      dlg.actions.append(
        button(opts.cancelText||"Cancel","soft",()=>dlg.close()),
        button(opts.submitText||"OK","primary",()=>{const v=input.value;dlg.close();if(onSubmit)onSubmit(v);})
      );
      dlg.open(); setTimeout(()=>input.focus(),40); return dlg;
    },

    toast(text,ms){
      let t=document.querySelector(".royall-toast");
      if(!t){t=el("div","royall-toast");document.body.append(t);}
      t.textContent=text||"";
      t.classList.add("show");
      clearTimeout(R._toastTimer);
      R._toastTimer=setTimeout(()=>t.classList.remove("show"),ms||1800);
    },

    async copy(text){
      try{
        await navigator.clipboard.writeText(text==null?"":String(text));
      }catch(e){
        const ta=document.createElement("textarea");ta.value=text==null?"":String(text);
        document.body.append(ta);ta.select();document.execCommand("copy");ta.remove();
      }
      R.toast("Copied ✔️");
    },

    async paste(){
      try{return await navigator.clipboard.readText();}
      catch(e){R.toast("Clipboard access unavailable");return "";}
    },

    download(filename,text,type){
      const blob=new Blob([text],{type:type||"text/plain;charset=utf-8"});
      const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=filename||"download.txt";
      document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),500);
    },

    clearConfirm(target, label){
      return R.confirm({
        icon:"🗑️",title:"Clear "+(label||"Content")+"?",
        text:"This action will remove the current content.",
        confirmText:"Clear",danger:true
      },()=>{if(typeof target==="function")target();else if(target)target.value="";});
    },

    toggle(id){
      const x=document.getElementById(id); if(!x)return;
      x.classList.toggle("open"); return x.classList.contains("open");
    },

    create(tag,cls,text){ return el(tag,cls,text); }
  };

  function el(tag,cls,text){
    const x=document.createElement(tag); if(cls)x.className=cls; if(text!=null)x.textContent=text; return x;
  }
  function button(text,cls,onClick,icon){
    const b=document.createElement("button");
    b.type="button"; b.className="royall-btn "+(cls||"soft");
    if(icon)b.append(document.createTextNode(icon+" "));
    b.append(document.createTextNode(text||""));
    if(onClick)b.onclick=onClick;
    return b;
  }
  function normalizeDialog(o,icon,title){
    if(typeof o==="string")o={text:o};
    o=o||{}; return {icon:o.icon||icon,title:o.title||title,text:o.text||"",placeholder:o.placeholder||"",
      cancelText:o.cancelText,confirmText:o.confirmText,submitText:o.submitText,danger:o.danger};
  }
  function dialog(opts){
    const overlay=el("div","royall-overlay");
    const d=el("div","royall-dialog");
    const head=el("div","royall-dialog-head");
    head.append(el("div","royall-dialog-icon",opts.icon),el("div","royall-dialog-title",opts.title));
    const body=el("div");
    if(opts.text)body.append(el("div","royall-dialog-text",opts.text));
    const actions=el("div","royall-dialog-actions");
    d.append(head,body,actions);overlay.append(d);document.body.append(overlay);
    overlay.addEventListener("click",e=>{if(e.target===overlay)close()});
    function close(){overlay.classList.remove("open");setTimeout(()=>overlay.remove(),150)}
    return {overlay,body,actions,open:()=>overlay.classList.add("open"),close};
  }
  function countText(s,words){
    const chars=[...s].length;
    if(!words)return chars+" chars";
    const w=s.trim()?s.trim().split(/\s+/).length:0;
    return w+" words • "+chars+" chars";
  }

  // Small declarative helpers
  document.addEventListener("click",async e=>{
    const b=e.target.closest("[data-royall]");
    if(!b)return;
    const cmd=b.getAttribute("data-royall");
    if(cmd==="toast")R.toast(b.dataset.text||"Done ✔️");
    if(cmd==="copy")R.copy(b.dataset.value||"");
    if(cmd==="clear")R.clearConfirm(()=>{const id=b.dataset.target;const x=id&&document.querySelector(id);if(x)x.value="";},b.dataset.label);
  });

  global.RoyallUI=R;
})(window);
