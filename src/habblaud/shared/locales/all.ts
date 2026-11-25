// Dicionarios de idioma do Habblaud.
//
// O Habblaud original traz os dicionarios de ingles, espanhol e frances (o
// portugues e a lingua de origem: cada texto ja esta escrito em PT e o
// `tr()` devolve o proprio texto quando nao ha traducao).
//
// A Growdash e exclusivamente em portugues-BR, entao nao ha traducao para
// carregar: este dicionario fica vazio de proposito. O `tr()` cai no texto em
// portugues, que e exatamente o que a interface precisa mostrar.
//
// Se a Growdash ganhar outros idiomas, e aqui que entram os dicionarios.
import type { Locale } from '../i18n';

export const DICTIONARIES: Partial<Record<Locale, Readonly<Record<string, string>>>> = {};
