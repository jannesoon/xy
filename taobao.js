export async function init(){
  const mount = document.getElementById('taobao-root');
  if(!mount) return;
  mount.innerHTML = `
    <div>桃宝模块已就绪（占位）。</div>
    <div class="muted">把 taobao.js 的“生图队列 / Prompt 选择 / 购物清单”等迁到这里。</div>
  `;
}
