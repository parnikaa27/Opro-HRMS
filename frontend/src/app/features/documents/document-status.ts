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

// The line under a document's name: why it was sent back, who adds a missing one, or the dates it runs between.
export const describeDocument = ({ status, uploadedBy, issuedOn, expiresOn, updatedOn, decisionNote }: DocumentEntry) => {
  if (status === 'rejected') {
    return `Sent back: ${decisionNote ?? ''}`;
  }
  if (status === 'missing') {
    return uploadedBy === 'employee' ? 'Upload a PDF, JPG or PNG' : 'HR adds this one';
  }
  const from = issuedOn ? `From ${formatCompactDate(issuedOn)}` : '';
  if (expiresOn) {
    const ends = `${status === 'expired' ? 'expired' : 'expires'} ${formatCompactDate(expiresOn)}`;
    return from ? `${from}, ${ends}` : ends.charAt(0).toUpperCase() + ends.slice(1);
  }
  return from || (updatedOn ? `Updated ${formatCompactDate(updatedOn)}` : 'On file');
};
