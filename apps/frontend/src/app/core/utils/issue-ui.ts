import { TranslationService } from '../i18n/translation.service';

export function issueStatusClass(status: string): string {
  return status.toLowerCase().replace(/_/g, '-');
}

export function formatIssueStatus(status: string, i18n?: TranslationService): string {
  if (i18n) return i18n.tEnum('status', status);
  return status.replace(/_/g, ' ');
}