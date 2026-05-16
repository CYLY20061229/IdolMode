import LegalDocumentScreen from "@/components/LegalDocumentScreen";
import { legalDocuments } from "@/constants/legalDocuments";

export default function AccountDeletionScreen() {
  return <LegalDocumentScreen document={legalDocuments.accountDeletion} />;
}
