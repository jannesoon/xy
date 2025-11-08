export async function init(){
  const mount = document.getElementById('forum-root');
  if(!mount) return;
  mount.innerHTML = `
    <div>世界书模块已就绪（占位）。</div>
    <div class="muted">后续把你原 forum.js 的渲染与事件绑定移到这里。</div>
  `;
}
