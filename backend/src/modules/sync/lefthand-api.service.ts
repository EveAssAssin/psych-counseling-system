import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

/**
 * 左手系統 API 服務
 * 用於同步員工資料
 */
@Injectable()
export class LefthandApiService {
  private readonly logger = new Logger(LefthandApiService.name);
  
  // API 設定
  private readonly MAP_API_URL = 'https://map.lohasglasses.com/_api/v1.ashx';
  private readonly AES_KEY = 'GmAOoS003d5OJ2G2';
  private readonly AES_IV = 'bgfDcfWdWG6NSUr5';

  constructor(private readonly configService: ConfigService) {}

  /**
   * AES 加密
   */
  private encrypt(text: string): string {
    const cipher = crypto.createCipheriv(
      'aes-128-cbc',
      Buffer.from(this.AES_KEY, 'utf8'),
      Buffer.from(this.AES_IV, 'utf8'),
    );
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return encrypted;
  }

  /**
   * AES 解密
   */
  private decrypt(encryptedText: string): string {
    const decipher = crypto.createDecipheriv(
      'aes-128-cbc',
      Buffer.from(this.AES_KEY, 'utf8'),
      Buffer.from(this.AES_IV, 'utf8'),
    );
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * API #13 - 取得全部人員客戶編號（除了離職店家人員）
   * 這是主要的員工同步 API
   */
  async getAllEmployees(): Promise<{
    success: boolean;
    data: EmployeeApiData[];
    message: string;
  }> {
    try {
      this.logger.log('Fetching all employees from Lefthand API...');

      const response = await axios.post(
        this.MAP_API_URL,
        {
          method: 'getallemployees',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000, // 60 秒超時
        },
      );

      const result = response.data;

      if (result.statecode === '0') {
        const employees = Array.isArray(result.data) ? result.data : [];
        this.logger.log(`Successfully fetched ${employees.length} employees`);
        return {
          success: true,
          data: employees,
          message: result.message || '取得成功',
        };
      } else {
        this.logger.error(`API error: ${result.message}`);
        return {
          success: false,
          data: [],
          message: result.message || 'API 錯誤',
        };
      }
    } catch (error) {
      this.logger.error('Failed to fetch employees:', error.message);
      return {
        success: false,
        data: [],
        message: error.message,
      };
    }
  }

  /**
   * API #6 - 取得全部店家及底下人員
   * 可取得更詳細的員工資訊（包含門市、職稱等）
   */
  async getAllStoresWithEmployees(): Promise<{
    success: boolean;
    data: StoreApiData[];
    message: string;
  }> {
    try {
      this.logger.log('Fetching all stores with employees from Lefthand API...');

      const response = await axios.post(
        this.MAP_API_URL,
        {
          method: 'getstoredatas',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 60000,
        },
      );

      const result = response.data;

      if (result.statecode === '0') {
        const stores = Array.isArray(result.data) ? result.data : [];
        this.logger.log(`Successfully fetched ${stores.length} stores`);
        return {
          success: true,
          data: stores,
          message: result.message || '取得成功',
        };
      } else {
        this.logger.error(`API error: ${result.message}`);
        return {
          success: false,
          data: [],
          message: result.message || 'API 錯誤',
        };
      }
    } catch (error) {
      this.logger.error('Failed to fetch stores:', error.message);
      return {
        success: false,
        data: [],
        message: error.message,
      };
    }
  }

  /**
   * API #10 - 依分店取得所有人員(顧問)
   * 可取得員工詳細資料（包含離職狀態）
   */
  async getEmployeesByGroup(groupErpId: string): Promise<{
    success: boolean;
    data: EmployeeDetailApiData[];
    message: string;
  }> {
    try {
      const encryptedGroupId = this.encrypt(groupErpId);

      const response = await axios.post(
        this.MAP_API_URL,
        {
          method: 'getemployeebygroup',
          groupid: encryptedGroupId,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const result = response.data;

      if (result.statecode === '0') {
        const employees = Array.isArray(result.data) ? result.data : [];
        return {
          success: true,
          data: employees,
          message: result.message || '取得成功',
        };
      } else {
        return {
          success: false,
          data: [],
          message: result.message || 'API 錯誤',
        };
      }
    } catch (error) {
      this.logger.error(`Failed to fetch employees for group ${groupErpId}:`, error.message);
      return {
        success: false,
        data: [],
        message: error.message,
      };
    }
  }

  /**
   * API #11 - 依指定條件取得人員(雇員)資料
   * 可批量取得多個員工的詳細資料
   */
  async getEmployeesByErpIds(erpIds: string[]): Promise<{
    success: boolean;
    data: EmployeeDetailApiData[];
    message: string;
  }> {
    try {
      // 多個 ID 用逗號隔開，整個字串一次加密
      const idsString = erpIds.join(',');
      const encryptedIds = this.encrypt(idsString);

      const response = await axios.post(
        this.MAP_API_URL,
        {
          method: 'getemployeebyerps',
          id: encryptedIds,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const result = response.data;

      if (result.statecode === '0') {
        const employees = Array.isArray(result.data) ? result.data : [];
        return {
          success: true,
          data: employees,
          message: result.message || '取得成功',
        };
      } else {
        return {
          success: false,
          data: [],
          message: result.message || 'API 錯誤',
        };
      }
    } catch (error) {
      this.logger.error('Failed to fetch employees by ERP IDs:', error.message);
      return {
        success: false,
        data: [],
        message: error.message,
      };
    }
  }

  /**
   * API #8 - 取得全部地區
   */
  async getAllAreas(): Promise<{
    success: boolean;
    data: AreaApiData[];
    message: string;
  }> {
    try {
      const response = await axios.post(
        this.MAP_API_URL,
        {
          method: 'getareas',
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        },
      );

      const result = response.data;

      if (result.statecode === '0') {
        return {
          success: true,
          data: result.data || [],
          message: result.message || '取得成功',
        };
      } else {
        return {
          success: false,
          data: [],
          message: result.message || 'API 錯誤',
        };
      }
    } catch (error) {
      this.logger.error('Failed to fetch areas:', error.message);
      return {
        success: false,
        data: [],
        message: error.message,
      };
    }
  }
}

// API 資料型態定義
export interface EmployeeApiData {
  employeeappnumber: string;  // 人員客戶編號（主鍵）
  employeename: string;       // 人員名稱
  employeeimage?: string;     // 人員照片
  employeeerpid?: string;     // 人員 ERP Id
}

export interface EmployeeDetailApiData {
  id: string;
  groupid: string;
  grouperpid: string;
  groupname: string;
  erpid: string;
  name: string;
  role: string;
  jobtitle: string;
  introduction?: string;
  timelimitedmessage?: string;
  photos?: string[];
  isfreeze: boolean;
  isleave: boolean;
  leavetime?: string;
  firsthonor?: string;
  honors?: { title: string }[];
  averagescore?: string;
}

export interface StoreApiData {
  city: string;
  id: string;
  erpid: string;
  name: string;
  subname?: string;
  description?: string;
  address?: string;
  phone?: string;
  worktime?: string;
  longitude?: string;
  latitude?: string;
  coverimage?: string;
  photos?: string[];
  sort?: string;
  employees?: StoreEmployeeApiData[];
}

export interface StoreEmployeeApiData {
  id: string;
  groupid: string;
  erpid: string;
  token?: string;
  account?: string;
  password?: string;
  name: string;
  role?: string;
  jobtitle?: string;
  introduction?: string;
  photos?: string;
  honor?: string;
}

export interface AreaApiData {
  id: number;
  name: string;
}
