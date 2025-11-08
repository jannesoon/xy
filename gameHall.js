export async function init(){
  const mount = document.getElementById('gamehall-root');
  if(!mount) return;
  mount.innerHTML = `
    <div>渲染器模块已就绪（占位）。</div>
    <div class="muted">把 game-hall.js 的 UI / 事件迁到这里。</div>
  `;
}
