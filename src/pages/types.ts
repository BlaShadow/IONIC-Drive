export interface AuthResponse {
  access_token: string;
  id_token: string;
  login_hint: string;
  scope: string;
  expires_in: number;
  first_issued_at: number;
  expires_at: number;
}

export interface BasicProfile {
  getId(): string;
  getName(): string;
  getGivenName(): string;
  getFamilyName(): string;
  getImageUrl(): string;
  getEmail(): string;
}
