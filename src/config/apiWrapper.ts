import environment from '@/config/env';
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

class ApiWrapper {
  private readonly axiosInstance: AxiosInstance;

  get api(): AxiosInstance {
    return this.axiosInstance;
  }

  constructor(config: AxiosRequestConfig) {
    this.axiosInstance = axios.create(config);
  }

  setAuthToken(token: string): void {
    this.axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  clearAuthToken(): void {
    delete this.axiosInstance.defaults.headers.common.Authorization;
  }
}

export const apiWrapper = new ApiWrapper({
  baseURL: environment.NEXT_PUBLIC_BASE_URL
});
