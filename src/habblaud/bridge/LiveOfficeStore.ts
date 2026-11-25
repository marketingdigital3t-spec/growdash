// O store do escritorio alimentado pelos dados reais da Growdash.
//
// O `OfficeStore` do Habblaud espera um servidor SSE: quando o `connect()` e
// chamado, ele abre `/api/stream` e fica esperando snapshots. Na Growdash nao
// ha esse servidor; os snapshots vem do Supabase.
//
// Esta classe reusa o `OfficeStore` (que sabe reconciliar a UI, os indices de
// agentes e salas, e o feed) e substitui apenas a origem dos dados: em vez de
// abrir o stream, ela recebe os snapshots prontos e os publica.
import { OfficeStore } from "../client/src/net/store";
import type { FeedItem, OfficeSnapshot } from "../shared/types";

export class LiveOfficeStore extends OfficeStore {
  private rev = 0;

  constructor() {
    // `mock` desligado: nao ha stream nem simulador. Os snapshots chegam por
    // `publish()`.
    super({ mock: false });
  }

  /** Nao abre stream: a Growdash alimenta o escritorio por `publish()`. */
  override connect(): void {
    this.setConnection("open");
  }

  /**
   * Publica um snapshot novo. O `rev` cresce a cada publicacao: o store
   * descarta snapshots mais antigos, entao a ordem importa.
   */
  publish(snapshot: OfficeSnapshot, feed: FeedItem[] = []): void {
    this.rev += 1;
    const next: OfficeSnapshot = { ...snapshot, rev: this.rev };
    this.setSnapshot(next);
    if (feed.length) this.applyFeed(feed);
  }
}
