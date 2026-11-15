/**
 * Text the MOCK backend generates (the real backend localizes its own text
 * per Accept-Language; see contract/README.md). English strings are the ones
 * the golden contract examples were generated with.
 */
import type { Locale } from "@/i18n";

const en = {
  // English crop names and gate notes come from catalog.json; other locales override them here.
  cropNames: {} as Partial<Record<string, string>>,
  gateNotes: {} as Partial<Record<string, string>>,
  sources: {
    synthetic: "Synthetic mock values (not real results)",
    prototype: "Cropshift prototype engine, São Bento do Una (digitized chart)",
  },
  excluded: {
    gateFailed: (rho: number | null) =>
      `Own estimate not reliable: the engine does not reproduce ZARC for this crop (rank correlation ${rho}).`,
    notRun: "Not ranked yet: the water-balance engine has not been validated for this crop.",
  },
  strengths: {
    window: (w: string, p: string) => `${w} succeeded in ${p} of 40 simulated seasons on average.`,
    insideZarc: "The best simulated window sits inside the official ZARC window.",
    legume: "Legume: it can fix nitrogen, which helps the next crop.",
  },
  risks: {
    narrow: (n: number) => `Narrow window: only ${n} ${n === 1 ? "dekad reaches" : "dekads reach"} 70% success.`,
    none: "No dekad reaches 70% success in the simulation.",
    late: (d: string) => `Success drops below 50% from ${d}: planting late is risky.`,
    outsideZarc: (n: number) =>
      `${n} ${n === 1 ? "dekad looks" : "dekads look"} good in the simulation but ${n === 1 ? "is" : "are"} outside the ZARC window.`,
    lowYield: (local: string, state: string) => `Recorded yields here (median ${local}) are below the state median (${state}).`,
    sandy: "Sandy soil stores less water; dry spells hurt more.",
  },
  missing: {
    irrigated: "No irrigated ZARC mapping for your soil class (irrigated ZARC uses AD classes 11–16).",
    commonBean: "Rainfed ZARC for common bean uses AD soil classes (11–16); there is no mapping from your soil class yet.",
    noZarc: "No ZARC window for this crop, soil and municipality.",
    noPam: "No PAM yield series for this crop in this municipality.",
    notSurveyed: "PAM does not survey this crop.",
    soilAssumed: "Soil water capacity is assumed (0.11 m³/m³), not measured.",
  },
  confidence: {
    gateFailed: "The crop did not pass the quality gate against ZARC.",
    noZarc: "No official ZARC window to compare the engine with.",
    bestClass: (d: string, v: number) => `The engine's best dekad (${d}) is in ZARC's best class (value ${v}).`,
    inside: (d: string) => `The engine's best dekad (${d}) is inside the ZARC window, but not in its best class.`,
    outside: (d: string) => `The engine's best dekad (${d}) is outside the ZARC window.`,
    otherCell: "Your point is in a different climate cell than the municipality centroid.",
  },
  disclaimers: {
    mock: "Demo data: success probabilities are synthetic. ZARC windows and PAM yields are real public data.",
    scale: "Climate comes from NASA POWER cells of 0.5° × 0.625° (about 55 × 69 km). It does not describe your field.",
    soil: "Soil water is an assumption (0.11 m³/m³ available water, sandy loam), not a measurement.",
    rain: "Rainfall is POWER's; in 2024 IMERG measured about 37% less at the test point. Results depend on the rain source.",
    validation: "Independent validation against PAM yields is weak to moderate (rank correlation +0.33 to +0.48, one point).",
    zarc: "ZARC is also built from a water balance, so agreeing with it shows consistency with the official method, not field success.",
    dekad: "Dekad 1 is assumed to be Jan 1–10, and ZARC values 20/30/40 are shown as-is; their meaning as risk % is not confirmed.",
  } as Record<string, string>,
  errors: {
    powerDown: "NASA POWER did not answer in time. Try again in a minute.",
    invalidRequest: "Send lat/lon or municipality_code, plus optional soil_class (1-3) and regime.",
    invalidCoordinates: "Latitude must be in [-90, 90] and longitude in [-180, 180].",
    municipalityNotCovered: "This municipality is not covered. Cropshift covers Pernambuco only.",
    pointNotCovered: "This point is outside Pernambuco. Cropshift covers Pernambuco only.",
    noData: "There is no precomputed climate data for this place yet.",
    explainDown: "The explanation service failed.",
    unknownId: "Unknown analysis id.",
  },
};

type MockMessages = typeof en;

const ptBR: MockMessages = {
  cropNames: {
    cowpea: "Feijão-caupi",
    peanut: "Amendoim",
    sorghum: "Sorgo granífero",
    maize: "Milho (1ª safra)",
    common_bean: "Feijão comum",
    sunflower: "Girassol",
    castor: "Mamona",
  },
  gateNotes: {
    cowpea: "O motor de balanço hídrico reproduz a janela do ZARC (protótipo, um ponto).",
    peanut: "O motor de balanço hídrico reproduz a janela do ZARC (protótipo, um ponto).",
    sorghum: "O motor de balanço hídrico reproduz a janela do ZARC (protótipo, um ponto).",
    maize: "Ficha FAO-56 pronta; motor ainda não rodado.",
    common_bean: "Ficha FAO-56 pronta; motor ainda não rodado. O ZARC de sequeiro usa só classes de solo AD.",
    sunflower: "Ficha FAO-56 pronta; motor ainda não rodado.",
    castor: "O motor não reproduz a janela do ZARC (melhores decêndios simulados 7–11 contra ZARC 14–19).",
  },
  sources: {
    synthetic: "Valores sintéticos de demonstração (não são resultados reais)",
    prototype: "Motor protótipo do Cropshift, São Bento do Una (gráfico digitalizado)",
  },
  excluded: {
    gateFailed: (rho) =>
      `Estimativa própria não confiável: o motor não reproduz o ZARC para esta cultura (correlação de postos ${rho === null ? "—" : String(rho).replace(".", ",")}).`,
    notRun: "Ainda fora do ranking: o motor de balanço hídrico não foi validado para esta cultura.",
  },
  strengths: {
    window: (w, p) => `${w} deu certo em ${p} das 40 safras simuladas, em média.`,
    insideZarc: "A melhor janela simulada fica dentro da janela oficial do ZARC.",
    legume: "Leguminosa: pode fixar nitrogênio, o que ajuda a cultura seguinte.",
  },
  risks: {
    narrow: (n) => `Janela estreita: só ${n} ${n === 1 ? "decêndio chega" : "decêndios chegam"} a 70% de sucesso.`,
    none: "Nenhum decêndio chega a 70% de sucesso na simulação.",
    late: (d) => `O sucesso cai abaixo de 50% a partir de ${d}: plantar tarde é arriscado.`,
    outsideZarc: (n) =>
      `${n} ${n === 1 ? "decêndio parece bom" : "decêndios parecem bons"} na simulação, mas ${n === 1 ? "fica" : "ficam"} fora da janela do ZARC.`,
    lowYield: (local, state) => `O rendimento registrado aqui (mediana ${local}) está abaixo da mediana do estado (${state}).`,
    sandy: "Solo arenoso guarda menos água; os veranicos pesam mais.",
  },
  missing: {
    irrigated: "Não há correspondência do ZARC irrigado para a sua classe de solo (o ZARC irrigado usa as classes AD 11–16).",
    commonBean: "O ZARC de sequeiro do feijão comum usa classes de solo AD (11–16); ainda não há correspondência com a sua classe de solo.",
    noZarc: "Não há janela do ZARC para esta cultura, solo e município.",
    noPam: "Não há série de rendimento da PAM para esta cultura neste município.",
    notSurveyed: "A PAM não pesquisa esta cultura.",
    soilAssumed: "A capacidade de água do solo é uma premissa (0,11 m³/m³), não uma medida.",
  },
  confidence: {
    gateFailed: "A cultura não passou na porta de qualidade contra o ZARC.",
    noZarc: "Não há janela oficial do ZARC para comparar com o motor.",
    bestClass: (d, v) => `O melhor decêndio do motor (${d}) está na melhor classe do ZARC (valor ${v}).`,
    inside: (d) => `O melhor decêndio do motor (${d}) está dentro da janela do ZARC, mas não na melhor classe.`,
    outside: (d) => `O melhor decêndio do motor (${d}) está fora da janela do ZARC.`,
    otherCell: "O seu ponto está numa célula climática diferente da do centroide do município.",
  },
  disclaimers: {
    mock: "Dados de demonstração: as probabilidades de sucesso são sintéticas. As janelas do ZARC e os rendimentos da PAM são dados públicos reais.",
    scale: "O clima vem de células do NASA POWER de 0,5° × 0,625° (cerca de 55 × 69 km). Não descreve a sua área.",
    soil: "A água do solo é uma premissa (0,11 m³/m³ de água disponível, franco-arenoso), não uma medida.",
    rain: "A chuva é a do POWER; em 2024 o IMERG mediu cerca de 37% menos no ponto de teste. Os resultados dependem da fonte de chuva.",
    validation: "A validação independente contra a PAM é fraca a moderada (correlação de postos de +0,33 a +0,48, um ponto).",
    zarc: "O ZARC também vem de balanço hídrico; concordar com ele mostra coerência com o método oficial, não sucesso no campo.",
    dekad: "Assume-se que o decêndio 1 é 1–10 de janeiro, e os valores 20/30/40 do ZARC aparecem como estão; o significado como risco em % não foi confirmado.",
  },
  errors: {
    powerDown: "O NASA POWER não respondeu a tempo. Tente de novo em um minuto.",
    invalidRequest: "Envie lat/lon ou municipality_code, e opcionalmente soil_class (1-3) e regime.",
    invalidCoordinates: "A latitude deve estar em [-90, 90] e a longitude em [-180, 180].",
    municipalityNotCovered: "Este município não está coberto. O Cropshift cobre só Pernambuco.",
    pointNotCovered: "Este ponto está fora de Pernambuco. O Cropshift cobre só Pernambuco.",
    noData: "Ainda não há dados climáticos pré-calculados para este local.",
    explainDown: "O serviço de explicação falhou.",
    unknownId: "Id de análise desconhecido.",
  },
};

export function mockMessages(locale: Locale): MockMessages {
  return locale === "pt-BR" ? ptBR : en;
}
