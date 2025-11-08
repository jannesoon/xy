export async function init(){
  const mount = document.getElementById('lovers-root');
  if(!mount) return;
  mount.innerHTML = `
    <div>情侣空间已就绪（占位）。</div>
    <div class="muted">后续把 lovers-space.js 的初始化、播放器、相册、情书渲染迁到这里。</div>
  `;
}
