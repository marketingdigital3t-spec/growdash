import {
  MOCK_SCENARIOS,
  MOCK_CAMPAIGNS,
  MOCK_RECOMMENDATIONS,
  MOCK_LEADS,
  MOCK_CREW,
  MOCK_CLASSES,
  type DashboardMockScenario,
  type CampaignRow,
  type AiRecommendation,
  type LeadCard,
  type CrewMember,
  type ClassBatch,
} from "@/lib/mock/mockData";
import type { Phase } from "@/lib/phase/phase";

/**
 * Camada de API assincrona da Growdash (secao 10 do Prompt Mestre).
 *
 * Toda leitura de dados passa por estas funcoes. Hoje elas retornam os dados
 * mockados realistas e coerentes com a fase ativa; amanha consumirao os
 * endpoints reais sem exigir alteracoes nos componentes de interface.
 */

const simDelay = (ms = 80) => new Promise((resolve) => setTimeout(resolve, ms));

export async function getDashboardData(phase: Phase): Promise<DashboardMockScenario> {
  await simDelay(60);
  return MOCK_SCENARIOS[phase] ?? MOCK_SCENARIOS.terra;
}

export async function getCampaignsData(): Promise<CampaignRow[]> {
  await simDelay(90);
  return [...MOCK_CAMPAIGNS];
}

export async function getAiRecommendations(): Promise<AiRecommendation[]> {
  await simDelay(80);
  return [...MOCK_RECOMMENDATIONS];
}

export async function getCrmLeads(): Promise<LeadCard[]> {
  await simDelay(100);
  return [...MOCK_LEADS];
}

export async function getCrewRanking(): Promise<CrewMember[]> {
  await simDelay(80);
  return [...MOCK_CREW];
}

export async function getClassBatches(): Promise<ClassBatch[]> {
  await simDelay(80);
  return [...MOCK_CLASSES];
}

export async function executeMissionCommand(commandId: string): Promise<{ success: boolean; message: string }> {
  await simDelay(240);
  return {
    success: true,
    message: `Comando ${commandId} executado com sucesso pela Torre de Controle.`,
  };
}
