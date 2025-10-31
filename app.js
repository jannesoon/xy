````javascript
// ====== 全局存储 Key 规划 ======
// lockEnabled:    'true' | 'false'
// lockPwd:        string (可为空)
// lockWall:       dataURL/base64 或 URL（相对路径）
// customCss:      string（用户自定义 CSS）
// api.baseUrl:    string
// api.key:        string
// api.model:      string
// api.temperature:number
// worldbook:      JSON.stringify([{id, trigger, content}])
// chat.history:   JSON.stringify([{role, content}])

const App = {
  // 读取存储
  get(k, d=null){ try{ const v = localStorage.getItem(k); return v===null?d:v; }catch{ return d } },
  set(k, v){ try{ localStorage.setItem(k, v); }catch{} },
  jget(k, d=[]){ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):d }catch{ return d } },
  jset(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} },

  // 时间显示
  tickClock(){
    const elT = document.getElementById('lock-time');
    const elD = document.getElementById('lock-date');
    if(!elT||!elD) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    elT.textContent = `${hh}:${mm}`;
    elD.textContent = now.toLocaleDateString('zh-CN', { weekday:'long', month:'long', day:'numeric' });
  },

  // 注入自定义 CSS
  applyCustomCss(){
    const css = this.get('customCss','');
    const node = document.getElementById('custom-css');
    if(node) node.textContent = css;
  },

  // 锁屏：显示/隐藏/校验
  showLock(){
    const layer = document.getElementById('lock-screen');
    if(!layer) return;
    const wall = this.get('lockWall', '');
    layer.style.backgroundImage = wall ? `url(${wall})` : 'none';
    layer.classList.remove('hidden');
    this.tickClock();
    this._clockTimer = setInterval(()=>this.tickClock(), 1000*15);
  },
  hideLock(){
    const layer = document.getElementById('lock-screen');
    if(!layer) return;
    layer.classList.add('hidden');
    clearInterval(this._clockTimer);
  },
  tryUnlock(){
    const needPwd = !!this.get('lockPwd','');
    if(!needPwd){ this.hideLock(); return; }
    const dlg = document.getElementById('pwd-modal');
    dlg?.showModal();
    const confirm = document.getElementById('pwd-confirm');
    const input = document.getElementById('pwd-input');
    if(confirm && input){
      confirm.onclick = (e)=>{
        e.preventDefault();
        const ok = input.value === App.get('lockPwd','');
        if(ok){ dlg.close(); this.hideLock(); }
        else { input.value=''; input.placeholder='密码错误'; }
      };
    }
  },

  // 导出/导入全部数据
  exportAll(){
    const dump = {
      lockEnabled: this.get('lockEnabled','false'),
      lockPwd: this.get('lockPwd',''),
      lockWall: this.get('lockWall',''),
      customCss: this.get('customCss',''),
      api: {
        baseUrl: this.get('api.baseUrl',''),
        key: this.get('api.key',''),
        model: this.get('api.model',''),
        temperature: Number(this.get('api.temperature','0.7'))
      },
      worldbook: this.jget('worldbook', []),
      history: this.jget('chat.history', [])
    };
    const blob = new Blob([JSON.stringify(dump,null,2)], {type:'application/json'});
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'xingyue-export.json' });
    a.click();
    URL.revokeObjectURL(a.href);
  },
  importAll(file){
    const fr = new FileReader();
    fr.onload = ()=>{
      try{
        const data = JSON.parse(fr.result);
        if('lockEnabled' in data) this.set('lockEnabled', data.lockEnabled);
        if('lockPwd' in data) this.set('lockPwd', data.lockPwd||'');
        if('lockWall' in data) this.set('lockWall', data.lockWall||'');
        if('customCss' in data) this.set('customCss', data.customCss||'');
        if('api' in data){ const a = data.api||{}; this.set('api.baseUrl', a.baseUrl||''); this.set('api.key', a.key||''); this.set('api.model', a.model||''); this.set('api.temperature', String(a.temperature??0.7)); }
        if('worldbook' in data) this.jset('worldbook', data.worldbook||[]);
        if('history' in data) this.jset('chat.history', data.history||[]);
        alert('导入成功'); location.reload();
      }catch(err){ alert('导入失败：'+err.message); }
    };
    fr.readAsText(file);
  },

  // 最小 API 测试（OpenAI 兼容）
  async testChatOnce(){
    const base = this.get('api.baseUrl','');
    const key  = this.get('api.key','');
    const model= this.get('api.model','');
    const temperature = Number(this.get('api.temperature','0.7')) || 0.7;
    if(!base||!model){ alert('请先在 API 设置里填 baseUrl 和 model'); return; }
    try{
      const r = await fetch(base.replace(/\/$/,'') + '/chat/completions', {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer '+(key||'x') },
        body: JSON.stringify({ model, temperature, messages:[{role:'user', content:'你好，做个自我介绍。'}] })
      });
      const j = await r.json();
      alert('返回：
'+(j.choices?.[0]?.message?.content||JSON.stringify(j))); 
    }catch(err){ alert('请求失败：'+err.message); }
  },

  // 入口
  init(){
    this.applyCustomCss();
    const enabled = this.get('lockEnabled','false') === 'true';
    if(enabled) this.showLock();
    const btn = document.getElementById('btn-lock');
    if(btn) btn.onclick = ()=> this.showLock();
    const layer = document.getElementById('lock-screen');
    if(layer){
      let startY=null;
      layer.addEventListener('touchstart',(e)=>{ startY = e.touches?.[0]?.clientY ?? null; }, {passive:true});
      layer.addEventListener('touchend',(e)=>{
        if(startY===null) return; const endY = e.changedTouches?.[0]?.clientY ?? startY; if(startY - endY > 40) this.tryUnlock(); startY=null; 
      }, {passive:true});
      layer.addEventListener('click', ()=> this.tryUnlock());
    }
  }
};

// ============= 聊天模块（流式 /v1/chat/completions） =============
const Chat = {
  ctrl: null, // AbortController
  listEl: null,
  inputEl: null,
  formEl: null,
  stopEl: null,

  init(){
    this.listEl = document.getElementById('chat-list');
    this.inputEl = document.getElementById('chat-text');
    this.formEl = document.getElementById('chat-form');
    this.stopEl = document.getElementById('chat-stop');

    if(!this.listEl || !this.inputEl || !this.formEl) return;

    // 渲染历史
    this.renderHistory();

    // 输入框自适应高度
    this.inputEl.addEventListener('input', ()=>{
      this.inputEl.style.height = 'auto';
      this.inputEl.style.height = Math.min(this.inputEl.scrollHeight, 160) + 'px';
    });

    // 发送
    this.formEl.addEventListener('submit', (e)=>{
      e.preventDefault();
      const text = this.inputEl.value.trim();
      if(!text) return;
      this.inputEl.value=''; this.inputEl.style.height='auto';
      this.push({role:'user', content:text});
      this.stream(text);
    });

    // 停止
    if(this.stopEl){ this.stopEl.onclick = ()=>{ try{ this.ctrl?.abort(); }catch{} } }

    // 清空
    const clearBtn = document.getElementById('btn-clear');
    if(clearBtn){ clearBtn.onclick = ()=>{ localStorage.removeItem('chat.history'); this.listEl.innerHTML=''; } }
  },

  history(){ return App.jget('chat.history', []); },
  save(h){ App.jset('chat.history', h); },

  push(msg){
    const h = this.history(); h.push(msg); this.save(h); this.renderMessage(msg);
  },

  renderHistory(){
    const h = this.history(); this.listEl.innerHTML='';
    for(const m of h) this.renderMessage(m);
  },

  renderMessage(m){
    const row = document.createElement('div');
    row.className = 'msg ' + (m.role==='user'?'user':'bot');
    row.innerHTML = `<div class="avatar"></div><div class="bubble"></div>`;
    row.querySelector('.bubble').textContent = m.content;
    this.listEl.appendChild(row);
    this.listEl.scrollTop = this.listEl.scrollHeight;
    return row.querySelector('.bubble');
  },

  async stream(userText){
    const base = App.get('api.baseUrl','');
    const key  = App.get('api.key','');
    const model= App.get('api.model','');
    const temperature = Number(App.get('api.temperature','0.7')) || 0.7;
    if(!base||!model){ alert('请先在 API 设置里填 baseUrl 和 model'); return; }

    // 组消息：拼上世界书（最简单写法：合成到 system）
    const wb = App.jget('worldbook', []);
    const wbText = wb.map(x=>`【${x.trigger}】${x.content}`).join('
');
    const history = this.history();

    const messages = [];
    if(wbText){ messages.push({ role:'system', content: `你是逸辰（Ethan），只对“柒柒”说话。保持温柔宠溺的口语风格。以下世界信息需内化于心：
${wbText}` }); }
    for(const m of history){ messages.push({role:m.role, content:m.content}); }
    messages.push({role:'user', content:userText});

    // 占位的 bot 行
    const bubble = this.renderMessage({role:'assistant', content:''});

    // 流式
    this.ctrl = new AbortController();
    try{
      const r = await fetch(base.replace(/\/$/,'') + '/chat/completions', {
        method:'POST',
        signal: this.ctrl.signal,
        headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer '+(key||'x') },
        body: JSON.stringify({ model, temperature, stream:true, messages })
      });

      if(!r.ok){ const t=await r.text(); throw new Error(`HTTP ${r.status}: ${t}`); }

      const reader = r.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let done=false, acc=''; let full='';

      while(!done){
        const chunk = await reader.read();
        done = chunk.done; if(done) break;
        acc += decoder.decode(chunk.value, {stream:true});
        // 逐行解析 SSE: data: {json}


        const parts = acc.split('

');
        acc = parts.pop();
        for(const p of parts){
          const line = p.trim();
          if(!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if(data === '[DONE]') continue;
          try{
            const j = JSON.parse(data);
            const delta = j.choices?.[0]?.delta?.content || '';
            if(delta){ full += delta; bubble.textContent += delta; this.listEl.scrollTop = this.listEl.scrollHeight; }
          }catch{}
        }
      }

      // 收尾：把最终内容写入历史
      if(full){
        const h = this.history();
        h.push({role:'assistant', content: full});
        this.save(h);
      }
    }catch(err){
      if(err.name === 'AbortError'){ bubble.textContent += ' [已停止]'; return; }
      bubble.textContent = '（请求失败）' + err.message;
    }finally{
      this.ctrl = null;
    }
  }
};
```}]}javascript
// ====== 全局存储 Key 规划 ======
// lockEnabled:    'true' | 'false'
// lockPwd:        string (可为空)
// lockWall:       dataURL/base64 或 URL（相对路径）
// customCss:      string（用户自定义 CSS）
// api.baseUrl:    string
// api.key:        string
// api.model:      string
// api.temperature:number
// worldbook:      JSON.stringify([{id, trigger, content}])

const App = {
  // 读取存储
  get(k, d=null){ try{ const v = localStorage.getItem(k); return v===null?d:v; }catch{ return d } },
  set(k, v){ try{ localStorage.setItem(k, v); }catch{} },
  jget(k, d=[]){ try{ const v = localStorage.getItem(k); return v?JSON.parse(v):d }catch{ return d } },
  jset(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} },

  // 时间显示
  tickClock(){
    const elT = document.getElementById('lock-time');
    const elD = document.getElementById('lock-date');
    if(!elT||!elD) return;
    const now = new Date();
    const hh = String(now.getHours()).padStart(2,'0');
    const mm = String(now.getMinutes()).padStart(2,'0');
    elT.textContent = `${hh}:${mm}`;
    elD.textContent = now.toLocaleDateString('zh-CN', { weekday:'long', month:'long', day:'numeric' });
  },

  // 注入自定义 CSS
  applyCustomCss(){
    const css = this.get('customCss','');
    const node = document.getElementById('custom-css');
    if(node) node.textContent = css;
  },

  // 锁屏：显示/隐藏/校验
  showLock(){
    const layer = document.getElementById('lock-screen');
    if(!layer) return;
    const wall = this.get('lockWall', '');
    layer.style.backgroundImage = wall ? `url(${wall})` : 'none';
    layer.classList.remove('hidden');
    this.tickClock();
    this._clockTimer = setInterval(()=>this.tickClock(), 1000*15);
  },
  hideLock(){
    const layer = document.getElementById('lock-screen');
    if(!layer) return;
    layer.classList.add('hidden');
    clearInterval(this._clockTimer);
  },
  tryUnlock(){
    const needPwd = !!this.get('lockPwd','');
    if(!needPwd){ this.hideLock(); return; }
    const dlg = document.getElementById('pwd-modal');
    dlg?.showModal();
    const confirm = document.getElementById('pwd-confirm');
    const input = document.getElementById('pwd-input');
    if(confirm && input){
      confirm.onclick = (e)=>{
        e.preventDefault();
        const ok = input.value === App.get('lockPwd','');
        if(ok){ dlg.close(); this.hideLock(); }
        else { input.value=''; input.placeholder='密码错误'; }
      };
    }
  },

  // 导出/导入全部数据
  exportAll(){
    const dump = {
      lockEnabled: this.get('lockEnabled','false'),
      lockPwd: this.get('lockPwd',''),
      lockWall: this.get('lockWall',''),
      customCss: this.get('customCss',''),
      api: {
        baseUrl: this.get('api.baseUrl',''),
        key: this.get('api.key',''),
        model: this.get('api.model',''),
        temperature: Number(this.get('api.temperature','0.7'))
      },
      worldbook: this.jget('worldbook', [])
    };
    const blob = new Blob([JSON.stringify(dump,null,2)], {type:'application/json'});
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'xingyue-export.json' });
    a.click();
    URL.revokeObjectURL(a.href);
  },
  importAll(file){
    const fr = new FileReader();
    fr.onload = ()=>{
      try{
        const data = JSON.parse(fr.result);
        if('lockEnabled' in data) this.set('lockEnabled', data.lockEnabled);
        if('lockPwd' in data) this.set('lockPwd', data.lockPwd||'');
        if('lockWall' in data) this.set('lockWall', data.lockWall||'');
        if('customCss' in data) this.set('customCss', data.customCss||'');
        if('api' in data){
          const a = data.api||{}; this.set('api.baseUrl', a.baseUrl||''); this.set('api.key', a.key||''); this.set('api.model', a.model||''); this.set('api.temperature', String(a.temperature??0.7));
        }
        if('worldbook' in data) this.jset('worldbook', data.worldbook||[]);
        alert('导入成功'); location.reload();
      }catch(err){ alert('导入失败：'+err.message); }
    };
    fr.readAsText(file);
  },

  // 最小 API 测试（OpenAI 兼容）
  async testChatOnce(){
    const base = this.get('api.baseUrl','');
    const key  = this.get('api.key','');
    const model= this.get('api.model','');
    const temperature = Number(this.get('api.temperature','0.7')) || 0.7;
    if(!base||!model){ alert('请先在 API 设置里填 baseUrl 和 model'); return; }
    try{
      const r = await fetch(base.replace(/\/$/,'') + '/v1/chat/completions', {
        method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': 'Bearer '+(key||'x') },
        body: JSON.stringify({ model, temperature, messages:[{role:'user', content:'你好，做个自我介绍。'}] })
      });
      const j = await r.json();
      alert('返回：\n'+(j.choices?.[0]?.message?.content||JSON.stringify(j)));
    }catch(err){ alert('请求失败：'+err.message); }
  },

  // 入口
  init(){
    // 注入 CSS
    this.applyCustomCss();

    // 锁屏启动：如果开启，则显示锁屏
    const enabled = this.get('lockEnabled','false') === 'true';
    if(enabled) this.showLock();

    // 首页按钮
    const btn = document.getElementById('btn-lock');
    if(btn) btn.onclick = ()=> this.showLock();

    // 锁屏交互：上滑/点击打开密码
    const layer = document.getElementById('lock-screen');
    if(layer){
      let startY=null;
      layer.addEventListener('touchstart',(e)=>{ startY = e.touches?.[0]?.clientY ?? null; }, {passive:true});
      layer.addEventListener('touchend',(e)=>{
        if(startY===null) return; const endY = e.changedTouches?.[0]?.clientY ?? startY; if(startY - endY > 40) this.tryUnlock(); startY=null;
      }, {passive:true});
      layer.addEventListener('click', ()=> this.tryUnlock());
    }
  }
};

// 页面级工具：在设置页用
window.XY = {
  bindValue(id, key){
    const el = document.getElementById(id);
    if(!el) return;
    el.value = App.get(key,'');
    el.addEventListener('change', ()=> App.set(key, el.value));
  },
  bindNumber(id, key, def){
    const el = document.getElementById(id);
    el.value = App.get(key, String(def));
    el.addEventListener('change', ()=> App.set(key, el.value));
  },
  on(id, ev, fn){ const el = document.getElementById(id); if(el) el.addEventListener(ev, fn); },
};
````
