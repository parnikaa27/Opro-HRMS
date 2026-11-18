// The HOD approved and HR is next. It stays pending until HR decides.
export const isWaitingForHr = ({ status, hodApprovedOn }: { status: string; hodApprovedOn?: string }) => status === 'pending' && hodApprovedOn !== undefined;
