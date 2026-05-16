import LegalDocumentScreen from "@/components/LegalDocumentScreen";
import { legalDocuments } from "@/constants/legalDocuments";

export default function TermsScreen() {
  return <LegalDocumentScreen document={legalDocuments.terms} />;
}
