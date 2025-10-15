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
