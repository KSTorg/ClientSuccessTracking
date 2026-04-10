export type ClientStatus = 'onboarding' | 'launched' | 'paused' | 'churned'

export const CLIENT_STATUSES: ClientStatus[] = [
  'onboarding',
  'launched',
  'paused',
  'churned',
]

export type Program = 'educator_incubator' | 'accelerator'

export const PROGRAMS: Program[] = ['educator_incubator', 'accelerator']

export const PROGRAM_LABELS: Record<Program, string> = {
  educator_incubator: 'Educator Incubator',
  accelerator: 'Accelerator',
}

export const PROGRAM_SHORT: Record<Program, string> = {
  educator_incubator: 'EI',
  accelerator: 'ACC',
}

export type Specialty = 'csm' | 'ads' | 'systems' | 'organic' | 'sales'

export const SPECIALTIES: Specialty[] = [
  'csm',
  'ads',
  'systems',
  'organic',
  'sales',
]

export const SPECIALTY_LABELS: Record<Specialty, string> = {
  csm: 'CSM',
  ads: 'Ads',
  systems: 'Systems',
  organic: 'Organic',
  sales: 'Sales',
}

export interface CsmOption {
  id: string
  full_name: string | null
  specialty?: Specialty | null
}

export interface ClientTeam {
  csm: string | null
  ads: string | null
  systems: string | null
  organic: string | null
  sales: string | null
}

export const EMPTY_CLIENT_TEAM: ClientTeam = {
  csm: null,
  ads: null,
  systems: null,
  organic: null,
  sales: null,
}

export interface Client {
  id: string
  company_name: string
  contact_name: string
  contact_email: string
  status: ClientStatus
  assigned_csm: string | null
  client_team: ClientTeam | null
  joined_date: string | null
  launched_date: string | null
  program_end_date: string | null
  is_imported: boolean
  churned_at: string | null
  notes: string | null
  user_id: string | null
  created_at: string
  program: Program
}

export interface ClientWithCsm extends Client {
  csm: CsmOption | null
}

export interface ClientWithCsmAndStats extends ClientWithCsm {
  task_total: number
  task_completed: number
}
