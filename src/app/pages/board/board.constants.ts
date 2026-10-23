export const DEFAULT_STATUSES = [
  { name: 'To do', color: '#fca5a5' },
  { name: 'Progress', color: '#fde047' },
  { name: 'Done', color: '#86efac' },
];


export const AUTO_STATUS_COLOR = '#d1d5db';


export const POLL_MS = 1000;


export interface ServerColumn {
  _id: string;
  name: string;
  color?: string;
  order?: number;
}
