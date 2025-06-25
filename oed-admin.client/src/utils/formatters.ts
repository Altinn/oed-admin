export const formatRoleCode = (roleCode: string) => {
  return roleCode.split(":").pop();
};

export const formatDate = (dateString: string) => {
  if (!dateString || isNaN(Date.parse(dateString))) {
    return "Ugyldig dato";
  }

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nb-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
};

export const formatDateTime = (dateString: string) => {
  if (!dateString || isNaN(Date.parse(dateString))) {
    return "Ugyldig dato";
  }

  const date = new Date(dateString);
  return new Intl.DateTimeFormat("nb-NO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

export const isValidDateTime = (val: unknown): val is string =>
  typeof val === "string" && val.includes("T") && !isNaN(Date.parse(val));

export const isValidDate = (val: unknown): val is string =>
  typeof val === "string" && !isNaN(Date.parse(val));

const pad2 = (num: number) : string => num.toString().padStart(2, "0");
export const formatDateTimeLocal = (dateTime: Date) => 
    `${dateTime.getFullYear()}-${pad2((dateTime.getMonth() + 1))}-${pad2((dateTime.getDate()))}T${pad2((dateTime.getHours()))}:${pad2((dateTime.getMinutes()))}`;


export const prettifyXml = (sourceXml: string) =>
{
    const xmlDoc = new DOMParser().parseFromString(sourceXml, 'application/xml');
    const xsltDoc = new DOMParser().parseFromString([
        // describes how we want to modify the XML - indent everything
        '<xsl:stylesheet xmlns:xsl="http://www.w3.org/1999/XSL/Transform">',
        '  <xsl:strip-space elements="*"/>',
        '  <xsl:template match="para[content-style][not(text())]">', // change to just text() to strip space in text nodes
        '    <xsl:value-of select="normalize-space(.)"/>',
        '  </xsl:template>',
        '  <xsl:template match="node()|@*">',
        '    <xsl:copy><xsl:apply-templates select="node()|@*"/></xsl:copy>',
        '  </xsl:template>',
        '  <xsl:output indent="yes"/>',
        '</xsl:stylesheet>',
    ].join('\n'), 'application/xml');

    const xsltProcessor = new XSLTProcessor();    
    xsltProcessor.importStylesheet(xsltDoc);
    const resultDoc = xsltProcessor.transformToDocument(xmlDoc);
    const resultXml = new XMLSerializer().serializeToString(resultDoc);
    return resultXml;
};