import LegalDocumentScreen from "@/components/LegalDocumentScreen";
import { legalDocuments } from "@/constants/legalDocuments";

export default function AiDisclosureScreen() {
  return <LegalDocumentScreen document={legalDocuments.aiDisclosure} />;
}
