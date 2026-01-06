export const statusColors: Record<string, string> = {
  MOTTATT: "neutral",
  FERDIGBEHANDLET: "success",
  FEILFORT: "danger",
  Created: "neutral",
  FirstHeirReceived: "info",
  DeclarationCreated: "info",
  DeclarationSubmitted: "info",
  ProbateIssued: "success",
  Unknown: "warning",
};

export const statusTexts: Record<string, string> = {
  MOTTATT: "Mottatt",
  FERDIGBEHANDLET: "Ferdigbehandlet",
  FEILFORT: "Feilført",
  Created: "Opprettet",
  FirstHeirReceived: "Arving(er) mottatt",
  DeclarationCreated: "Erklæring opprettet",
  DeclarationSubmitted: "Erklæring innsendt",
  ProbateIssued: "Skifteform besluttet",
  Unknown: "Ukjent",
};

export const statusDescriptions: Record<string, string> = {
  MOTTATT: "Mottatt",
  FERDIGBEHANDLET: "Ferdigbehandlet",
  FEILFORT: "Feilført",
  Created: "Dødsboet er opprettet av Tingretten og overført til Digitalt dødsbo.",
  FirstHeirReceived: "Tingretten har identifisert arvinger som skal få tilgang. Tidspunktet tilgangen aktiveres vises under.",
  DeclarationCreated: "Minst en arving har startet utfylling av skifteerklæring. Erklæringen er ikke sendt inn.",
  DeclarationSubmitted: "En av arvingene har sendt inn Erklæring om Privat skifte.",
  ProbateIssued: "Tingretten har behandlet dødsboet og besluttet hvilken skifteform som dødsboet skal ha.",
  Unknown: "Ukjent status på dødsboet. Kontakt DD-teamet!",
};