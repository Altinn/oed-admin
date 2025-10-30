import { Alert } from "@digdir/designsystemet-react";

interface EnvironmentInformationProps {
  environment: string;
}

export default function EnvironmentInformation({environment} : EnvironmentInformationProps) {
  
  const formattedEnv = (env: string) : string => {
    switch(env) {
      case "development": return "Lokalt utviklingsmiljø";
      case "staging": return "Testmiljø";
      case "production": return "Produksjonsmiljø";
      default: return "?";
    }
  }

  if (environment == "production") return;
  
  return (
    <Alert 
      data-color="warning"
      style={{ 
        position: "fixed",
        top: "1em", 
        //width: "20vw", 
        left: "50%", 
        transform: "translate(-50%, 0)" 
      }}>
      {formattedEnv(environment)}
    </Alert>
  );
}