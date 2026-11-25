// A interface do Habblaud, montada dentro da Growdash.
//
// Esta e a versao do `client/src/ui/index.ts` original com os recursos que
// dependem do servidor local do Habblaud removidos:
// - o terminal (leitura e interativo) e o "Assumir aqui": precisam do node-pty;
// - o "Novo agente": precisa iniciar uma sessao do Claude Opus 5 Code;
// - o timelapse do dia: precisa do historico que o servidor grava;
// - as entregas, o historico de sessoes e o painel do dia;
// - a cena Mundo (a cidade multiplayer) e os popups do Habblaud World.
//
// O que fica e o escritorio: a barra do topo com as contas, a barra lateral com
// as salas e os agentes, a gaveta de detalhes, o feed de atividades, os avisos,
// as configuracoes e a ajuda.
//
// DOM incremental: os snapshots so marcam a UI como "suja"; tudo e reconciliado
// uma vez por quadro.
import { access, onAccessChange } from '../net/access';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/500.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/pixelify-sans/700.css';
import './styles.css';

import type { OfficeStore } from '../net/store';
import type { Selection, WorldApi } from '../world/api';
import type { PanelName, UiComponent, UiContext } from './context';
import { RoomRenamer } from './roomrename';
import { h } from './dom';
import { Drawer } from './drawer';
import { FeedPanel } from './feed';
import { bindFrame, frame, frameSize } from './frame';
import { HelpDialog } from './help';
import { HoverTip } from './hovertip';
import { hasRunningShells } from './model';
import { Notifier } from './notify';
import { ConnectionBanner, EmptyState, Splash } from './overlays';
import { focusPermission, nextPermissionAgent } from './permission';
import { loadPrefs, safeLocalStorage, savePrefs, worldOptionsFrom, type UiPrefs } from './prefs';
import { SettingsPopover } from './settings';
import { Sidebar } from './sidebar';
import { SoundControl } from './sound';
import { offlineTerminal } from './terminal';
import { offlinePty } from './pty';
import { Toasts } from './toasts';
import { UpdateToaster } from './version';
import { TopBar } from './topbar';
import { UpdateBanner } from './update';
import { WorldDialog } from './world/world-dialog';
import { FreeArea } from './viewport';
import { tr } from '../../../shared/i18n';

/** Relogio dos tempos relativos ("ha 5 s"). */
const CLOCK_MS = 5_000;
/** Relogio do cronometro dos shells ("12:31"), ligado so enquanto ha um deles. */
const SHELL_CLOCK_MS = 1_000;
/** Abaixo desta largura (do escritorio) os paineis viram gaveta sobreposta. */
const NARROW_PX = 900;

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement;
}

export function createUI(root: HTMLElement, store: OfficeStore, world: WorldApi): void {
  const storage = safeLocalStorage();
  let prefs: UiPrefs = loadPrefs(storage);
  let selection: Selection = world.getSelection();
  let skew = 0;
  // A largura que decide o layout e a do escritorio (o host), nao a da janela:
  // na Growdash o escritorio ocupa a aba Agentes, ao lado da barra lateral da
  // plataforma. O `ResizeObserver` do host avisa quando ela muda.
  let narrow = false;
  const panels: Record<PanelName, boolean> = {
    sidebar: false,
    feed: false,
  };

  const live = h('div', { class: 'ui-sr', role: 'status', attrs: { 'aria-live': 'polite' } });

  // O contexto e os componentes se referenciam: o `ctx` usa alguns deles
  // dentro de callbacks (que rodam depois) e cada componente recebe o `ctx`
  // no construtor. Por isso as declaracoes vem antes e a atribuicao fica
  // para depois; sem `let` nao compila.
  /* eslint-disable prefer-const */
  let topbar: TopBar;
  let sidebar: Sidebar;
  let settings: SettingsPopover;
  let worldDialog: WorldDialog;
  let help: HelpDialog;
  let area: FreeArea;
  /* eslint-enable prefer-const */
  /** A selecao em curso partiu da UI (lista, feed, aviso...), nao de um clique no canvas. */
  let uiSelecting = false;

  const ctx: UiContext = {
    store,
    world,
    root,
    get prefs() {
      return prefs;
    },
    updatePrefs(patch) {
      prefs = { ...prefs, ...patch };
      savePrefs(storage, prefs);
      world.setOptions(worldOptionsFrom(prefs));
      invalidate();
    },
    now: () => Date.now() + skew,
    account: (id) => store.snapshot?.accounts.find((a) => a.id === id),
    agent: (id) => store.agent(id),
    selection: () => selection,
    select(sel, opts) {
      if (sel && opts?.focus) area.setIntent(sel);
      else area.clearIntent();
      // A gaveta passa a contar na area livre ANTES do foco: o mundo centraliza ja na parte visivel.
      const prev = selection;
      selection = sel;
      area.selectingFromUi();
      applyLayout({ refocus: false });
      uiSelecting = true;
      try {
        world.select(sel, opts);
      } catch (err) {
        selection = prev;
        applyLayout();
        throw err;
      } finally {
        uiSelecting = false;
      }
    },
    focusSelection() {
      if (selection) ctx.select(selection, { focus: true });
    },
    camera(action) {
      area.clearIntent();
      if (action === 'overview') world.overview();
      else world.zoomBy(action === 'zoomIn' ? 1.25 : 1 / 1.25);
    },
    invalidate: () => invalidate(),
    togglePanel(name, open) {
      const next = open ?? !panels[name];
      if (panels[name] === next) return;
      panels[name] = next;
      if (!ctx.isNarrow()) ctx.updatePrefs(name === 'sidebar' ? { sidebarOpen: next } : { feedOpen: next });
      applyLayout();
      invalidate();
    },
    isPanelOpen: (name) => panels[name],
    isNarrow: () => narrow,
    announce(text) {
      live.textContent = '';
      requestAnimationFrame(() => (live.textContent = text));
    },
    focusSearch() {
      if (!panels.sidebar) ctx.togglePanel('sidebar', true);
      requestAnimationFrame(() => sidebar.focusSearch());
    },
    openHelp: (section) => help.open(section),
    toggleSettings: () => settings.toggle(topbar.settingsBtn),
    toggleWorld: () => worldDialog.toggle(topbar.worldBtn),
    openAbout: () => settings.showAbout(topbar.settingsBtn),
    // Sem historico de servidor, nao ha timelapse para alternar.
    toggleTimelapse() {},
    isTimelapseOpen: () => false,
  };

  // ---------------------------------------------------------------- componentes
  const sound = new SoundControl(ctx);
  const notifier = new Notifier(ctx, sound.board);
  topbar = new TopBar(ctx);
  sidebar = new Sidebar(ctx);
  const drawer = new Drawer(ctx, offlineTerminal, offlinePty);
  const feed = new FeedPanel(ctx);
  const toasts = new Toasts(ctx);
  const updateToaster = new UpdateToaster(ctx, (n) => toasts.push(n));
  worldDialog = new WorldDialog(ctx);
  settings = new SettingsPopover(ctx, notifier, sound, worldDialog);
  help = new HelpDialog();
  const tip = new HoverTip(ctx);
  const splash = new Splash(ctx);
  const banner = new ConnectionBanner(ctx);
  const update = new UpdateBanner(store);
  const empty = new EmptyState(ctx);

  // Botao direito numa sala (lista lateral ou escritorio): renomear.
  const renamer = new RoomRenamer(ctx);
  ctx.renameRoom = (id, at) => renamer.open(id, at);
  world.onRoomContextMenu?.((id, at) => renamer.open(id, at));

  const scrim = h('div', { class: 'ui-scrim', attrs: { 'aria-hidden': 'true' }, on: { click: () => ctx.togglePanel('sidebar', false) } });

  root.classList.add('ui-root');
  root.append(topbar.el, sidebar.el, scrim, feed.el, drawer.el, toasts.el, banner.el, update.el, empty.el, tip.el, settings.el, worldDialog.el, help.el, renamer.el, live, splash.el);
  area = new FreeArea(world, { root, topbar: topbar.el, sidebar: sidebar.el, drawer: drawer.el, feed: feed.el }, () => ({
    sidebar: panels.sidebar,
    feed: panels.feed,
    drawer: selection !== null && !drawer.floating,
    narrow: ctx.isNarrow(),
  }));
  drawer.onLayoutChange = () => applyLayout();

  const components: UiComponent[] = [topbar, sidebar, drawer, feed, toasts, settings, empty, banner, tip, notifier, splash, sound, updateToaster, worldDialog];

  // ---------------------------------------------------------------- renderizacao agrupada por quadro
  let rafId = 0;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;

  function renderAll(): void {
    rafId = 0;
    for (const c of components) {
      try {
        c.render();
      } catch (err) {
        console.error('[ui] falha ao renderizar', c.constructor.name, err);
      }
    }
  }

  function invalidate(): void {
    if (document.hidden) {
      // Com a aba oculta o navegador congela o rAF: mantem so titulo e alertas em dia.
      hiddenTimer ??= setTimeout(() => {
        hiddenTimer = null;
        notifier.render();
        toasts.render();
      }, 500);
      return;
    }
    if (!rafId) rafId = requestAnimationFrame(renderAll);
  }

  /** Aplica as classes de layout e informa ao mundo a area livre (sem esperar as transicoes dos paineis). */
  function applyLayout(opts: { refocus?: boolean } = {}): void {
    root.classList.toggle('has-sidebar', panels.sidebar);
    root.classList.toggle('has-feed', panels.feed);
    root.classList.toggle('has-drawer', selection !== null && !drawer.floating);
    root.classList.toggle('is-narrow', ctx.isNarrow());
    area.sync(opts);
  }

  // ---------------------------------------------------------------- eventos
  store.on('snapshot', (snap) => {
    // Ao vivo, o "agora" da interface segue o relogio do servidor (o aparelho pode estar adiantado ou atrasado).
    if (store.connection === 'open' && !store.replaying) skew = snap.serverTime - Date.now();
    invalidate();
  });
  store.on('connection', () => invalidate());
  onAccessChange(() => invalidate());
  world.onSelect((sel) => {
    const prev = selection;
    selection = sel;
    // Clique no canvas (ou agente que saiu): a gaveta espera a janela do duplo clique antes de mexer na camera.
    if (!uiSelecting) area.selectionChangedExternally(prev, sel);
    applyLayout(uiSelecting ? { refocus: false } : {});
    invalidate();
  });
  // O host encolheu (ou cresceu): os paineis viram gaveta em telas estreitas.
  const onFrameResize = () => {
    const width = frameSize().w;
    const isNarrow = width <= NARROW_PX;
    if (isNarrow === narrow) return;
    narrow = isNarrow;
    if (narrow) {
      panels.sidebar = false;
      panels.feed = false;
    } else {
      panels.sidebar = prefs.sidebarOpen;
      panels.feed = prefs.feedOpen;
    }
    applyLayout();
    invalidate();
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) invalidate();
  });
  setInterval(() => {
    if (!document.hidden) invalidate();
  }, CLOCK_MS);
  setInterval(() => {
    // Shells rodando (cronometro): so enquanto ha algum.
    if (!document.hidden && hasRunningShells(store.snapshot)) invalidate();
  }, SHELL_CLOCK_MS);

  addEventListener('keydown', (e) => onKey(e));

  function onKey(e: KeyboardEvent): void {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Escape') {
      if (help.isOpen || settings.isOpen || worldDialog.isOpen) return; // dialogo/popover tratam o proprio Esc
      if (ctx.isNarrow() && panels.sidebar) {
        ctx.togglePanel('sidebar', false);
        e.preventDefault();
      } else if (selection) {
        ctx.select(null);
        e.preventDefault();
      }
      return;
    }
    if (isTypingTarget(e.target) || help.isOpen || worldDialog.isOpen) return;
    switch (e.key) {
      case '/':
        e.preventDefault();
        ctx.focusSearch();
        break;
      case '?':
        e.preventDefault();
        help.open();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        if (selection?.type === 'agent') drawer.toggleFollow();
        else ctx.announce(tr('Selecione um agente para seguir.'));
        break;
      case 'p':
      case 'P': {
        // Proximo pedido de permissao ou pergunta para responder pelo escritorio (so leva ate ele: nunca aprova).
        e.preventDefault();
        const next = nextPermissionAgent(store.snapshot?.agents ?? [], selection?.type === 'agent' ? selection.id : undefined);
        if (next) focusPermission(ctx, next.id);
        else ctx.announce(tr('Nenhum pedido de permissão ou pergunta para responder agora.'));
        break;
      }
      case 'o':
      case 'O':
        e.preventDefault();
        ctx.camera('overview');
        break;
      case '[':
        e.preventDefault();
        ctx.togglePanel('sidebar');
        break;
      case ']':
        e.preventDefault();
        ctx.togglePanel('feed');
        break;
    }
  }

  // ---------------------------------------------------------------- inicio
  // O frame e o retangulo que o escritorio ocupa dentro da Growdash: os
  // paineis sao posicionados dentro dele, nao da janela.
  bindFrame(ctx);
  // A largura inicial decide se os paineis comecam abertos (como no Habblaud
  // solto na tela) ou recolhidos (tela estreita).
  narrow = frameSize().w <= NARROW_PX;
  panels.sidebar = narrow ? false : prefs.sidebarOpen;
  panels.feed = narrow ? false : prefs.feedOpen;
  // O host encolheu (ou cresceu): os paineis viram gaveta em telas estreitas.
  if (typeof ResizeObserver === 'function') {
    const host = frame();
    if (host) new ResizeObserver(() => onFrameResize()).observe(host);
  }
  world.setOptions(worldOptionsFrom(prefs));
  applyLayout();
  renderAll();
}
