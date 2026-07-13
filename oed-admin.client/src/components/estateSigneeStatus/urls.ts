// receiptUrl points at the Altinn apps host, which our msal token is not valid for.
// Its path carries the ids our own proxy endpoint needs:
// .../instances/{ownerPartyId}/{instanceGuid}/data/{dataGuid}
// Note ownerPartyId is the instance owner, not the signee's partyId.
export const toProxyUrl = (receiptUrl: string): string | null => {
  try {
    const segments = new URL(receiptUrl).pathname.split("/");
    const dataGuid = segments.at(-1);
    const instanceGuid = segments.at(-3);
    const ownerPartyId = segments.at(-4);

    if (!dataGuid || !instanceGuid || !ownerPartyId) {
      return null;
    }
    return `/api/instances/${ownerPartyId}/${instanceGuid}/data/${dataGuid}`;
  } catch {
    return null;
  }
};

// subAppInstanceUrl points at Altinn Storage, which our msal token is not valid for.
// Its last two path segments are the ids our own proxy endpoint needs:
// .../storage/api/v1/instances/{ownerPartyId}/{instanceGuid}
// Note ownerPartyId is the instance owner, not the signee's partyId.
export const toInstanceProxyUrl = (
  subAppInstanceUrl: string,
): string | null => {
  try {
    const segments = new URL(subAppInstanceUrl).pathname.split("/");
    const instanceGuid = segments.at(-1);
    const ownerPartyId = segments.at(-2);

    if (!instanceGuid || !ownerPartyId) {
      return null;
    }
    return `/api/instances/${ownerPartyId}/${instanceGuid}`;
  } catch {
    return null;
  }
};

// The heir's subapp instance guid is the last path segment of subAppInstanceUrl (Altinn Storage):
// .../storage/api/v1/instances/{ownerPartyId}/{instanceGuid}
export const toSubAppInstanceGuid = (
  subAppInstanceUrl: string,
): string | null => {
  try {
    return new URL(subAppInstanceUrl).pathname.split("/").at(-1) || null;
  } catch {
    return null;
  }
};
