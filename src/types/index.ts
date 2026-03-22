// User Types
export interface User {
  $id: string;
  email: string;
  name: string;
  phone?: string;
  prefs?: Record<string, any>;
  emailVerification: boolean;
  phoneVerification: boolean;
  status: boolean;
}

export interface Session {
  $id: string;
  userId: string;
  expire: string;
  provider: string;
  current: boolean;
}

// Player Types
export interface YouthPlayer {
  $id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  grade?: string;
  school?: string;
  position?: string;
  parentId: string;
  emergencyContact?: string;
  medicalInfo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollegiatePlayer {
  $id: string;
  userId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  college?: string;
  major?: string;
  graduationYear?: string;
  position?: string;
  createdAt: string;
  updatedAt: string;
}

// Event Types
export interface TeamTrainingEvent {
  $id: string;
  title: string;
  description?: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  maxParticipants?: number;
  coachId?: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt: string;
}

export interface EventSignup {
  $id: string;
  eventId: string;
  playerId: string;
  parentId: string;
  signupDate: string;
  status: 'confirmed' | 'cancelled' | 'waitlist';
}

export interface EventCheckin {
  $id: string;
  eventId: string;
  playerId: string;
  checkinTime: string;
  checkoutTime?: string;
}

// Billing Types
export interface Bill {
  $id: string;
  parentId: string;
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  createdAt: string;
  paidAt?: string;
}

export interface BillItem {
  $id: string;
  billId: string;
  description: string;
  amount: number;
  quantity: number;
  eventId?: string;
}

export interface Payment {
  $id: string;
  billId: string;
  parentId: string;
  amount: number;
  paymentMethod: string;
  stripePaymentIntentId?: string;
  status: 'pending' | 'succeeded' | 'failed';
  createdAt: string;
}

// Family Types
export interface FamilyRelationship {
  $id: string;
  parentId: string;
  childId: string;
  relationship: 'parent' | 'guardian';
  canManage: boolean;
  createdAt: string;
}

export interface FamilyInvitation {
  $id: string;
  parentId: string;
  inviteeEmail: string;
  invitationCode: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  expiresAt: string;
  createdAt: string;
}

// Message Types
export interface Message {
  $id: string;
  senderId: string;
  recipientId: string;
  subject?: string;
  content: string;
  read: boolean;
  createdAt: string;
}

// Auth Types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials extends LoginCredentials {
  name: string;
  phone?: string;
}

export interface PasswordResetRequest {
  email: string;
}
