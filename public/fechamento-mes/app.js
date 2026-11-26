const buttons = [...document.querySelectorAll('[data-view]')];
const exec = document.querySelector('.exec');
const ops = document.querySelector('.ops');

buttons.forEach((button) => button.addEventListener('click', () => {
  const isOps = button.dataset.view === 'ops';
  buttons.forEach((item) => item.setAttribute('aria-selected', String(item === button)));
  exec.classList.toggle('hidden', isOps);
  ops.classList.toggle('active', isOps);
}));
