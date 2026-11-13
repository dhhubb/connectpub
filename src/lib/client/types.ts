export interface Category {
  id: number;
  name: string;
  slug: string;
  kind?: 'job' | 'service';
  icon: string | null;
  description?: string | null;
  group?: GroupRef | null;
  jobCount?: number;
  providerCount?: number;
}

export interface GroupRef {
  id?: number;
  name: string;
  slug: string;
  icon: string | null;
}

export interface Group {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  scope: 'job' | 'service' | 'both';
  description: string | null;
  jobCount: number;
  providerCount: number;
  categoryCount: number;
}

export interface Location {
  id: number;
  name: string;
  slug: string;
  kind: 'town' | 'ward' | 'village';
  notes?: string | null;
  jobCount: number;
  providerCount: number;
}

export interface Job {
  id: number;
  title: string;
  company: string;
  employerId: number;
  employerName?: string | null;
  category: Category | null;
  group: GroupRef | null;
  location: { id: number; name: string; kind: string } | null;
  jobType: string;
  jobTypeLabel: string;
  workMode: string;
  workModeLabel: string;
  salaryMin: number | null;
  salaryMax: number | null;
  currency: string;
  salaryLabel: string;
  vacancies: number;
  deadline: string | null;
  status: string;
  statusLabel: string;
  featured: boolean;
  views: number;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
  isExpired: boolean;
  description?: string;
  requirements?: string[];
  contactEmail?: string | null;
  contactPhone?: string | null;
  rejectionReason?: string | null;
  saved?: boolean;
  myApplication?: Application | false | null;
}

export interface Provider {
  id: number;
  ownerId: number;
  ownerName?: string | null;
  businessName: string;
  tagline: string | null;
  category: Category | null;
  group: GroupRef | null;
  location: { id: number; name: string; kind: string } | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  priceFrom: number | null;
  currency: string;
  yearsExperience: number;
  availability: string;
  availabilityLabel: string;
  status: string;
  verified: boolean;
  featured: boolean;
  rating: number | null;
  ratingCount: number;
  views: number;
  createdAt: string;
  description?: string;
  services?: string[];
  rejectionReason?: string | null;
  saved?: boolean;
  requestCount?: number;
  savedAt?: string;
}

export interface Application {
  id: number;
  jobId: number;
  applicantId: number;
  coverLetter: string | null;
  cvUrl: string | null;
  expectedSalary: number | null;
  status: string;
  statusLabel?: string;
  employerNote: string | null;
  createdAt: string;
  updatedAt: string;
  jobTitle?: string | null;
  company?: string | null;
  jobStatus?: string | null;
  locationName?: string | null;
  categoryName?: string | null;
  categoryIcon?: string | null;
  applicantName?: string | null;
  applicantEmail?: string | null;
  applicantPhone?: string | null;
  applicantWard?: string | null;
  applicantBio?: string | null;
}

export interface ServiceRequest {
  id: number;
  providerId: number;
  businessName: string;
  requesterId: number | null;
  requesterName?: string | null;
  name: string;
  phone: string;
  email: string | null;
  serviceNeeded: string;
  details: string | null;
  preferredDate: string | null;
  budget: number | null;
  status: string;
  statusLabel: string;
  response: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: number;
  providerId?: number;
  businessName?: string;
  userId?: number;
  userName?: string;
  rating: number;
  comment: string | null;
  status?: string;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: 'seeker' | 'employer' | 'provider' | 'admin';
  status: string;
  ward: string | null;
  bio: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  jobCount?: number;
  providerCount?: number;
  applicationCount?: number;
}

export interface AdminGroup {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
  scope: 'job' | 'service' | 'both';
  description: string | null;
  sortOrder?: number;
  categoryCount: number;
  jobCount: number;
  providerCount: number;
}

export interface AdminReview extends Review {
  businessName: string;
  userName: string;
  status: string;
}

export interface AuditEntry {
  id: number;
  actorId: number | null;
  actorName: string | null;
  action: string;
  entity: string;
  entityId: number | null;
  details: any;
  createdAt: string;
}

export interface AdminStats {
  counts: Record<string, number>;
  usersByRole: { label: string; count: number }[];
  jobsByStatus: { label: string; count: number }[];
  providersByStatus: { label: string; count: number }[];
  applicationsByStatus: { label: string; count: number }[];
  requestsByStatus: { label: string; count: number }[];
  jobsByCategory: { label: string; icon: string | null; count: number }[];
  providersByCategory: { label: string; icon: string | null; count: number }[];
  activityByLocation: { label: string; jobs: number; providers: number }[];
  signups: { day: string; users: number; jobs: number; providers: number; applications: number }[];
  topJobs: { id: number; title: string; company: string; views: number; applications: number }[];
  topProviders: { id: number; business_name: string; views: number; requests: number; rating: number | null }[];
  recentAudit: AuditEntry[];
}
