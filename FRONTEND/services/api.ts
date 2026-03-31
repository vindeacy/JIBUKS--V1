import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Get environment variables
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // @ts-ignore - Expo injects these at build time
  const value = process.env[key] ||
                Constants.expoConfig?.extra?.[key] ||
                defaultValue;
  
  console.log(`🔧 Environment variable ${key}:`, value);
  return value;
};

const LOCAL_IP = getEnvVar('EXPO_PUBLIC_LOCAL_IP', '192.168.1.69');
const API_PORT = getEnvVar('EXPO_PUBLIC_API_PORT', '4400');

// Build API base URL based on platform
const getBaseUrl = (): string => {
  // First priority: Check for full production URL
  const fullUrl = getEnvVar('EXPO_PUBLIC_API_URL');
  if (fullUrl) {
    console.log('✅ Using production API URL:', fullUrl);
    return fullUrl;
  }

  // Development fallback: construct URL based on platform
  console.log('⚠️  No production URL found, using development configuration');
  
  if (Platform.OS === 'android') {
    // Check if running on emulator or physical device
    // Emulator: use 10.0.2.2
    // Physical device: use local network IP
    const isEmulator = Constants.isDevice === false;
    const host = isEmulator ? '10.0.2.2' : LOCAL_IP;
    const url = `http://${host}:${API_PORT}/api`;
    console.log('🤖 Android URL:', url, isEmulator ? '(emulator)' : '(device)');
    return url;
  }

  if (Platform.OS === 'ios') {
    // iOS simulator uses localhost
    // Physical device uses local network IP
    const isSimulator = Constants.isDevice === false;
    const host = isSimulator ? 'localhost' : LOCAL_IP;
    const url = `http://${host}:${API_PORT}/api`;
    console.log('🍎 iOS URL:', url, isSimulator ? '(simulator)' : '(device)');
    return url;
  }

  // Web uses localhost
  const url = `http://localhost:${API_PORT}/api`;
  console.log('🌐 Web URL:', url);
  return url;
};

const API_BASE_URL = getBaseUrl();
const ENABLE_MOCK_FALLBACK = getEnvVar('EXPO_PUBLIC_ENABLE_MOCK_FALLBACK', 'false').toLowerCase() === 'true';

console.log('🌐 API Base URL:', API_BASE_URL);
console.log('📱 Platform:', Platform.OS);
console.log('🔧 Device:', Constants.isDevice ? 'Physical' : 'Simulator/Emulator');
console.log('🧪 Mock fallback enabled:', ENABLE_MOCK_FALLBACK);

// TypeScript interfaces
export type TenantType = 'FAMILY' | 'BUSINESS';

export interface User {
  id: number;
  email: string;
  name: string | null;
  tenantId: number | null;
  role?: 'OWNER' | 'ADMIN' | 'PARENT' | 'CHILD' | 'MEMBER';
  tenantType?: TenantType | null;
  avatarUrl?: string;
  createdAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  phone?: string;
  tenantType?: TenantType;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'LIABILITY_INC' | 'LIABILITY_DEC' | 'DEPOSIT';

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'transfer';
  color?: string;
  icon?: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  type?: string;
  isActive?: boolean;
}

export interface Account {
  id: string;
  name: string;
  code?: string;
  type: 'ASSET' | 'LIABILITY' | 'INCOME' | 'EXPENSE' | 'EQUITY';
  subtype?: string;
  currency?: string;
  parentAccountId?: string | null;
  balance?: number;
  isDefault?: boolean;
  isSystem?: boolean;
  isActive?: boolean;
  description?: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  description?: string;
  paymentMethod?: string;
  date: string;
  user?: { id: string; name: string };
  debitAccountId?: string;
  creditAccountId?: string;
  accountId?: string;
  notes?: string;
  payee?: string;
  splits?: { category: string; amount: number; description?: string; accountId?: string }[];
}

export interface TransactionStats {
  totalIncome: number;
  totalExpenses: number;
  net: number;
}

export interface ApiError {
  error: string;
}

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const token = await AsyncStorage.getItem('authToken');
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

// API Service
class ApiService {
  private baseUrl: string;
  private mockCategories: Category[] = [
    // Expense Categories
    { id: 'cat-exp-food', name: 'Food', type: 'expense', color: '#FF6B6B', icon: 'restaurant' },
    { id: 'cat-exp-transport', name: 'Transport', type: 'expense', color: '#4ECDC4', icon: 'car' },
    { id: 'cat-exp-housing', name: 'Housing', type: 'expense', color: '#45B7D1', icon: 'home' },
    { id: 'cat-exp-utilities', name: 'Utilities', type: 'expense', color: '#FFA07A', icon: 'flash' },
    { id: 'cat-exp-entertainment', name: 'Entertainment', type: 'expense', color: '#98D8C8', icon: 'film' },
    { id: 'cat-exp-health', name: 'Healthcare', type: 'expense', color: '#F7DC6F', icon: 'medical' },
    { id: 'cat-exp-education', name: 'Education', type: 'expense', color: '#BB8FCE', icon: 'school' },
    { id: 'cat-exp-shopping', name: 'Shopping', type: 'expense', color: '#85C1E2', icon: 'bag' },

    // Income Categories
    { id: 'cat-inc-salary', name: 'Salary', type: 'income', color: '#52C41A', icon: 'cash' },
    { id: 'cat-inc-business', name: 'Business', type: 'income', color: '#1890FF', icon: 'briefcase' },
    { id: 'cat-inc-investment', name: 'Investment', type: 'income', color: '#722ED1', icon: 'trending-up' },
    { id: 'cat-inc-gift', name: 'Gift', type: 'income', color: '#EB2F96', icon: 'gift' },
    { id: 'cat-inc-freelance', name: 'Freelance', type: 'income', color: '#13C2C2', icon: 'laptop' },
    { id: 'cat-inc-bonus', name: 'Bonus', type: 'income', color: '#FAAD14', icon: 'star' },
  ];

  private mockPaymentMethods: PaymentMethod[] = [
    { id: 'pm-cash', name: 'Cash', type: 'cash', isActive: true },
    { id: 'pm-mpesa', name: 'M-Pesa', type: 'mobile-money', isActive: true },
    { id: 'pm-card', name: 'Bank Card', type: 'card', isActive: true },
    { id: 'pm-transfer', name: 'Bank Transfer', type: 'transfer', isActive: true },
  ];

  private mockAccounts: Account[] = [
    // Assets
    { id: 'acct-1000', name: 'Cash on Hand', code: '1000', type: 'ASSET', currency: 'KES', balance: 5000, isDefault: true },
    { id: 'acct-1010', name: 'Checking Account', code: '1010', type: 'ASSET', currency: 'KES', balance: 15000 },
    { id: 'acct-1020', name: 'Savings Account', code: '1020', type: 'ASSET', currency: 'KES', balance: 50000 },
    { id: 'acct-1030', name: 'M-Pesa Wallet', code: '1030', type: 'ASSET', currency: 'KES', balance: 8500 },
    // Liabilities
    { id: 'acct-2000', name: 'Credit Card', code: '2000', type: 'LIABILITY', currency: 'KES', balance: 0 },
    { id: 'acct-2010', name: 'Loans Payable', code: '2010', type: 'LIABILITY', currency: 'KES', balance: 0 },
    // Equity
    { id: 'acct-3000', name: 'Family Equity', code: '3000', type: 'EQUITY', currency: 'KES', balance: 0 },
    // Income
    { id: 'acct-4000', name: 'Salary Income', code: '4000', type: 'INCOME', currency: 'KES', balance: 0 },
    { id: 'acct-4010', name: 'Business Income', code: '4010', type: 'INCOME', currency: 'KES', balance: 0 },
    { id: 'acct-4020', name: 'Investment Income', code: '4020', type: 'INCOME', currency: 'KES', balance: 0 },
    { id: 'acct-4030', name: 'Gift Income', code: '4030', type: 'INCOME', currency: 'KES', balance: 0 },
    // Expenses
    { id: 'acct-5000', name: 'Food & Groceries', code: '5000', type: 'EXPENSE', currency: 'KES', balance: 0 },
    { id: 'acct-5010', name: 'Transport', code: '5010', type: 'EXPENSE', currency: 'KES', balance: 0 },
    { id: 'acct-5020', name: 'Housing/Rent', code: '5020', type: 'EXPENSE', currency: 'KES', balance: 0 },
    { id: 'acct-5030', name: 'Utilities', code: '5030', type: 'EXPENSE', currency: 'KES', balance: 0 },
    { id: 'acct-5040', name: 'Healthcare', code: '5040', type: 'EXPENSE', currency: 'KES', balance: 0 },
    { id: 'acct-5050', name: 'Education', code: '5050', type: 'EXPENSE', currency: 'KES', balance: 0 },
    { id: 'acct-5060', name: 'Entertainment', code: '5060', type: 'EXPENSE', currency: 'KES', balance: 0 },
    { id: 'acct-5070', name: 'Shopping', code: '5070', type: 'EXPENSE', currency: 'KES', balance: 0 },
  ];

  private mockTransactions: Transaction[] = [
    {
      id: 'tx-1',
      type: 'EXPENSE',
      amount: 1250,
      category: 'Food',
      description: 'Groceries',
      paymentMethod: 'Cash',
      date: new Date().toISOString(),
      debitAccountId: 'acct-expenses',
      creditAccountId: 'acct-cash',
      user: { id: 'u1', name: 'You' },
    },
    {
      id: 'tx-2',
      type: 'INCOME',
      amount: 5000,
      category: 'Salary',
      description: 'Weekly pay',
      paymentMethod: 'Bank Transfer',
      date: new Date(Date.now() - 86400000).toISOString(),
      debitAccountId: 'acct-checking',
      creditAccountId: 'acct-revenue',
      user: { id: 'u1', name: 'You' },
    },
  ];

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private generateId(prefix: string) {
    return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private shouldUseMockFallback(context: string, error: any): boolean {
    if (!ENABLE_MOCK_FALLBACK) {
      console.error(`❌ ${context} failed (mock fallback disabled):`, error?.error || error?.message || error);
      return false;
    }

    console.warn(`⚠️ ${context} falling back to mock data (EXPO_PUBLIC_ENABLE_MOCK_FALLBACK=true)`);
    return true;
  }

  public async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const authHeaders = await getAuthHeaders();

    // Merge headers: Auth < explicit options
    // We construct a temporary headers object
    const headers: any = {
      ...authHeaders,
      ...options.headers,
    };

    // If Content-Type is not set, and body is a string (likely JSON), default it.
    // If body is FormData (object), do NOT set Content-Type, let fetch handle it (boundary).
    if (!headers['Content-Type'] && typeof options.body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    try {
      console.log(`📡 API Request Details:`, {
        method: options.method || 'GET',
        url: url,
        baseUrl: this.baseUrl,
        endpoint: endpoint,
        headers: headers,
        bodyType: typeof options.body,
        hasBody: !!options.body
      });

      const response = await fetch(url, {
        ...options,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...headers,
        },
      });

      console.log(`📲 API Response:`, {
        url: url,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: response.headers
      });

      const rawBody = await response.text();
      let data: any = {};
      if (rawBody) {
        try {
          data = JSON.parse(rawBody);
        } catch {
          data = { raw: rawBody };
        }
      }

      if (!response.ok) {
        console.error('❌ API Error Response:', {
          url: url,
          status: response.status,
          error: data.error,
          data: data
        });
        throw {
          error: data.error || data.message || data.raw || 'An error occurred',
        } as ApiError;
      }

      console.log('✅ API Success:', {
        url: url,
        status: response.status
      });

      return data as T;
    } catch (error: any) {
      // Don't log expected errors (user states that are normal)
      const expectedErrors = [
        'User is not part of any family',
        'Not part of a family',
        'No family found',
      ];

      const isExpectedError = expectedErrors.some(msg =>
        error.error && error.error.includes(msg)
      );

      if (!isExpectedError) {
        console.error('❌ API Error:', error);
      }

      if (error.error) {
        throw error as ApiError;
      }
      throw {
        error: error.message || 'Network error. Please check your connection.',
      } as ApiError;
    }
  }

  // Convenience methods
  public async get<T = any>(endpoint: string, params?: any): Promise<T> {
    const query = params ? `?${new URLSearchParams(params).toString()}` : '';
    const url = `${endpoint}${query}`;
    return this.request<T>(url);
  }

  public async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: (isFormData ? data : JSON.stringify(data)) as any,
    });
  }

  public async put<T = any>(endpoint: string, data?: any): Promise<T> {
    const isFormData = data instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: (isFormData ? data : JSON.stringify(data)) as any,
    });
  }

  public async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Authentication endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (response.accessToken) {
      await AsyncStorage.setItem('authToken', response.accessToken);
      await AsyncStorage.setItem('refreshToken', response.refreshToken);
    }

    return response;
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.accessToken) {
      await AsyncStorage.setItem('authToken', response.accessToken);
      await AsyncStorage.setItem('refreshToken', response.refreshToken);
    }

    return response;
  }

  async getCurrentUser(): Promise<User> {
    return this.request<User>('/auth/me', {
      method: 'GET',
    });
  }

  async refreshToken(): Promise<{ accessToken: string }> {
    const refreshToken = await AsyncStorage.getItem('refreshToken');

    const response = await this.request<{ accessToken: string }>('/auth/refresh-token', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });

    if (response.accessToken) {
      await AsyncStorage.setItem('authToken', response.accessToken);
    }

    return response;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } finally {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('refreshToken');
    }
  }

  async forgotPassword(email: string, phone?: string, deliveryMethod: 'email' | 'sms' = 'email'): Promise<any> {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, phone, deliveryMethod }),
    });
  }

  async verifyOtp(email: string, otp: string): Promise<any> {
    return this.request('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    });
  }

  async resetPassword(email: string, otp: string, newPassword: string): Promise<any> {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ email, otp, newPassword }),
    });
  }

  // Family endpoints
  async getFamily(): Promise<any> {
    return this.request('/family');
  }

  async updateFamily(data: { name?: string; metadata?: any }): Promise<any> {
    return this.request('/family', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  }

  async addFamilyMember(data: any): Promise<any> {
    const isFormData = data instanceof FormData;

    return this.request('/family/members', {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: (isFormData ? data : JSON.stringify(data)) as any,
    });
  }

  async createGoal(data: any): Promise<any> {
    return this.request('/family/goals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getGoals(): Promise<any> {
    return this.request('/family/goals');
  }

  async getGoal(goalId: number): Promise<any> {
    return this.request(`/goals/${goalId}`);
  }

  async contributeToGoal(goalId: number, amount: number, description?: string): Promise<any> {
    return this.request(`/goals/${goalId}/contribute`, {
      method: 'POST',
      body: JSON.stringify({ amount, description }),
    });
  }

  async getAnalytics(period: 'week' | 'month' | 'year' = 'month'): Promise<any> {
    return this.request(`/dashboard/analytics?period=${period}`);
  }

  // ============================================
  // PROFESSIONAL ACCOUNTING METHODS
  // ============================================

  // Vendors
  async getVendors(params?: { active?: boolean }): Promise<any[]> {
    const query = params?.active !== undefined ? `?active=${params.active}` : '';
    return this.request(`/vendors${query}`);
  }

  async getVendor(id: number): Promise<any> {
    return this.request(`/vendors/${id}`);
  }

  async createVendor(data: any): Promise<any> {
    const isFormData = data instanceof FormData;
    return this.request('/vendors', {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: (isFormData ? data : JSON.stringify(data)) as any,
    });
  }

  async updateVendor(id: number, data: any): Promise<any> {
    const isFormData = data instanceof FormData;
    return this.request(`/vendors/${id}`, {
      method: 'PUT',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: (isFormData ? data : JSON.stringify(data)) as any,
    });
  }

  // Purchases
  async getPurchases(params?: { status?: string; vendorId?: number }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.vendorId) query.append('vendorId', String(params.vendorId));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/purchases${suffix}`);
  }

  async getPurchase(id: number): Promise<any> {
    return this.request(`/purchases/${id}`);
  }



  async recordPurchasePayment(purchaseId: number, data: any): Promise<any> {
    return this.request(`/purchases/${purchaseId}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Inventory
  async getInventory(params?: { lowStock?: boolean; search?: string; page?: number; limit?: number; type?: string; category?: string }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.lowStock !== undefined) query.append('lowStock', String(params.lowStock));
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.type) query.append('type', params.type);
    if (params?.category) query.append('category', params.category);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    // Backend route: GET /api/inventory/products
    const res = await this.request(`/inventory/products${suffix}`);
    // Normalise shape so callers can keep using a plain array
    if (res && Array.isArray((res as any).data)) {
      return (res as any).data;
    }
    return Array.isArray(res) ? res : [];
  }

  async getInventoryItem(id: number): Promise<any> {
    // Backend route: GET /api/inventory/products/:id
    return this.request(`/inventory/products/${id}`);
  }

  async createInventoryItem(data: any): Promise<any> {
    // Backend route: POST /api/inventory/products
    return this.request('/inventory/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Inventory valuation is not yet implemented server-side; keep method for future use
  async getInventoryValuation(): Promise<any> {
    return this.request('/inventory/valuation/current');
  }

  async createStockAdjustment(data: any): Promise<any> {
    // Backend route: POST /api/inventory/adjust
    return this.request('/inventory/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createStockTransfer(data: any): Promise<any> {
    return this.request('/inventory/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async receiveStock(data: any): Promise<any> {
    return this.request('/inventory/receive', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Bank Transactions
  async getBankTransactions(params?: any): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.bankAccountId) query.append('bankAccountId', String(params.bankAccountId));
    if (params?.type) query.append('type', params.type);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/bank/transactions${suffix}`);
  }

  async createDeposit(data: any): Promise<any> {
    return this.request('/bank/deposit', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async writeCheque(data: any): Promise<any> {
    return this.request('/bank/cheque', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createBankTransfer(data: any): Promise<any> {
    return this.request('/bank/transfer', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Accounts (Chart of Accounts)
  async getAccounts(params?: { type?: string; includeBalances?: boolean }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.type) query.append('type', params.type);
    if (params?.includeBalances) query.append('includeBalances', 'true');
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/accounts${suffix}`);
  }

  // Customers
  async getCustomers(params?: {
    active?: boolean;
    search?: string;
    businessType?: string;
    limit?: number;
    offset?: number;
  }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.active !== undefined) query.append('active', String(params.active));
    if (params?.search) query.append('search', params.search);
    if (params?.businessType) query.append('businessType', params.businessType);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/customers${suffix}`);
  }

  async getCustomer(id: number): Promise<any> {
    return this.request(`/customers/${id}`);
  }

  async createCustomer(data: any): Promise<any> {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: number, data: any): Promise<any> {
    return this.request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getCustomerBalance(id: number): Promise<any> {
    return this.request(`/customers/${id}/balance`);
  }

  async getCustomerTransactions(id: number, params?: {
    limit?: number;
    offset?: number;
    type?: 'invoices' | 'payments';
  }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.type) query.append('type', params.type);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/customers/${id}/transactions${suffix}`);
  }

  async getCustomerAnalytics(id: number, params?: { period?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.period) query.append('period', params.period);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/customers/${id}/analytics${suffix}`);
  }

  async getCustomerStatement(id: number, params?: { startDate?: string; endDate?: string }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/customers/${id}/statement${suffix}`);
  }

  // Invoices
  async getInvoices(params?: { status?: string; customerId?: number }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.customerId) query.append('customerId', String(params.customerId));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/invoices${suffix}`);
  }

  // ============================================
  // LENDING / DEBT TRACKER METHODS
  // ============================================

  async getLendingDashboard(): Promise<any> {
    return this.request('/lending/dashboard');
  }

  async issueLoan(data: any): Promise<any> {
    return this.request('/lending/issue', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordLoanRepayment(data: any): Promise<any> {
    return this.request('/lending/repay', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async writeOffLoan(loanId: string): Promise<any> {
    return this.request(`/lending/${loanId}/write-off`, {
      method: 'POST',
    });
  }

  async getInvoice(id: number): Promise<any> {
    return this.request(`/invoices/${id}`);
  }

  async getPaymentEligibleAccounts(): Promise<any[]> {
    return this.request('/accounts/payment-eligible');
  }

  async createTransaction(transactionData: {
    type: TransactionType;
    amount: number;
    category: string;
    description?: string;
    paymentMethod?: string;
    date: string;
    notes?: string;
    debitAccountId?: number;
    creditAccountId?: number;
    payee?: string;
    splits?: { category: string; amount: number; description?: string; accountId?: string }[];
  }): Promise<Transaction> {
    return this.request('/transactions', {
      method: 'POST',
      body: JSON.stringify(transactionData),
    });
  }

  async createInvoice(data: any): Promise<any> {
    return this.request('/invoices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInvoice(id: number, data: any): Promise<any> {
    return this.request(`/invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async recordInvoicePayment(invoiceId: number, data: any): Promise<any> {
    return this.request(`/invoices/${invoiceId}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getUnpaidInvoices(): Promise<any[]> {
    return this.request('/invoices/status/unpaid');
  }


  async getCategories(): Promise<Category[]> {
    try {
      return await this.request<Category[]>('/categories');
    } catch (error) {
      if (this.shouldUseMockFallback('getCategories', error)) {
        return this.mockCategories;
      }
      throw error;
    }
  }

  async createCategory(data: { name: string; type: string; icon?: string; color?: string }): Promise<Category> {
    return this.request('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPaymentMethods(): Promise<PaymentMethod[]> {
    try {
      return await this.request<PaymentMethod[]>('/payment-methods');
    } catch (error) {
      if (this.shouldUseMockFallback('getPaymentMethods', error)) {
        return this.mockPaymentMethods;
      }
      throw error;
    }
  }

  async getTransactions(params: { type?: TransactionType; limit?: number } = {}): Promise<Transaction[]> {
    const query = new URLSearchParams();
    if (params.type) query.append('type', params.type);
    if (params.limit) query.append('limit', String(params.limit));
    const suffix = query.toString() ? `?${query.toString()}` : '';

    try {
      return await this.request<Transaction[]>(`/transactions${suffix}`);
    } catch (error) {
      if (this.shouldUseMockFallback('getTransactions', error)) {
        const filtered = params.type
          ? this.mockTransactions.filter(t => t.type === params.type)
          : this.mockTransactions;
        return filtered.slice(0, params.limit || filtered.length);
      }
      throw error;
    }
  }

  async getTransactionStats(): Promise<TransactionStats> {
    try {
      return await this.request<TransactionStats>('/transactions/stats');
    } catch (error) {
      if (this.shouldUseMockFallback('getTransactionStats', error)) {
        const income = this.mockTransactions
          .filter(t => t.type === 'INCOME')
          .reduce((sum, t) => sum + t.amount, 0);
        const expenses = this.mockTransactions
          .filter(t => t.type === 'EXPENSE')
          .reduce((sum, t) => sum + t.amount, 0);
        return {
          totalIncome: income,
          totalExpenses: expenses,
          net: income - expenses,
        };
      }
      throw error;
    }
  }

  async createPurchase(data: any): Promise<any> {
    const isFormData = data instanceof FormData;
    return this.request('/purchases', {
      method: 'POST',
      headers: isFormData ? {} : { 'Content-Type': 'application/json' },
      body: (isFormData ? data : JSON.stringify(data)) as any,
    });
  }

  async createPurchasePayment(purchaseId: number | string, data: {
    amount: number;
    paymentDate: string;
    paymentMethod: string;
    reference?: string;
    notes?: string;
    bankAccountId: number | string;
  }): Promise<any> {
    return this.request(`/purchases/${purchaseId}/payment`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Family Settings APIs
  async getFamilySettings(): Promise<any> {
    return this.request('/family/settings');
  }

  async getDashboardStats(): Promise<any> {
    return this.request('/family/dashboard');
  }

  async getDashboard(): Promise<any> {
    try {
      return await this.request('/family/dashboard');
    } catch (error) {
      if (this.shouldUseMockFallback('getDashboard', error)) {
        // Return mock dashboard data
        return {
          familyMembers: [
            { id: '1', name: 'You', role: 'OWNER' }
          ],
          goals: [],
          budgets: [],
          categorySpending: [],
          recentTransactions: this.mockTransactions.slice(0, 5),
          summary: {
            totalIncome: this.mockTransactions
              .filter(t => t.type === 'INCOME')
              .reduce((sum, t) => sum + t.amount, 0),
            totalExpenses: this.mockTransactions
              .filter(t => t.type === 'EXPENSE')
              .reduce((sum, t) => sum + t.amount, 0),
            balance: 0
          }
        };
      }
      throw error;
    }
  }

  /**
   * Business dashboard (CoA-based): revenue, expenses, AR, cash, counts, recent activity
   */
  async getBusinessDashboard(): Promise<{
    summary: { revenue: number; expenses: number; netIncome: number; cashBankBalance: number; arBalance: number };
    counts: { unpaidInvoices: number; overdueInvoices: number; customers: number };
    recentActivity: Array<{ id: string; date: string; type: string; description: string; amount: number }>;
    period: { startDate: string; endDate: string };
  }> {
    return this.request('/dashboard/business');
  }

  async getMemberDetails(memberId: string): Promise<any> {
    return this.request(`/family/members/${memberId}`);
  }

  async updateMemberPermissions(memberId: string, permissions: any): Promise<any> {
    return this.request(`/family/members/${memberId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions }),
    });
  }

  async updateMemberRole(memberId: string, role: string): Promise<any> {
    return this.request(`/family/members/${memberId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async removeFamilyMember(memberId: string): Promise<any> {
    return this.request(`/family/members/${memberId}`, {
      method: 'DELETE',
    });
  }

  async leaveFamily(): Promise<any> {
    return this.request('/family/leave', {
      method: 'DELETE',
    });
  }

  async deleteFamily(): Promise<any> {
    return this.request('/family', {
      method: 'DELETE',
    });
  }

  async updateFamilyProfile(name: string, avatarUri?: string | null): Promise<any> {
    const formData = new FormData();
    formData.append('name', name);

    if (avatarUri && !avatarUri.startsWith('http')) {
      const filename = avatarUri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('avatar', {
        uri: avatarUri,
        name: filename,
        type,
      } as any);
    }

    return this.request('/family/profile', {
      method: 'PUT',
      body: formData as any,
    });
  }

  // ============================================
  // CHART OF ACCOUNTS ENDPOINTS
  // ============================================

  async listAccounts(params: { type?: string; includeBalances?: boolean } = {}): Promise<Account[]> {
    const query = new URLSearchParams();
    if (params.type) query.append('type', params.type);
    if (params.includeBalances !== undefined) {
      query.append('includeBalances', String(params.includeBalances));
    }
    const suffix = query.toString() ? `?${query.toString()}` : '';

    console.log('📊 Fetching accounts from backend:', `/accounts${suffix}`);
    const accounts = await this.request<Account[]>(`/accounts${suffix}`);
    console.log('✅ Accounts loaded from database:', accounts.length);
    return accounts;
  }

  async getAccount(accountId: string): Promise<Account> {
    return this.request<Account>(`/accounts/${accountId}`);
  }

  async createAccount(account: { code: string; name: string; type: string; description?: string }): Promise<Account> {
    return this.request<Account>('/accounts', {
      method: 'POST',
      body: JSON.stringify(account),
    });
  }

  async updateAccount(accountId: string, data: Partial<Account>): Promise<Account> {
    return this.request<Account>(`/accounts/${accountId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAccount(accountId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/accounts/${accountId}`, {
      method: 'DELETE',
    });
  }

  async getAccountMapping(category?: string, type?: string): Promise<any> {
    const query = new URLSearchParams();
    if (category) query.append('category', category);
    if (type) query.append('type', type);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return this.request<any>(`/accounts/mapping${suffix}`);
  }

  async seedAccounts(): Promise<{ message: string; accountsCreated: number }> {
    return this.request('/accounts/seed', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async getAccountBalancesSummary(): Promise<any> {
    return this.request<any>('/accounts/balances/summary');
  }

  // ============================================
  // FINANCIAL REPORTS ENDPOINTS
  // ============================================

  async getTrialBalance(asOfDate?: string): Promise<any> {
    const query = asOfDate ? `?asOfDate=${asOfDate}` : '';
    return this.request<any>(`/reports/trial-balance${query}`);
  }

  async getProfitLoss(startDate?: string, endDate?: string): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return this.request<any>(`/reports/profit-loss${suffix}`);
  }

  async getCashFlow(startDate?: string, endDate?: string): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return this.request<any>(`/reports/cash-flow${suffix}`);
  }

  async getBalanceSheet(asOfDate?: string): Promise<any> {
    const query = asOfDate ? `?asOfDate=${asOfDate}` : '';
    return this.request<any>(`/reports/balance-sheet${query}`);
  }

  async getFinancialSummary(startDate?: string, endDate?: string): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return this.request<any>(`/reports/summary${suffix}`);
  }

  async getMonthlyTrend(months: number = 6): Promise<any> {
    return this.request<any>(`/reports/monthly-trend?months=${months}`);
  }

  async getCategoryAnalysis(startDate?: string, endDate?: string): Promise<any> {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    const suffix = query.toString() ? `?${query.toString()}` : '';

    return this.request<any>(`/reports/category-analysis${suffix}`);
  }

  async getAccountTransactions(accountId: string | number, params?: {
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number
  }): Promise<any> {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<any>(`/reports/account-transactions/${accountId}${suffix}`);
  }


  // ============================================
  // CHEQUE MANAGEMENT - Revolutionary Feature
  // ============================================

  /**
   * Get all pending cheques
   */
  async getPendingCheques(tenantId: number): Promise<any[]> {
    return this.request(`/cheques/pending?tenantId=${tenantId}`);
  }

  /**
   * Get all cheques (pending, cleared, voided)
   */
  async getAllCheques(tenantId: number): Promise<any[]> {
    return this.request(`/cheques/all?tenantId=${tenantId}`);
  }

  /**
   * Get cheque summary for dashboard widget
   * Returns: { count, totalAmount, bankBalance, realAvailable }
   */
  async getChequeSummary(tenantId: number): Promise<{
    count: number;
    totalAmount: number;
    bankBalance: number;
    realAvailable: number;
  }> {
    return this.request(`/cheques/summary?tenantId=${tenantId}`);
  }

  /**
   * Create a new cheque
   */
  async createCheque(data: {
    tenantId: number;
    chequeNumber: string;
    payee: string;
    amount: number;
    dueDate: string;
    bankAccountId: number;
    accountNumber?: string;
    purpose: string;
    notes?: string;
    reference?: string;
  }): Promise<any> {
    return this.request('/cheques/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Mark a cheque as cleared
   */
  async clearCheque(
    chequeId: number,
    data: {
      dateCleared: string;
      clearedById?: number;
      tenantId: number;
    }
  ): Promise<any> {
    return this.request(`/cheques/${chequeId}/clear`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Void a cheque
   */
  async voidCheque(chequeId: number, reason?: string): Promise<any> {
    return this.request(`/cheques/${chequeId}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  /**
   * Get a single cheque by ID
   */
  async getCheque(chequeId: number): Promise<any> {
    return this.request(`/cheques/${chequeId}`);
  }

  getImageUrl(path: string | null | undefined): string | undefined {
    if (!path) return undefined;
    if (path.startsWith('http')) return path;
    // Remove /api suffix to get root URL
    const rootUrl = this.baseUrl.endsWith('/api')
      ? this.baseUrl.slice(0, -4)
      : this.baseUrl;
    return `${rootUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  }
  // ============================================
  // FIXED ASSETS ENDPOINTS
  // ============================================

  async getFixedAssets(params?: { status?: string; active?: boolean }): Promise<any[]> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.active !== undefined) query.append('active', String(params.active));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<any[]>(`/fixed-assets${suffix}`);
  }

  async getFixedAsset(id: string | number): Promise<any> {
    return this.request<any>(`/fixed-assets/${id}`);
  }

  async getFixedAssetAccounts(): Promise<Account[]> {
    return this.request<Account[]>('/fixed-assets/accounts');
  }

  async createFixedAsset(data: any): Promise<any> {
    return this.request<any>('/fixed-assets', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFixedAsset(id: string | number, data: any): Promise<any> {
    return this.request<any>(`/fixed-assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async depreciateAsset(id: string | number, newValue: number): Promise<any> {
    return this.request<any>(`/fixed-assets/${id}/depreciate`, {
      method: 'POST',
      body: JSON.stringify({ newValue }),
    });
  }

  async disposeAsset(id: string | number, data: { disposalPrice: number; disposalAccountId?: number; date: string }): Promise<any> {
    return this.request<any>(`/fixed-assets/${id}/dispose`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // VAT RATES - Tax Configuration
  // ============================================

  /**
   * Get all active VAT rates for the tenant
   */
  async getVatRates(): Promise<any[]> {
    return this.request<any[]>('/vat-rates');
  }

  /**
   * Get specific VAT rate by ID
   */
  async getVatRate(id: string | number): Promise<any> {
    return this.request<any>(`/vat-rates/${id}`);
  }

  /**
   * Create a new VAT rate
   */
  async createVatRate(data: {
    name: string;
    rate: number;
    code: string;
    description?: string;
    isActive?: boolean;
  }): Promise<any> {
    return this.request<any>('/vat-rates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Update an existing VAT rate
   */
  async updateVatRate(id: string | number, data: {
    name?: string;
    rate?: number;
    description?: string;
    isActive?: boolean;
  }): Promise<any> {
    return this.request<any>(`/vat-rates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a VAT rate
   */
  async deleteVatRate(id: string | number): Promise<any> {
    return this.request<any>(`/vat-rates/${id}`, {
      method: 'DELETE',
    });
  }
}

export const apiService = new ApiService(API_BASE_URL);
export default apiService;