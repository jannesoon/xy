import { showScreen } from './core/router.js';

// 路由 → 按需加载对应模块
const routes = {
  home   : () => import('./modules/home.js'),
  forum  : () => import('./modules/forum.js'),
  gamehall: () => import('./modules/gameHall.js'),
  lovers : () => import('./modules/loversSpace.js'),
  taobao : () => import('./modules/taobao.js'),
};

// 统一的“进入模块”逻辑
async function goto(route){
  showScreen(`screen-${route}`);
  if(routes[route]){
    try{
      const mod = await routes[route]();    // 动态加载
      await mod.init?.();                   // 只在首次加载时执行
    }catch(err){
      console.error(`[${route}] init failed`, err);
      const root = document.querySelector(`#screen-${route} .muted`) || document.querySelector(`#screen-${route}`);
      if(root) root.textContent = '加载失败（点击底栏再试一次）';
    }
  }
}

// 底栏点击
document.getElementById('dock').addEventListener('click', (e)=>{
  const btn = e.target.closest('button[data-route]');
  if(!btn) return;
  goto(btn.dataset.route);
});

// 默认首页
goto('home');
