import { useQuery } from "@tanstack/react-query";
import Instance from "../instance";
import { Heading } from "@digdir/designsystemet-react";

interface Props {
  estateId: string;
}

export default function EstateDeclaration({ estateId }: Props) {
    const { data } = useQuery({
    queryKey: ["declarationinstance", estateId],
    queryFn: async () => {
      const response = await fetch(`/api/estate/${estateId}/declarationinstance`);
      if (!response.ok) {
        throw new Error("Failed to fetch instance");
      }
      return response.json();
    },
  });

  return (
    <>
      <Heading
        level={2}
        data-size="sm"
        style={{ marginBottom: "var(--ds-size-2)" }}
      >
        Skifteerklæring
      </Heading>
      <Instance data={data} />
    </>
  );
}