import { ExpertOperationsView } from "@/components/expert/ExpertOperationsView";

/** Agenda & Turmas é a visão operacional principal, sem abas extras. */
export default function EventClasses() {
  return <main className="event-classes-page mx-auto w-full max-w-[1600px]"><ExpertOperationsView /></main>;
}
