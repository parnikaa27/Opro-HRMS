import { DocumentEntry } from '../../models/company';
import { Tone } from '../../shared/ui/status-pill';
import { formatCompactDate } from '../../shared/utils/date-time';

const STATUS: Record<DocumentEntry['status'], { label: string; tone: Tone }> = {
  missing: { label: 'Missing', tone: 'neutral' },
  pending: { label: 'Waiting for HR', tone: 'late' },
  verified: { label: 'Verified', tone: 'ok' },
  rejected: { label: 'Sent back', tone: 'danger' },
  expired: { label: 'Expired', tone: 'danger' },
};

export const documentStatus = ({ status }: DocumentEntry) => STATUS[status];

// The line under a document's name: why it was sent back, when it runs out, or who adds a missing one.
export const describeDocument = ({ status, uploadedBy, expiresOn, updatedOn, decisionNote }: DocumentEntry) => {
  if (status === 'rejected') {
    return `Sent back: ${decisionNote ?? ''}`;
  }
  if (status === 'missing') {
    return uploadedBy === 'employee' ? 'Upload a PDF, JPG or PNG' : 'HR adds this one';
  }
  if (expiresOn) {
    return `${status === 'expired' ? 'Expired' : 'Expires'} ${formatCompactDate(expiresOn)}`;
  }
  return updatedOn ? `Updated ${formatCompactDate(updatedOn)}` : 'On file';
};
