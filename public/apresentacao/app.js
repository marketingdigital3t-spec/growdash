const observer = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) entry.target.classList.add('visible'); }), { threshold: .12 });
document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
const progressBar = document.getElementById('scroll-progress');
const updateProgress = () => { const max = document.documentElement.scrollHeight - window.innerHeight; if (progressBar) progressBar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`; };
window.addEventListener('scroll', updateProgress, { passive: true }); updateProgress();
document.querySelectorAll('.product-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.product-tab').forEach((item) => item.classList.toggle('active', item === tab));
  document.querySelectorAll('.view-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.view === tab.dataset.panel));
}));
const trustedViews = {
  dashboard: { title: 'Dashboard', caption: 'Visão geral da operação, tráfego, leads e resultado.', src: 'assets/growdash-dashboard.png', alt: 'Dashboard real da Growdash com visão geral da operação' },
  crm: { title: 'CRM e negociações', caption: 'Pipeline, etapas, responsáveis e oportunidades em andamento.', src: 'assets/growdash-crm.png', alt: 'Tela real de CRM e negociações da Growdash' },
  performance: { title: 'Performance e vendas', caption: 'Acompanhamento de vendas, ranking, metas e evolução.', src: 'assets/growdash-performance.png', alt: 'Painel real de performance e vendas da Growdash' },
  flow: { title: 'Kanban', caption: 'Campanhas, formulários, automações e prioridades organizadas para a operação avançar.', src: 'assets/growdash-flow.png', alt: 'Quadro real do Kanban da Growdash com demandas e prioridades' },
  financeiro: { title: 'Financeiro', caption: 'Leitura financeira com dados sensíveis protegidos.', src: 'assets/growdash-financeiro.png', alt: 'Tela financeira da Growdash com dados protegidos' }
};
const trustedImage = document.getElementById('trusted-view-image');
const trustedTitle = document.getElementById('trusted-view-title');
const trustedCaption = document.getElementById('trusted-view-caption');
document.querySelectorAll('[data-trusted-view]').forEach((button) => {
  button.addEventListener('click', () => {
    const view = trustedViews[button.dataset.trustedView];
    if (!view || !trustedImage) return;
    document.querySelectorAll('[data-trusted-view]').forEach((item) => { const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-selected', String(active)); });
    trustedImage.style.opacity = '0';
    window.setTimeout(() => { trustedImage.src = view.src; trustedImage.alt = view.alt; if (trustedTitle) trustedTitle.textContent = view.title; if (trustedCaption) trustedCaption.textContent = view.caption; trustedImage.style.opacity = '1'; }, 140);
  });
});
const galleryTabs = [...document.querySelectorAll('.gallery-tab')];
const selectGallery = (tab, moveFocus = false) => { galleryTabs.forEach((item) => { const selected = item === tab; item.classList.toggle('active', selected); item.setAttribute('aria-selected', String(selected)); item.tabIndex = selected ? 0 : -1; }); document.querySelectorAll('.gallery-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.galleryPanel === tab.dataset.gallery)); if (moveFocus) tab.focus(); };
galleryTabs.forEach((tab, index) => { tab.addEventListener('click', () => selectGallery(tab)); tab.addEventListener('keydown', (event) => { if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? galleryTabs.length - 1 : (index + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + galleryTabs.length) % galleryTabs.length; selectGallery(galleryTabs[next], true); }); });
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const closeLightbox = () => { if (lightbox) lightbox.classList.remove('open'); if (lightboxImage) lightboxImage.removeAttribute('src'); };
let lightboxReturnFocus;
const openLightbox = (item) => { lightboxReturnFocus = item; lightboxImage.src = item.dataset.lightbox; lightboxImage.alt = item.querySelector('img').alt; lightbox.classList.add('open'); document.getElementById('lightbox-close').focus(); };
document.querySelectorAll('.gallery-image').forEach((item) => { item.addEventListener('click', () => openLightbox(item)); item.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openLightbox(item); } }); });
const trustedStage = document.querySelector('.trusted-stage');
const openTrustedLightbox = () => {
  if (!trustedStage || !trustedImage || !lightbox || !lightboxImage) return;
  lightboxReturnFocus = trustedStage;
  lightboxImage.src = trustedImage.src;
  lightboxImage.alt = trustedImage.alt;
  lightbox.classList.add('open');
  document.getElementById('lightbox-close')?.focus();
};
if (trustedStage) {
  trustedStage.tabIndex = 0;
  trustedStage.setAttribute('role', 'button');
  trustedStage.setAttribute('aria-label', 'Ampliar captura real da plataforma');
  trustedStage.addEventListener('click', openTrustedLightbox);
  trustedStage.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openTrustedLightbox(); } });
}
document.getElementById('lightbox-close')?.addEventListener('click', closeLightbox);
lightbox?.addEventListener('click', (event) => { if (event.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && lightbox?.classList.contains('open')) { closeLightbox(); lightboxReturnFocus?.focus(); } });
const sectionLinks = [...document.querySelectorAll('.nav-links a')];
const sectionTargets = sectionLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
const sectionObserver = new IntersectionObserver((entries) => entries.forEach((entry) => { if (entry.isIntersecting) sectionLinks.forEach((link) => link.classList.toggle('is-current', link.getAttribute('href') === `#${entry.target.id}`)); }), { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
sectionTargets.forEach((section) => sectionObserver.observe(section));
const heroDashboard = document.querySelector('.real-dashboard');
if (heroDashboard && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) { heroDashboard.addEventListener('pointermove', (event) => { const box = heroDashboard.getBoundingClientRect(); const x = (event.clientX - box.left) / box.width - .5; const y = (event.clientY - box.top) / box.height - .5; heroDashboard.style.transform = `perspective(1600px) rotateY(${x * 4}deg) rotateX(${y * -3}deg) translateY(-5px)`; }); heroDashboard.addEventListener('pointerleave', () => { heroDashboard.style.transform = ''; }); }
const motionCards = [...document.querySelectorAll('.signal-card, .funnel-node')];
if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) motionCards.forEach((card) => { card.addEventListener('pointermove', (event) => { const box = card.getBoundingClientRect(); const x = (event.clientX - box.left) / box.width - .5; const y = (event.clientY - box.top) / box.height - .5; card.style.setProperty('--mx', `${(x + .5) * 100}%`); card.style.setProperty('--my', `${(y + .5) * 100}%`); card.style.transform = `perspective(700px) rotateX(${y * -2.2}deg) rotateY(${x * 2.2}deg) translateY(-6px)`; }); card.addEventListener('pointerleave', () => { card.style.transform = ''; }); });
const editToggle = document.querySelector('.edit-toggle');
const editable = [...document.querySelectorAll('h1, h2, h3, .hero-copy, .note, .section-head p, .funnel-heading p, .product-kicker, .gallery-copy p, .module-card p, .module-card strong, .deliver p, .deliver small, .signal-card h3, .signal-card p, .signal-card a, .spotlight-copy h2, .spotlight-copy > p, .spotlight-copy li, .promise-grid p, .cta p, .cta .btn-primary, .hero .btn-primary, .hero .btn-ghost')];
editable.forEach((el) => { el.dataset.editable = 'true'; el.contentEditable = 'false'; });
editToggle?.addEventListener('click', () => { const editing = document.body.classList.toggle('editing'); editToggle.setAttribute('aria-pressed', String(editing)); editToggle.textContent = editing ? 'Concluir edição' : 'Editar apresentação'; editable.forEach((el) => { el.contentEditable = String(editing); }); if (!editing) localStorage.setItem('growdash-presentation-copy-v3', JSON.stringify(editable.map((el) => el.innerHTML))); });
try { const saved = JSON.parse(localStorage.getItem('growdash-presentation-copy-v3') || 'null'); if (Array.isArray(saved) && saved.length === editable.length) editable.forEach((el, i) => { el.innerHTML = saved[i]; }); } catch (_) {}
