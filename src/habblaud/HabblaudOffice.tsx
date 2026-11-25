// O escritorio do Habblaud dentro da Growdash.
//
// Este componente monta as tres pecas do Habblaud sobre um container proprio:
//   1. o canvas do mundo (`createWorld`), que desenha o escritorio em pixel art;
//   2. o store (`LiveOfficeStore`), que alimenta o mundo com os snapshots;
//   3. a interface DOM (`createUI`), que monta os paineis sobre o canvas.
//
// Os snapshots vem do Supabase (ver `bridge/useOfficeData.ts`): as contas de
// anuncio sao as salas, os agentes do banco sao o CEO e os diretores, e cada
// sala tem um orquestrador com os seus agentes de execucao. Nada e ficticio:
// o que o escritorio mostra e o que a plataforma registrou.
import { useEffect, useRef } from "react";
import { createWorld } from "@/habblaud/client/src/world";
import { createUI } from "@/habblaud/client/src/ui";
import { LiveOfficeStore } from "@/habblaud/bridge/LiveOfficeStore";
import { buildFeedItems, buildOfficeSnapshot } from "@/habblaud/bridge/officeSnapshot";
import { useOfficeData } from "@/hooks/useOfficeData";

export type HabblaudOfficeProps = {
  /** Desliga a busca de dados (o escritorio fica vazio). */
  paused?: boolean;
};

export default function HabblaudOffice({ paused = false }: HabblaudOfficeProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const storeRef = useRef<LiveOfficeStore | null>(null);
  const { data, isError } = useOfficeData(!paused);

  // O mundo e a UI nascem uma vez; os dados sao publicados no store depois.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const canvas = document.createElement("canvas");
    canvas.id = "world";
    const uiRoot = document.createElement("div");
    uiRoot.id = "ui";
    host.append(canvas, uiRoot);

    const store = new LiveOfficeStore();
    storeRef.current = store;
    const world = createWorld(canvas, store);
    createUI(uiRoot, store, world);
    store.connect();

    return () => {
      store.disconnect();
      world.destroy();
      canvas.remove();
      uiRoot.remove();
      storeRef.current = null;
    };
  }, []);

  // Cada conjunto de dados novo vira um snapshot novo no escritorio.
  useEffect(() => {
    const store = storeRef.current;
    if (!store || !data) return;
    const snapshot = buildOfficeSnapshot(data);
    store.publish(snapshot, buildFeedItems(data, snapshot));
  }, [data]);

  return (
    <div ref={hostRef} className="habblaud-office-host" data-habblaud-office="1">
      {isError ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-6 text-center">
          <p className="max-w-sm rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-xs text-white/70">
            Não foi possível ler a operação agora. O escritório fica vazio até a próxima leitura.
          </p>
        </div>
      ) : null}
    </div>
  );
}
