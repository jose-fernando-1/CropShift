import type { Messages } from "@/i18n";

/** NASA and partner data shown in the footer (required by the challenge: list the NASA data used). */
export function nasaData(m: Messages) {
  return [{ name: m.footer.nasaPower, url: "https://power.larc.nasa.gov/docs/services/api/temporal/daily/" }];
}

export function otherData(m: Messages) {
  const s = m.footer.sources;
  return [
    { name: s.zarc, url: "https://dados.agricultura.gov.br/dataset/tabua-de-risco-zoneamento-agricola-de-risco-climatico" },
    { name: s.pam, url: "https://sidra.ibge.gov.br/tabela/5457" },
    { name: s.mesh, url: "https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" },
    { name: s.fao56, url: "https://www.fao.org/4/x0490e/x0490e00.htm" },
    { name: s.ecocrop, url: "https://ecocrop.apps.fao.org/ecocrop/srv/en/home" },
    { name: s.osm, url: "https://www.openstreetmap.org/copyright" },
  ];
}
