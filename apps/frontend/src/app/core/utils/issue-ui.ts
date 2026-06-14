export function issueStatusClass(status: string): string {
  return status.toLowerCase().replace(/_/g, '-');
}

export function formatIssueStatus(status: string): string {
  return status.replace(/_/g, ' ');
}