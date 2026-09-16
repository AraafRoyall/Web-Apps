
(function(w){
"use strict";

var RoyallUI=(function(){
  var api={}, toastTimer;

  function $(id){return document.getElementById(id)}
  function make(tag,cls,text){
    var x=document.createElement(tag);
    if(cls)x.className=cls;
    if(text!=null)x.textContent=text;
    return x;
  }

  api.mount=function(opts){
    opts=opts||{};
    var root=typeof opts.mount==="string"?document.querySelector(opts.mount):(opts.mount||document.body);
    root.innerHTML="";
    root.className=(root.className?root.className+" ":"")+"royall-app";

    var header=make("header","royall-header");
    var icon=make("div","royall-header-icon",opts.icon||"🥏");
    var hm=make("div","royall-header-main");
    hm.appendChild(make("h1","royall-title",opts.title||"Royall Tool"));
    hm.appendChild(make("div","royall-sub",opts.description||""));
    header.appendChild(icon); header.appendChild(hm);

    if(opts.headerButton){
      var hb=make("button","royall-header-action",opts.headerButton.text||"Clear All");
      hb.type="button";
      hb.addEventListener("click",opts.headerButton.onClick||function(){});
      header.appendChild(hb);
    }
    root.appendChild(header);

    if(opts.status){
      var strip=make("div","royall-status-strip");
      strip.appendChild(make("span","royall-status-left",opts.status.text||""));
      if(opts.status.right)strip.appendChild(make("span","royall-status-right",opts.status.right));
      root.appendChild(strip);
    }

    var content=make("main","royall-content");
    root.appendChild(content);

    if(opts.developer!==false){
      var footer=make("div","royall-status-strip");
      footer.style.marginTop="9px";
      footer.innerHTML="• Feature Provided by <strong class='royall-developer-name'>Araaf Royall</strong> ❣️";
      root.appendChild(footer);
    }
    return {root:root,content:content,header:header};
  };

  api.card=function(title,opts){
    opts=opts||{};
    var card=make("section","royall-card");
    if(opts.result)card.classList.add("royall-result-card");

    if(opts.head){
      var head=make("div","royall-input-head");
      var t=make("div","royall-input-title",title||"");
      head.appendChild(t);
      if(opts.stats)head.appendChild(make("div","royall-input-stats",opts.stats));
      if(opts.actions)opts.actions.forEach(function(a){
        var b=make("button",a.className||"royall-btn soft",a.text||"");
        b.type="button"; b.addEventListener("click",a.onClick||function(){});
        head.appendChild(b);
      });
      card.appendChild(head);
    }else{
      card.appendChild(make("h2","royall-section-title",title||""));
    }
    return card;
  };

  api.input=function(opts){
    opts=opts||{};
    var row=make("div","royall-field-row");
    var input=make("input","royall-input");
    input.type=opts.type||"text"; input.placeholder=opts.placeholder||"";
    if(opts.value!=null)input.value=opts.value;
    row.appendChild(input);
    (opts.actions||[]).forEach(function(a){
      var b=make("button",a.className||"royall-small-btn",a.text||"");
      b.type="button"; b.addEventListener("click",function(){a.onClick&&a.onClick(input)});
      row.appendChild(b);
    });
    return {el:row,input:input};
  };

  api.textarea=function(opts){
    opts=opts||{};
    var ta=make("textarea","royall-textarea");
    ta.placeholder=opts.placeholder||"";
    if(opts.value!=null)ta.value=opts.value;
    return {el:ta,textarea:ta};
  };

  api.result=function(text){
    return make("div","royall-result",text||"");
  };

  api.divider=function(){return make("div","royall-divider")};

  api.button=function(text,cls,onClick){
    var b=make("button",cls||"royall-btn soft",text||"");
    b.type="button"; if(onClick)b.addEventListener("click",onClick);
    return b;
  };

  api.copy=async function(text){
    try{
      await navigator.clipboard.writeText(String(text||""));
    }catch(e){
      var a=document.createElement("textarea");
      a.value=String(text||"");a.style.position="fixed";a.style.opacity="0";
      document.body.appendChild(a);a.focus();a.select();document.execCommand("copy");a.remove();
    }
    api.toast("Copied");
  };

  api.paste=async function(){
    try{return await navigator.clipboard.readText()}
    catch(e){api.toast("Clipboard unavailable");return ""}
  };

  api.download=function(filename,text,type){
    var blob=new Blob([String(text||"")],{type:type||"text/plain;charset=utf-8"});
    var url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename||"download.txt";document.body.appendChild(a);a.click();a.remove();
    setTimeout(function(){URL.revokeObjectURL(url)},1000);
  };

  function openDialog(opts){
    opts=opts||{};
    var back=make("div","royall-dialog-backdrop");
    var box=make("div","royall-dialog");
    var head=make("div","royall-dialog-head");
    head.appendChild(make("div","royall-dialog-icon",opts.icon||"⚠️"));
    head.appendChild(make("h3","",opts.title||"Confirm"));
    box.appendChild(head);
    if(opts.text)box.appendChild(make("p","",opts.text));
    var actions=make("div","royall-dialog-actions");
    box.appendChild(actions);back.appendChild(box);document.body.appendChild(back);
    function close(){back.classList.remove("show");setTimeout(function(){back.remove()},180)}
    back.addEventListener("click",function(e){if(e.target===back)close()});
    setTimeout(function(){back.classList.add("show")},0);
    return {back:back,box:box,actions:actions,close:close};
  }

  api.confirm=function(opts,onConfirm){
    var d=openDialog(opts);
    var cancel=make("button","royall-dialog-btn cancel",opts.cancelText||"Cancel");
    var yes=make("button","royall-dialog-btn "+(opts.danger===false?"primary":"danger"),opts.confirmText||"Clear");
    cancel.type=yes.type="button";
    cancel.onclick=d.close;
    yes.onclick=function(){d.close();if(onConfirm)onConfirm()};
    d.actions.appendChild(cancel);d.actions.appendChild(yes);
    return d;
  };

  api.choice=function(opts,choices){
    var d=openDialog(opts);
    (choices||[]).forEach(function(item){
      var b=make("button","royall-dialog-btn primary",item.text||item[0]||"Option");
      b.type="button"; b.onclick=function(){d.close();if(item.onClick)item.onClick();else if(item[1])item[1]()};
      d.actions.appendChild(b);
    });
    return d;
  };

  api.prompt=function(opts,onSubmit){
    var d=openDialog(opts);
    var input=make("input","royall-dialog-input");
    input.placeholder=opts.placeholder||"";
    d.box.insertBefore(input,d.actions);
    var cancel=make("button","royall-dialog-btn cancel",opts.cancelText||"Cancel");
    var ok=make("button","royall-dialog-btn primary",opts.submitText||"OK");
    cancel.type=ok.type="button";cancel.onclick=d.close;
    ok.onclick=function(){var v=input.value;d.close();if(onSubmit)onSubmit(v)};
    d.actions.appendChild(cancel);d.actions.appendChild(ok);
    setTimeout(function(){input.focus()},40);
    return d;
  };

  api.clearConfirm=function(target,label){
    return api.confirm({
      icon:"!",
      title:"Clear "+(label||"content")+"?",
      text:"This action will clear the current content.",
      cancelText:"Cancel",confirmText:"Clear"
    },function(){
      if(typeof target==="function")target();
      else if(target&&"value" in target)target.value="";
    });
  };

  api.toast=function(text,ms){
    var t=document.querySelector(".royall-toast");
    if(!t){t=make("div","royall-toast");document.body.appendChild(t)}
    t.textContent=text||"";
    t.classList.add("show");clearTimeout(toastTimer);
    toastTimer=setTimeout(function(){t.classList.remove("show")},ms||1400);
  };

  api.fab=function(text,onClick,amber){
    var b=make("button","royall-fab"+(amber?" amber":""),text||"Action");
    b.type="button";b.onclick=onClick||function(){};document.body.appendChild(b);return b;
  };

  api.bottomBar=function(items){
    var bar=make("div","royall-bottom-bar");
    (items||[]).forEach(function(item,i){
      var b=make("button",item.className||((i===0)?"left":"right"),item.text||"Action");
      b.type="button";b.onclick=item.onClick||function(){};bar.appendChild(b);
    });
    document.body.appendChild(bar);return bar;
  };

  return api;
})();
w.RoyallUI=RoyallUI;
})(window);
