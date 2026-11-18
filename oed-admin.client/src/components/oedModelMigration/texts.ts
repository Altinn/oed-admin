import type { CopyResult, Phase } from "./api";

/** What setting each phase does, shown before the person confirms (Altinn/oed#1923 §4.1). */
export const phaseConsequences: Record<Phase, string> = {
  Storage:
    "Storage er en pause. Dødsbo som allerede har en rad i databasen, blir der. Ingenting flyttes tilbake til Storage.",
  Migrating:
    "Hver skriving til et dødsbo uten rad i databasen kopierer det dit først. Fra og med første kopi gjelder regel 5: deploy aldri et oed-bygg eldre enn #1904 til dette miljøet, heller ikke med redeploy i Studio.",
  Database:
    "Et dødsbo uten rad i databasen kan ikke lenger leses eller skrives. oed tillater det bare etter en verify-kjøring som sier ready.",
};

export type Severity = "success" | "info" | "warning" | "danger";

export interface CopyVerdict {
  severity: Severity;
  message: string;
  /** Only a 503: the person may ask once more, after this many seconds. */
  retryAfterSeconds?: number;
}

const forbiddenMessage =
  "oed avviste oed-admin sitt token. Har oed-admin fått scopet digdir:dd:systemadmin?";

const unexpected = (result: CopyResult): CopyVerdict => ({
  severity: "danger",
  message: `Uventet svar fra oed (${result.status}${result.copy ? `, ${result.copy.outcome}` : ""}).`,
});

/**
 * What a copy's answer means for the person (Altinn/oed#1923 §4.2). A 404, 409 or 502 counts as oed's copy answer
 * only when its body says so; a 404 from routing or a 502 from the ingress is unexpected, not "no such instance".
 */
export const describeCopy = (result: CopyResult): CopyVerdict => {
  const outcome = result.copy?.outcome;
  switch (result.status) {
    case 0:
      return { severity: "danger", message: "Fikk ikke svar fra oed. Sjekk instansen før du prøver igjen." };
    case 401:
    case 403:
      return { severity: "danger", message: forbiddenMessage };
    case 404:
      return outcome === "InstanceNotFound"
        ? { severity: "danger", message: "Instansen finnes ikke." }
        : unexpected(result);
    case 409:
      return outcome === "NotAllowed"
        ? { severity: "danger", message: "Kopiering er ikke tillatt: BlockAppLibOedDataRoutes er av i oed." }
        : unexpected(result);
    case 502:
      return result.copy?.failure === "StorageError"
        ? { severity: "danger", message: "Storage feilet. Ingenting ble lagret. Prøv igjen senere." }
        : unexpected(result);
    case 503:
      return {
        severity: "warning",
        message: "Dødsboet var opptatt med en annen skriving. Ingenting ble lagret.",
        retryAfterSeconds: result.retryAfterSeconds ?? 10,
      };
    case 200:
      break;
    default:
      return unexpected(result);
  }

  switch (outcome) {
    case "Copied":
      return { severity: "success", message: "Kopiert. Dødsboet leses og skrives nå i databasen." };
    case "AlreadyMigrated":
      return { severity: "success", message: "Dødsboet hadde allerede en rad. Ingenting ble endret." };
    case "NoOedElement":
      return {
        severity: "warning",
        message:
          "Instansen finnes, men har ikke noe oed-element, og dødsboet har ingen rad. Det er ingenting å kopiere. Dette må en person se på.",
      };
    case "Failed":
      return {
        severity: "danger",
        message: `Kopien feilet (${result.copy?.failure ?? "ukjent"}). Ingenting ble lagret, og dødsboet blir i Storage. Dette må en person se på.`,
      };
    default:
      return { severity: "danger", message: `Uventet utfall fra oed: ${outcome ?? "(mangler)"}.` };
  }
};

/** What a phase answer that isn't 200 means. A 409's detail is oed's reason and is shown as is. */
export const describePhaseRefusal = (status: number): string => {
  switch (status) {
    case 0:
      return "Fikk ikke svar fra oed.";
    case 400:
      return "oed avviste forespørselen (400).";
    case 401:
    case 403:
      return forbiddenMessage;
    case 409:
      return "oed nektet endringen:";
    case 200:
      // 200 without a phase oed-admin could read: oed changed its answer, or sent something else.
      return "Uventet svar fra oed: svaret manglet fasen.";
    default:
      return `Uventet svar fra oed (${status}).`;
  }
};
