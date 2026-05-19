import { Tag } from "@digdir/designsystemet-react";
import { RobotIcon } from "@navikt/aksel-icons";

interface EnvironmentInformationProps {
  environment: string;
}

export default function EnvironmentInformation({
  environment,
}: EnvironmentInformationProps) {
  const formattedEnv = (env: string): string => {
    switch (env.toLowerCase()) {
      case "development":
        return "Lokalt utviklingsmiljø";
      case "staging":
        return "Testmiljø";
      case "production":
        return "Produksjonsmiljø";
      default:
        return "?";
    }
  };

  if (!environment || environment.toLowerCase() === "production") return;

  return (
    <Tag data-color="warning" data-size="lg" variant="outline">
      <RobotIcon
        width={28}
        height={28}
        style={{ marginRight: "var(--ds-size-1)" }}
      />
      {formattedEnv(environment)}
    </Tag>
  );
}
