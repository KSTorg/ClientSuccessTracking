export type ClientStatus = 'onboarding' | 'launched' | 'paused' | 'churned'

export const CLIENT_STATUSES: ClientStatus[] = [
  'onboarding',
  'launched',
  'paused',
  'churned',
]

export interface CsmOption {
  id: string
  full_name: string | null
}

export interface Client {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  status: ClientStatus
  assigned_csm: string | null
  joined_date: string | null
  launched_date: string | null
  notes: string | null
  user_id: string | null
  created_at: string
}

export interface ClientWithCsm extends Client {
  csm: CsmOption | null
}

export interface ClientWithCsmAndStats extends ClientWithCsm {
  task_total: number
  task_completed: number
}
