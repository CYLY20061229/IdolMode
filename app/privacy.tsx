import LegalDocumentScreen from "@/components/LegalDocumentScreen";
import { legalDocuments } from "@/constants/legalDocuments";

export default function PrivacyScreen() {
  return <LegalDocumentScreen document={legalDocuments.privacy} />;
}
