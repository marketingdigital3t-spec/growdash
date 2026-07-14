import { ArrowLeft, DatabaseZap } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export default function HistoricalModule({ title, source, children }: { title: string; source: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-[1600px] historical-module">
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-[#dec36f] bg-gradient-to-r from-[#fff9e7] to-white p-4 sm:flex-row sm:items-center">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#15120d] text-[#f2c84d]"><DatabaseZap className="h-4 w-4" /></span>
        <div className="min-w-0 grow"><p className="text-[9px] font-black uppercase tracking-[.18em] text-[#9b7416]">Módulo original recuperado</p><h1 className="font-black">{title}</h1><p className="text-[10px] text-[#7e776f]">{source}</p></div>
        <Link to="/" className="gd-button"><ArrowLeft className="h-3.5 w-3.5" /> Visão executiva</Link>
      </div>
      {children}
    </div>
  );
}
